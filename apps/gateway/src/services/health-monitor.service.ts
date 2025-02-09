import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GatewayService } from './gateway.service';
import { HealthStatus } from '../schemas/health-status.schema';
import { NotificationService } from './notification.service';
import { PrometheusService } from './prometheus.service';

@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);
  private readonly alertThreshold = 3; // Number of consecutive failures before alerting
  private healthFailures: Map<string, number> = new Map();

  constructor(
    private readonly gatewayService: GatewayService,
    @InjectModel(HealthStatus.name)
    private readonly healthStatusModel: Model<HealthStatus>,
    private readonly notificationService: NotificationService,
    private readonly metricsService: PrometheusService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async checkServicesHealth() {
    try {
      const startTime = Date.now();
      const health = await this.gatewayService.checkHealth();
      const responseTime = Date.now() - startTime;

      // 1. Store health status in database
      await this.storeHealthStatus(health, responseTime);

      // 2. Check for unhealthy services and send alerts
      await this.handleHealthAlerts(health);

      // 3. Update metrics
      this.updateMetrics(health, responseTime);

      this.logger.log('Health check completed', health);
    } catch (error) {
      this.logger.error('Health check failed', error);
    }
  }

  private async storeHealthStatus(health: any, responseTime: number) {
    const healthyServices = Object.values(health.services).filter(
      (service: any) => service.status === 'healthy',
    ).length;

    const healthStatus = await this.healthStatusModel.create({
      ...health,
      metrics: {
        responseTime,
        uptime: process.uptime(),
        totalServices: Object.keys(health.services).length,
        healthyServices,
      },
    });

    await healthStatus.save();
  }

  private async handleHealthAlerts(health: any) {
    for (const [serviceId, serviceHealth] of Object.entries<any>(
      health.services,
    )) {
      if (serviceHealth.status === 'unhealthy') {
        const failures = (this.healthFailures.get(serviceId) || 0) + 1;
        this.healthFailures.set(serviceId, failures);

        if (failures >= this.alertThreshold) {
          await this.notificationService.sendAlert({
            severity: 'high',
            service: serviceId,
            message: `Service ${serviceId} has been unhealthy for ${failures} consecutive checks`,
            error: serviceHealth.error,
            timestamp: new Date(),
          });
        }
      } else {
        // Reset failure count when service becomes healthy
        this.healthFailures.delete(serviceId);
      }
    }
  }

  private updateMetrics(health: any, responseTime: number) {
    // Update Prometheus metrics
    this.metricsService.recordHealthCheck({
      status: health.gateway,
      responseTime,
      totalServices: Object.keys(health.services).length,
      healthyServices: Object.values(health.services).filter(
        (service: any) => service.status === 'healthy',
      ).length,
    });
  }
}
