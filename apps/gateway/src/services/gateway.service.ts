import {
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import axios from 'axios';
import { RouteService } from './route.service';
import { LoadBalancerService } from './load-balancer.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RateLimiterService } from './rate-limiter.service';

@Injectable()
export class GatewayService {
  private readonly logger = new Logger(GatewayService.name);
  private readonly defaultTimeout: number;
  private readonly serviceTimeouts: Record<string, number>;

  constructor(
    private readonly routeService: RouteService,
    private readonly loadBalancer: LoadBalancerService,
    private readonly circuitBreaker: CircuitBreakerService,
    private readonly rateLimiter: RateLimiterService,
    private readonly configService: ConfigService,
  ) {
    this.defaultTimeout = this.configService.get('REQUEST_TIMEOUT', 30000);
    // Configure service-specific timeouts
    this.serviceTimeouts = {
      auth: this.configService.get('AUTH_SERVICE_TIMEOUT', 5000),
      payment: this.configService.get('PAYMENT_SERVICE_TIMEOUT', 10000),
      // Add other service-specific timeouts here
    };
  }

  private getServiceTimeout(serviceId: string): number {
    return this.serviceTimeouts[serviceId] || this.defaultTimeout;
  }

  async handleRequest(request: Request): Promise<any> {
    // Apply rate limiting
    await this.rateLimiter.checkLimit(request);

    // Get service route
    const route = await this.routeService.getRouteForPath(request.path);
    if (!route) {
      throw new NotFoundException('Service not found');
    }

    // Check circuit breaker
    await this.circuitBreaker.checkService(route.serviceId);

    // Get service instance
    let serviceUrl: string;
    try {
      serviceUrl = await this.loadBalancer.getServiceInstance(route.serviceId);
    } catch (error) {
      this.logger.error(`Failed to get service instance: ${error.message}`);
      throw new ServiceUnavailableException('Service Unavailable');
    }

    // Forward request
    try {
      const response = await this.forwardRequest(request, serviceUrl);
      // Record success
      await this.circuitBreaker.recordSuccess(route.serviceId);
      return response;
    } catch (error) {
      // Record failure
      await this.circuitBreaker.recordError(route.serviceId);
      throw new ServiceUnavailableException('Service Unavailable');
    }
  }

  private async forwardRequest(
    request: Request,
    serviceUrl: string,
  ): Promise<any> {
    const path = request.path.replace(/^\/[^\/]+/, '');
    const url = new URL(path || '/', serviceUrl);
    const headers = {
      ...this.filterHeaders(request.headers),
      host: url.host,
    };

    // Extract service ID from the path
    const serviceId = request.path.split('/')[1];
    const timeout = this.getServiceTimeout(serviceId);

    try {
      this.logger.debug(
        `Forwarding request to ${url.toString()} with timeout ${timeout}ms`,
      );
      const response = await axios({
        method: request.method as any,
        url: url.toString(),
        headers,
        data: request.body,
        timeout: timeout,
        maxRedirects: 5,
        validateStatus: null,
      });

      // Always throw ServiceUnavailableException for health check endpoints if the service is down
      if (path.endsWith('/health') && response.status !== 200) {
        throw new ServiceUnavailableException('Service Unavailable');
      }

      if (response.status === 404 || response.status >= 500) {
        throw new ServiceUnavailableException('Service Unavailable');
      }

      return {
        status: response.status,
        headers: response.headers,
        data: response.data,
      };
    } catch (error) {
      this.logger.error('Forward request error: ' + error.message, {
        serviceId,
        timeout,
        url: url.toString(),
      });

      if (axios.isAxiosError(error)) {
        // Handle connection errors (ECONNREFUSED, ETIMEDOUT, etc.)
        if (error.code || !error.response) {
          throw new ServiceUnavailableException('Service Unavailable');
        }
        // Handle HTTP errors
        if (error.response?.status === 404 || error.response?.status >= 500) {
          throw new ServiceUnavailableException('Service Unavailable');
        }
      }
      throw new ServiceUnavailableException('Service Unavailable');
    }
  }

  private filterHeaders(headers: Record<string, any>): Record<string, any> {
    const allowedHeaders = [
      'authorization',
      'content-type',
      'user-agent',
      'x-request-id',
      'x-api-key',
    ];

    return Object.entries(headers)
      .filter(([key]) => allowedHeaders.includes(key.toLowerCase()))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
  }

  async checkHealth(): Promise<any> {
    const routes = await this.routeService.getRoutes();
    const info = {};
    const details = {};
    let hasDownServices = false;

    // Always include gateway status
    info['gateway'] = { status: 'up' };
    details['gateway'] = { status: 'up' };

    for (const route of routes) {
      try {
        const serviceUrl = await this.loadBalancer.getServiceInstance(
          route.serviceId,
        );

        try {
          await this.forwardRequest(
            { method: 'GET', path: `/${route.serviceId}/health` } as Request,
            serviceUrl,
          );
          info[route.serviceId] = { status: 'up' };
          details[route.serviceId] = { status: 'up' };
        } catch (error) {
          hasDownServices = true;
          info[route.serviceId] = { status: 'down' };
          details[route.serviceId] = { status: 'down' };
        }
      } catch (error) {
        hasDownServices = true;
        info[route.serviceId] = { status: 'down' };
        details[route.serviceId] = { status: 'down' };
      }
    }

    return {
      status: hasDownServices ? 'degraded' : 'ok',
      info,
      details,
    };
  }

  async checkServicesHealth(): Promise<Record<string, any>> {
    const routes = await this.routeService.getRoutes();
    const healthStatus = {};

    for (const route of routes) {
      try {
        const serviceUrl = await this.loadBalancer.getServiceInstance(
          route.serviceId,
        );
        const response = await this.forwardRequest(
          { method: 'GET', path: '/health' } as Request,
          serviceUrl,
        );
        healthStatus[route.serviceId] = {
          status: 'up',
          details: response.data,
        };
      } catch (error) {
        healthStatus[route.serviceId] = {
          status: 'down',
          error: error.message,
        };
      }
    }

    return healthStatus;
  }
}
