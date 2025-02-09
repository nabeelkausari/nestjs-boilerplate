import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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

    try {
      // Get service instance
      const serviceUrl = await this.loadBalancer.getServiceInstance(
        route.serviceId,
      );

      // Forward request
      const response = await this.forwardRequest(request, serviceUrl);

      // Record success
      await this.circuitBreaker.recordSuccess(route.serviceId);

      return response;
    } catch (error) {
      // Record failure
      await this.circuitBreaker.recordError(route.serviceId);
      throw error;
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

      return {
        status: response.status,
        headers: response.headers,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Forward request error: ${error.message}`, {
        serviceId,
        timeout,
        url: url.toString(),
      });
      if (axios.isAxiosError(error)) {
        if (error.response) {
          return {
            status: error.response.status,
            headers: error.response.headers,
            data: error.response.data,
          };
        }
        throw new Error(
          `Request failed: ${error.message} (Timeout: ${timeout}ms)`,
        );
      }
      throw error;
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
          status: 'healthy',
          details: response.data,
        };
      } catch (error) {
        healthStatus[route.serviceId] = {
          status: 'unhealthy',
          error: error.message,
        };
      }
    }

    return {
      gateway: 'healthy',
      services: healthStatus,
      timestamp: new Date(),
    };
  }
}
