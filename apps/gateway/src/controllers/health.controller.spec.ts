import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import {
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: jest.Mocked<HealthCheckService>;
  let mongooseHealth: jest.Mocked<MongooseHealthIndicator>;
  let memoryHealth: jest.Mocked<MemoryHealthIndicator>;

  const mockHealthyResponse: HealthCheckResult = {
    status: 'ok',
    info: {
      mongodb: { status: 'up' },
      memory_heap: { status: 'up', used: 100, max: 150 * 1024 * 1024 },
      memory_rss: { status: 'up', used: 100, max: 150 * 1024 * 1024 },
    },
    error: {},
    details: {
      mongodb: { status: 'up' },
      memory_heap: { status: 'up', used: 100, max: 150 * 1024 * 1024 },
      memory_rss: { status: 'up', used: 100, max: 150 * 1024 * 1024 },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
        {
          provide: MongooseHealthIndicator,
          useValue: {
            pingCheck: jest.fn(),
          },
        },
        {
          provide: MemoryHealthIndicator,
          useValue: {
            checkHeap: jest.fn(),
            checkRSS: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get(HealthCheckService);
    mongooseHealth = module.get(MongooseHealthIndicator);
    memoryHealth = module.get(MemoryHealthIndicator);
  });

  describe('check', () => {
    it('should return healthy status when all checks pass', async () => {
      healthService.check.mockResolvedValue(mockHealthyResponse);

      const result = await controller.check();

      expect(result).toEqual(mockHealthyResponse);
      expect(healthService.check).toHaveBeenCalledWith([
        expect.any(Function),
        expect.any(Function),
        expect.any(Function),
      ]);
    });

    it('should check MongoDB connection', async () => {
      const mongoResult: HealthIndicatorResult = {
        mongodb: { status: 'up' },
      };
      mongooseHealth.pingCheck.mockResolvedValue(mongoResult);

      healthService.check.mockImplementation(async (checks) => {
        const results = await Promise.all(checks.map((check) => check()));
        return {
          status: 'ok',
          info: results.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
          error: {},
          details: results.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        };
      });

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(mongooseHealth.pingCheck).toHaveBeenCalledWith('mongodb');
      expect(result.info).toHaveProperty('mongodb.status', 'up');
    });

    it('should check memory heap usage', async () => {
      const heapResult: HealthIndicatorResult = {
        memory_heap: { status: 'up', used: 100, max: 150 * 1024 * 1024 },
      };
      memoryHealth.checkHeap.mockResolvedValue(heapResult);

      healthService.check.mockImplementation(async (checks) => {
        const results = await Promise.all(checks.map((check) => check()));
        return {
          status: 'ok',
          info: results.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
          error: {},
          details: results.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        };
      });

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(memoryHealth.checkHeap).toHaveBeenCalledWith(
        'memory_heap',
        150 * 1024 * 1024,
      );
      expect(result.info).toHaveProperty('memory_heap.status', 'up');
    });

    it('should check RSS memory usage', async () => {
      const rssResult: HealthIndicatorResult = {
        memory_rss: { status: 'up', used: 100, max: 150 * 1024 * 1024 },
      };
      memoryHealth.checkRSS.mockResolvedValue(rssResult);

      healthService.check.mockImplementation(async (checks) => {
        const results = await Promise.all(checks.map((check) => check()));
        return {
          status: 'ok',
          info: results.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
          error: {},
          details: results.reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        };
      });

      const result = await controller.check();

      expect(result.status).toBe('ok');
      expect(memoryHealth.checkRSS).toHaveBeenCalledWith(
        'memory_rss',
        150 * 1024 * 1024,
      );
      expect(result.info).toHaveProperty('memory_rss.status', 'up');
    });

    it('should handle health check failures', async () => {
      const mockError = new Error('Health check failed');
      healthService.check.mockRejectedValue(mockError);

      await expect(controller.check()).rejects.toThrow('Health check failed');
    });

    it('should handle MongoDB connection failure', async () => {
      const mockMongoError: HealthCheckResult = {
        status: 'error',
        info: {},
        error: {
          mongodb: {
            status: 'down',
            message: 'Connection failed',
          },
        },
        details: {
          mongodb: {
            status: 'down',
            message: 'Connection failed',
          },
        },
      };

      healthService.check.mockResolvedValue(mockMongoError);

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('mongodb.status', 'down');
      expect(result.error.mongodb.message).toBe('Connection failed');
    });

    it('should handle memory threshold exceeded', async () => {
      const mockMemoryError: HealthCheckResult = {
        status: 'error',
        info: {},
        error: {
          memory_heap: {
            status: 'down',
            message: 'Memory threshold exceeded',
          },
        },
        details: {
          memory_heap: {
            status: 'down',
            message: 'Memory threshold exceeded',
            used: 200 * 1024 * 1024,
            max: 150 * 1024 * 1024,
          },
        },
      };

      healthService.check.mockResolvedValue(mockMemoryError);

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('memory_heap.status', 'down');
      expect(result.error.memory_heap.message).toBe('Memory threshold exceeded');
    });

    it('should handle multiple failing health checks', async () => {
      const mockMultipleErrors: HealthCheckResult = {
        status: 'error',
        info: {},
        error: {
          mongodb: {
            status: 'down',
            message: 'Connection failed',
          },
          memory_heap: {
            status: 'down',
            message: 'Memory threshold exceeded',
          },
        },
        details: {
          mongodb: {
            status: 'down',
            message: 'Connection failed',
          },
          memory_heap: {
            status: 'down',
            message: 'Memory threshold exceeded',
            used: 200 * 1024 * 1024,
            max: 150 * 1024 * 1024,
          },
        },
      };

      healthService.check.mockResolvedValue(mockMultipleErrors);

      const result = await controller.check();

      expect(result.status).toBe('error');
      expect(result.error).toHaveProperty('mongodb.status', 'down');
      expect(result.error).toHaveProperty('memory_heap.status', 'down');
    });
  });
});
