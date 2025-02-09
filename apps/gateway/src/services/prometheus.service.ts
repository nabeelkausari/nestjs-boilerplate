import { Injectable } from '@nestjs/common';
import { Registry, Gauge } from 'prom-client';

@Injectable()
export class PrometheusService {
  private readonly registry: Registry;
  private readonly healthStatus: Gauge<string>;
  private readonly healthCheckDuration: Gauge<string>;
  private readonly serviceHealthStatus: Gauge<string>;

  constructor() {
    this.registry = new Registry();

    this.healthStatus = new Gauge({
      name: 'gateway_health_status',
      help: 'Current health status of the gateway',
      registers: [this.registry],
    });

    this.healthCheckDuration = new Gauge({
      name: 'gateway_health_check_duration_ms',
      help: 'Duration of health check in milliseconds',
      registers: [this.registry],
    });

    this.serviceHealthStatus = new Gauge({
      name: 'gateway_service_health_status',
      help: 'Health status of individual services',
      labelNames: ['service'],
      registers: [this.registry],
    });
  }

  recordHealthCheck(metrics: {
    status: string;
    responseTime: number;
    totalServices: number;
    healthyServices: number;
  }) {
    this.healthStatus.set(metrics.status === 'healthy' ? 1 : 0);
    this.healthCheckDuration.set(metrics.responseTime);
    this.serviceHealthStatus.set({ service: 'total' }, metrics.totalServices);
    this.serviceHealthStatus.set(
      { service: 'healthy' },
      metrics.healthyServices,
    );
  }

  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }
}
