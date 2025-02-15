import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HealthMonitorService } from './health-monitor.service';
import { GatewayService } from './gateway.service';
import { NotificationService } from './notification.service';
import { PrometheusService } from './prometheus.service';
import { HealthStatus } from '../schemas/health-status.schema';

describe('HealthMonitorService', () => {
  let service: HealthMonitorService;
  let gatewayService: jest.Mocked<GatewayService>;
  let notificationService: jest.Mocked<NotificationService>;
  let metricsService: jest.Mocked<PrometheusService>;
  let healthStatusModel: Model<HealthStatus>;

  const mockHealthResponse = {
    gateway: 'up',
    services: {
      'service-1': { status: 'healthy' },
      'service-2': { status: 'healthy' },
    },
  };

  const mockUnhealthyResponse = {
    gateway: 'degraded',
    services: {
      'service-1': { status: 'healthy' },
      'service-2': { status: 'unhealthy', error: 'Connection timeout' },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthMonitorService,
        {
          provide: GatewayService,
          useValue: {
            checkHealth: jest.fn(),
          },
        },
        {
          provide: getModelToken(HealthStatus.name),
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendAlert: jest.fn(),
          },
        },
        {
          provide: PrometheusService,
          useValue: {
            recordHealthCheck: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HealthMonitorService>(HealthMonitorService);
    gatewayService = module.get(GatewayService);
    notificationService = module.get(NotificationService);
    metricsService = module.get(PrometheusService);
    healthStatusModel = module.get(getModelToken(HealthStatus.name));
  });

  describe('checkServicesHealth', () => {
    it('should store health status and update metrics for healthy services', async () => {
      // Mock healthy response
      gatewayService.checkHealth.mockResolvedValue(mockHealthResponse);
      const mockHealthStatus = {
        save: jest.fn(),
      };
      (healthStatusModel.create as jest.Mock).mockResolvedValue(
        mockHealthStatus,
      );

      await service.checkServicesHealth();

      // Verify health status was stored
      expect(healthStatusModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          gateway: 'up',
          metrics: expect.objectContaining({
            totalServices: 2,
            healthyServices: 2,
          }),
        }),
      );
      expect(mockHealthStatus.save).toHaveBeenCalled();

      // Verify metrics were updated
      expect(metricsService.recordHealthCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'up',
          totalServices: 2,
          healthyServices: 2,
        }),
      );

      // Verify no alerts were sent
      expect(notificationService.sendAlert).not.toHaveBeenCalled();
    });

    it('should send alerts for unhealthy services after threshold', async () => {
      gatewayService.checkHealth.mockResolvedValue(mockUnhealthyResponse);
      const mockHealthStatus = {
        save: jest.fn(),
      };
      (healthStatusModel.create as jest.Mock).mockResolvedValue(
        mockHealthStatus,
      );

      // Simulate multiple consecutive failures
      for (let i = 0; i < 3; i++) {
        await service.checkServicesHealth();
      }

      // Verify alert was sent after threshold
      expect(notificationService.sendAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'high',
          service: 'service-2',
          message: expect.stringContaining('service-2'),
          error: 'Connection timeout',
        }),
      );
    });

    it('should reset failure count when service becomes healthy', async () => {
      // First make the service unhealthy
      gatewayService.checkHealth.mockResolvedValue(mockUnhealthyResponse);
      const mockHealthStatus = {
        save: jest.fn(),
      };
      (healthStatusModel.create as jest.Mock).mockResolvedValue(
        mockHealthStatus,
      );

      await service.checkServicesHealth();

      // Then make it healthy
      gatewayService.checkHealth.mockResolvedValue(mockHealthResponse);
      await service.checkServicesHealth();

      // Make it unhealthy again - should need 3 more failures to alert
      gatewayService.checkHealth.mockResolvedValue(mockUnhealthyResponse);
      await service.checkServicesHealth();

      // Verify no alert was sent (failure count was reset)
      expect(notificationService.sendAlert).not.toHaveBeenCalled();
    });

    it('should handle errors during health check', async () => {
      const error = new Error('Health check failed');
      gatewayService.checkHealth.mockRejectedValue(error);

      await service.checkServicesHealth();

      // Verify no health status was stored
      expect(healthStatusModel.create).not.toHaveBeenCalled();
      // Verify no metrics were updated
      expect(metricsService.recordHealthCheck).not.toHaveBeenCalled();
    });

    it('should calculate correct response time metrics', async () => {
      gatewayService.checkHealth.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        return mockHealthResponse;
      });

      const mockHealthStatus = {
        save: jest.fn(),
      };
      (healthStatusModel.create as jest.Mock).mockResolvedValue(
        mockHealthStatus,
      );

      await service.checkServicesHealth();

      // Verify response time was recorded
      expect(healthStatusModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metrics: expect.objectContaining({
            responseTime: expect.any(Number),
          }),
        }),
      );

      expect(metricsService.recordHealthCheck).toHaveBeenCalledWith(
        expect.objectContaining({
          responseTime: expect.any(Number),
        }),
      );
    });
  });
});
