import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CircuitBreakerState {
  failures: number;
  lastFailure: Date | null;
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
}

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private readonly states: Map<string, CircuitBreakerState> = new Map();
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;

  constructor(private readonly configService: ConfigService) {
    this.failureThreshold = this.configService.get(
      'CIRCUIT_BREAKER_FAILURE_THRESHOLD',
      5,
    );
    this.resetTimeout = this.configService.get(
      'CIRCUIT_BREAKER_RESET_TIMEOUT',
      60000,
    );
  }

  async checkService(serviceId: string): Promise<void> {
    const state = this.getServiceState(serviceId);

    switch (state.status) {
      case 'OPEN':
        if (this.shouldAttemptReset(state)) {
          state.status = 'HALF_OPEN';
        } else {
          throw new ServiceUnavailableException(
            'Service is temporarily unavailable',
          );
        }
        break;
      case 'HALF_OPEN':
        // Allow a single request through to test the service
        break;
      case 'CLOSED':
        // Normal operation
        break;
    }
  }

  async recordSuccess(serviceId: string): Promise<void> {
    const state = this.getServiceState(serviceId);
    if (state.status === 'HALF_OPEN') {
      this.resetState(serviceId);
    }
  }

  async recordError(serviceId: string): Promise<void> {
    const state = this.getServiceState(serviceId);
    state.failures++;
    state.lastFailure = new Date();

    if (state.failures >= this.failureThreshold) {
      state.status = 'OPEN';
      this.logger.warn(`Circuit breaker opened for service ${serviceId}`);
    }
  }

  private getServiceState(serviceId: string): CircuitBreakerState {
    if (!this.states.has(serviceId)) {
      this.states.set(serviceId, {
        failures: 0,
        lastFailure: null,
        status: 'CLOSED',
      });
    }
    return this.states.get(serviceId)!;
  }

  private shouldAttemptReset(state: CircuitBreakerState): boolean {
    if (!state.lastFailure) return false;
    const timeSinceLastFailure = Date.now() - state.lastFailure.getTime();
    return timeSinceLastFailure >= this.resetTimeout;
  }

  private resetState(serviceId: string): void {
    this.states.set(serviceId, {
      failures: 0,
      lastFailure: null,
      status: 'CLOSED',
    });
    this.logger.log(`Circuit breaker reset for service ${serviceId}`);
  }

  async getServiceStatus(serviceId: string): Promise<string> {
    const state = this.getServiceState(serviceId);
    return state.status;
  }
}
