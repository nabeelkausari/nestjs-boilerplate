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

@ApiTags('gateway')
@Controller()
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly routeService: RouteService,
  ) {}

  @All('*')
  @ApiOperation({ summary: 'Handle all incoming requests' })
  @ApiResponse({ status: 200, description: 'Request processed successfully.' })
  async handleRequest(
    @Req() request: Request,
    @Res() response: Response,
    @Next() next: NextFunction,
  ) {
    // Skip processing if the path starts with /routes
    if (
      request.path.startsWith('/routes') ||
      request.path.startsWith('/health')
    ) {
      return next();
    }

    try {
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
      const status = error.status || 500;
      const message = error.message || 'Internal Server Error';
      return response.status(status).json({ statusCode: status, message });
    }
  }

  @Get('routes')
  // @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all registered routes' })
  @ApiResponse({ status: 200, description: 'Routes retrieved successfully.' })
  async getRoutes(): Promise<Route[]> {
    return this.routeService.getRoutes();
  }
}
