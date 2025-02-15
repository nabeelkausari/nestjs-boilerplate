import { Test, TestingModule } from '@nestjs/testing';
import { PrometheusService } from './prometheus.service';
import { Registry, Gauge } from 'prom-client';

// Mock the Registry and Gauge classes
const mockRegistry = {
  metrics: jest.fn(),
};

const mockGauge = {
  set: jest.fn(),
};

jest.mock('prom-client', () => ({
  Registry: jest.fn().mockImplementation(() => mockRegistry),
  Gauge: jest.fn().mockImplementation(() => mockGauge),
}));

describe('PrometheusService', () => {
  let service: PrometheusService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [PrometheusService],
    }).compile();

    service = module.get<PrometheusService>(PrometheusService);
  });

  describe('constructor', () => {
    it('should create registry and gauges', () => {
      expect(Registry).toHaveBeenCalled();
      expect(Gauge).toHaveBeenCalledTimes(3);

      // Verify gauge configurations
      expect(Gauge).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'gateway_health_status',
          help: 'Current health status of the gateway',
          registers: [mockRegistry],
        }),
      );

      expect(Gauge).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'gateway_health_check_duration_ms',
          help: 'Duration of health check in milliseconds',
          registers: [mockRegistry],
        }),
      );

      expect(Gauge).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'gateway_service_health_status',
          help: 'Health status of individual services',
          labelNames: ['service'],
          registers: [mockRegistry],
        }),
      );
    });
  });

  describe('recordHealthCheck', () => {
    it('should record healthy status metrics', () => {
      const metrics = {
        status: 'healthy',
        responseTime: 100,
        totalServices: 5,
        healthyServices: 5,
      };

      service.recordHealthCheck(metrics);

      expect(mockGauge.set).toHaveBeenCalledWith(1);
      expect(mockGauge.set).toHaveBeenCalledWith(100);
      expect(mockGauge.set).toHaveBeenCalledWith({ service: 'total' }, 5);
      expect(mockGauge.set).toHaveBeenCalledWith({ service: 'healthy' }, 5);
    });

    it('should record unhealthy status metrics', () => {
      const metrics = {
        status: 'unhealthy',
        responseTime: 200,
        totalServices: 5,
        healthyServices: 3,
      };

      service.recordHealthCheck(metrics);

      expect(mockGauge.set).toHaveBeenCalledWith(0);
      expect(mockGauge.set).toHaveBeenCalledWith(200);
      expect(mockGauge.set).toHaveBeenCalledWith({ service: 'total' }, 5);
      expect(mockGauge.set).toHaveBeenCalledWith({ service: 'healthy' }, 3);
    });

    it('should handle zero services', () => {
      const metrics = {
        status: 'healthy',
        responseTime: 50,
        totalServices: 0,
        healthyServices: 0,
      };

      service.recordHealthCheck(metrics);

      expect(mockGauge.set).toHaveBeenCalledWith(1);
      expect(mockGauge.set).toHaveBeenCalledWith(50);
      expect(mockGauge.set).toHaveBeenCalledWith({ service: 'total' }, 0);
      expect(mockGauge.set).toHaveBeenCalledWith({ service: 'healthy' }, 0);
    });
  });

  describe('getMetrics', () => {
    it('should return metrics from registry', async () => {
      const mockMetrics = 'mock metrics data';
      mockRegistry.metrics.mockResolvedValue(mockMetrics);

      const result = await service.getMetrics();

      expect(result).toBe(mockMetrics);
      expect(mockRegistry.metrics).toHaveBeenCalled();
    });

    it('should handle registry errors', async () => {
      const error = new Error('Registry error');
      mockRegistry.metrics.mockRejectedValue(error);

      await expect(service.getMetrics()).rejects.toThrow('Registry error');
    });
  });
});
