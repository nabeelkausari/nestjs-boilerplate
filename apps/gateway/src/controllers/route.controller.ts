import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { RouteService } from '../services/route.service';
import { CreateRouteDto } from '../dtos/create-route.dto';
import { UpdateRouteDto } from '../dtos/update-route.dto';
import { Route } from '../schemas/route.schema';

@ApiTags('routes')
@Controller('routes')
@ApiBearerAuth()
export class RouteController {
  constructor(private readonly routeService: RouteService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new route' })
  @ApiResponse({ status: 201, description: 'Route created successfully.' })
  async createRoute(@Body() createRouteDto: CreateRouteDto): Promise<Route> {
    return this.routeService.createRoute(createRouteDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all routes' })
  @ApiResponse({ status: 200, description: 'Routes retrieved successfully.' })
  async getRoutes(): Promise<Route[]> {
    return this.routeService.getRoutes();
  }

  @Put(':serviceId')
  @ApiOperation({ summary: 'Update a route' })
  @ApiResponse({ status: 200, description: 'Route updated successfully.' })
  async updateRoute(
    @Param('serviceId') serviceId: string,
    @Body() updateRouteDto: UpdateRouteDto,
  ): Promise<Route> {
    return this.routeService.updateRoute(serviceId, updateRouteDto);
  }

  @Delete(':serviceId')
  @ApiOperation({ summary: 'Delete a route' })
  @ApiResponse({ status: 200, description: 'Route deleted successfully.' })
  async deleteRoute(@Param('serviceId') serviceId: string): Promise<void> {
    return this.routeService.deleteRoute(serviceId);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh routes from database' })
  @ApiResponse({ status: 200, description: 'Routes refreshed successfully.' })
  async refreshRoutes(): Promise<void> {
    return this.routeService.refreshRoutes();
  }
}
