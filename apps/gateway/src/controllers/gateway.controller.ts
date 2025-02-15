import { Controller, All, Get, Req, Res, Next } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request, Response, NextFunction } from 'express';
import { GatewayService } from '../services/gateway.service';
import { RouteService } from '../services/route.service';
import { Route } from '../schemas/route.schema';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorResult,
  HealthIndicatorStatus,
} from '@nestjs/terminus';

interface ServiceHealth {
  status: 'up' | 'down';
  details?: any;
  error?: string;
}

@ApiTags('gateway')
@Controller()
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly routeService: RouteService,
    private readonly health: HealthCheckService,
  ) {}

  @All('*')
  @ApiOperation({ summary: 'Handle all incoming requests' })
  @ApiResponse({ status: 200, description: 'Request processed successfully.' })
  async handleRequest(
    @Req() request: Request,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    // Skip processing if the path is for gateway routes or gateway health
    if (request.path === '/routes' || request.path === '/health') {
      return next();
    }

    try {
      // Get service route first
      const route = await this.routeService.getRouteForPath(request.path);
      if (!route) {
        return response.status(404).json({
          statusCode: 404,
          message: 'Service not found',
        });
      }

      const result = await this.gatewayService.handleRequest(request);

      // Set response headers
      Object.entries(result.headers || {}).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          response.setHeader(key, value);
        }
      });

      // Send response
      return response.status(result.status).json(result.data);
    } catch (error) {
      // Handle errors
      const status = error.getStatus?.() || error.status || 500;
      const message = error.message || 'Internal Server Error';
      return response.status(status).json({ statusCode: status, message });
    }
  }

  @Get('health')
  @HealthCheck()
  @ApiOperation({ summary: 'Check gateway and services health' })
  @ApiResponse({ status: 200, description: 'Health check successful.' })
  @ApiResponse({ status: 503, description: 'Service unavailable.' })
  async checkHealth() {
    const healthResult = await this.gatewayService.checkHealth();
    return healthResult;
  }

  @Get('routes')
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all registered routes' })
  @ApiResponse({ status: 200, description: 'Routes retrieved successfully.' })
  async getRoutes(): Promise<Route[]> {
    return this.routeService.getRoutes();
  }
}
