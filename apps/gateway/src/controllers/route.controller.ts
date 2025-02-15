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

  @Get(':id')
  @ApiOperation({ summary: 'Get a route by ID' })
  @ApiResponse({ status: 200, description: 'Route retrieved successfully.' })
  async getRoute(@Param('id') id: string): Promise<Route> {
    return this.routeService.getRouteById(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a route' })
  @ApiResponse({ status: 200, description: 'Route updated successfully.' })
  async updateRoute(
    @Param('id') id: string,
    @Body() updateRouteDto: UpdateRouteDto,
  ): Promise<Route> {
    return this.routeService.updateRouteById(id, updateRouteDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a route' })
  @ApiResponse({ status: 200, description: 'Route deleted successfully.' })
  async deleteRoute(@Param('id') id: string): Promise<void> {
    return this.routeService.deleteRouteById(id);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh routes from database' })
  @ApiResponse({ status: 200, description: 'Routes refreshed successfully.' })
  async refreshRoutes(): Promise<void> {
    return this.routeService.refreshRoutes();
  }
}
