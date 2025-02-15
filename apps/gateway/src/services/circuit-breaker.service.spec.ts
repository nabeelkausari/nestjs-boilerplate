import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService } from './circuit-breaker.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let configService: ConfigService;

  const mockConfig = {
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: 3,
    CIRCUIT_BREAKER_RESET_TIMEOUT: 1000, // 1 second for faster testing
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (key: string, defaultValue?: any) =>
                mockConfig[key] || defaultValue,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('checkService', () => {
    it('should allow requests when circuit is closed', async () => {
      await expect(service.checkService('test-service')).resolves.not.toThrow();
    });

    it('should throw exception when circuit is open', async () => {
      // Trigger failures to open the circuit
      for (let i = 0; i < mockConfig.CIRCUIT_BREAKER_FAILURE_THRESHOLD; i++) {
        await service.recordError('test-service');
      }

      await expect(service.checkService('test-service')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should transition to half-open state after timeout', async () => {
      // Open the circuit
      for (let i = 0; i < mockConfig.CIRCUIT_BREAKER_FAILURE_THRESHOLD; i++) {
        await service.recordError('test-service');
      }

      // Wait for reset timeout
      await new Promise((resolve) =>
        setTimeout(resolve, mockConfig.CIRCUIT_BREAKER_RESET_TIMEOUT + 100),
      );

      // Should not throw (half-open state)
      await expect(service.checkService('test-service')).resolves.not.toThrow();
    });
  });

  describe('recordSuccess', () => {
    it('should reset circuit breaker when in half-open state', async () => {
      // Open the circuit
      for (let i = 0; i < mockConfig.CIRCUIT_BREAKER_FAILURE_THRESHOLD; i++) {
        await service.recordError('test-service');
      }

      // Wait for reset timeout to transition to half-open
      await new Promise((resolve) =>
        setTimeout(resolve, mockConfig.CIRCUIT_BREAKER_RESET_TIMEOUT + 100),
      );

      // Check service to transition to half-open
      await service.checkService('test-service');

      // Record success
      await service.recordSuccess('test-service');

      // Circuit should be closed
      const status = await service.getServiceStatus('test-service');
      expect(status).toBe('CLOSED');
    });

    it('should maintain closed state on success in closed state', async () => {
      await service.recordSuccess('test-service');
      const status = await service.getServiceStatus('test-service');
      expect(status).toBe('CLOSED');
    });
  });

  describe('recordError', () => {
    it('should increment failure count', async () => {
      await service.recordError('test-service');
      const status = await service.getServiceStatus('test-service');
      expect(status).toBe('CLOSED');
    });

    it('should open circuit after threshold failures', async () => {
      for (let i = 0; i < mockConfig.CIRCUIT_BREAKER_FAILURE_THRESHOLD; i++) {
        await service.recordError('test-service');
      }

      const status = await service.getServiceStatus('test-service');
      expect(status).toBe('OPEN');
    });
  });

  describe('getServiceStatus', () => {
    it('should return CLOSED for new service', async () => {
      const status = await service.getServiceStatus('new-service');
      expect(status).toBe('CLOSED');
    });

    it('should return correct status after state changes', async () => {
      // Initial state
      let status = await service.getServiceStatus('test-service');
      expect(status).toBe('CLOSED');

      // After failures
      for (let i = 0; i < mockConfig.CIRCUIT_BREAKER_FAILURE_THRESHOLD; i++) {
        await service.recordError('test-service');
      }
      status = await service.getServiceStatus('test-service');
      expect(status).toBe('OPEN');

      // After timeout (half-open)
      await new Promise((resolve) =>
        setTimeout(resolve, mockConfig.CIRCUIT_BREAKER_RESET_TIMEOUT + 100),
      );
      await service.checkService('test-service');
      status = await service.getServiceStatus('test-service');
      expect(status).toBe('HALF_OPEN');
    });
  });

  describe('reset', () => {
    it('should reset circuit breaker state', async () => {
      // Open the circuit
      for (let i = 0; i < mockConfig.CIRCUIT_BREAKER_FAILURE_THRESHOLD; i++) {
        await service.recordError('test-service');
      }

      // Reset the circuit
      await service.reset('test-service');

      const status = await service.getServiceStatus('test-service');
      expect(status).toBe('CLOSED');
    });
  });

  describe('resetAll', () => {
    it('should reset all circuit breakers', async () => {
      // Open multiple circuits
      const services = ['service1', 'service2', 'service3'];
      for (const serviceId of services) {
        for (let i = 0; i < mockConfig.CIRCUIT_BREAKER_FAILURE_THRESHOLD; i++) {
          await service.recordError(serviceId);
        }
      }

      // Reset all circuits
      await service.resetAll();

      // Verify all circuits are closed
      for (const serviceId of services) {
        const status = await service.getServiceStatus(serviceId);
        expect(status).toBe('CLOSED');
      }
    });
  });
});
