import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { NotificationService } from './notification.service';
import { Logger } from '@nestjs/common';

describe('NotificationService', () => {
  let service: NotificationService;
  let configService: ConfigService;
  let loggerWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<NotificationService>(NotificationService);
    configService = module.get<ConfigService>(ConfigService);

    // Spy on Logger.warn
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendAlert', () => {
    it('should log high severity alert', async () => {
      const alert = {
        severity: 'high' as const,
        service: 'test-service',
        message: 'Critical error',
        error: 'Connection timeout',
        timestamp: new Date(),
      };

      await service.sendAlert(alert);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        `Alert: ${alert.message}`,
        expect.objectContaining({
          severity: 'high',
          service: 'test-service',
          message: 'Critical error',
          error: 'Connection timeout',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should log medium severity alert', async () => {
      const alert = {
        severity: 'medium' as const,
        service: 'test-service',
        message: 'Performance degradation',
        timestamp: new Date(),
      };

      await service.sendAlert(alert);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        `Alert: ${alert.message}`,
        expect.objectContaining({
          severity: 'medium',
          service: 'test-service',
          message: 'Performance degradation',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should log low severity alert', async () => {
      const alert = {
        severity: 'low' as const,
        service: 'test-service',
        message: 'Minor issue detected',
        timestamp: new Date(),
      };

      await service.sendAlert(alert);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        `Alert: ${alert.message}`,
        expect.objectContaining({
          severity: 'low',
          service: 'test-service',
          message: 'Minor issue detected',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should handle alert without error field', async () => {
      const alert = {
        severity: 'high' as const,
        service: 'test-service',
        message: 'Service unavailable',
        timestamp: new Date(),
      };

      await service.sendAlert(alert);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        `Alert: ${alert.message}`,
        expect.objectContaining({
          severity: 'high',
          service: 'test-service',
          message: 'Service unavailable',
          timestamp: expect.any(Date),
        }),
      );
    });

    it('should include all alert properties in log', async () => {
      const timestamp = new Date();
      const alert = {
        severity: 'high' as const,
        service: 'test-service',
        message: 'Test alert',
        error: 'Test error',
        timestamp,
        additionalInfo: 'extra data',
      };

      await service.sendAlert(alert);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        `Alert: ${alert.message}`,
        expect.objectContaining({
          ...alert,
        }),
      );
    });
  });
}); 