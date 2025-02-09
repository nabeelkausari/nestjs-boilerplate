import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Route, ServiceStatus } from '../schemas/route.schema';
import { CreateRouteDto } from '../dtos/create-route.dto';
import { UpdateRouteDto } from '../dtos/update-route.dto';

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);
  private routes: Map<string, Route> = new Map();

  constructor(
    @InjectModel(Route.name) private readonly routeModel: Model<Route>,
  ) {
    this.loadRoutes();
  }

  private async loadRoutes() {
    const routes = await this.routeModel.find({ status: ServiceStatus.ACTIVE });
    routes.forEach((route) => {
      this.routes.set(route.serviceId, route);
    });
  }

  async getRoutes(): Promise<Route[]> {
    return Array.from(this.routes.values());
  }

  async getRouteForPath(path: string): Promise<Route | null> {
    for (const route of this.routes.values()) {
      if (this.matchPath(path, route.pathPattern)) {
        return route;
      }
    }
    return null;
  }

  async createRoute(dto: CreateRouteDto): Promise<Route> {
    const existingRoute = await this.routeModel.findOne({
      serviceId: dto.serviceId,
    });

    if (existingRoute) {
      throw new BadRequestException('Route already exists');
    }

    const route = await this.routeModel.create({
      ...dto,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    if (route.status === ServiceStatus.ACTIVE) {
      this.routes.set(route.serviceId, route);
    }

    return route;
  }

  async updateRoute(serviceId: string, dto: UpdateRouteDto): Promise<Route> {
    const route = await this.routeModel.findOneAndUpdate(
      { serviceId },
      {
        ...dto,
        version: { $inc: 1 },
        updatedAt: new Date(),
      },
      { new: true },
    );

    if (!route) {
      throw new NotFoundException('Route not found');
    }

    if (route.status === ServiceStatus.ACTIVE) {
      this.routes.set(route.serviceId, route);
    } else {
      this.routes.delete(route.serviceId);
    }

    return route;
  }

  async deleteRoute(serviceId: string): Promise<void> {
    const result = await this.routeModel.deleteOne({ serviceId });
    if (result.deletedCount === 0) {
      throw new NotFoundException('Route not found');
    }

    this.routes.delete(serviceId);
  }

  private matchPath(path: string, pattern: string): boolean {
    this.logger.debug(`Matching path "${path}" against pattern "${pattern}"`);

    // Convert the pattern to a regex
    const regexPattern = pattern
      .replace(/\//g, '\\/') // Escape forward slashes
      .replace(/\*/g, '.*'); // Replace * with any characters (including slashes)

    const regex = new RegExp(`^${regexPattern}`);
    this.logger.debug(`Generated regex pattern: ${regex.toString()}`);

    const result = regex.test(path);
    this.logger.debug(`Match result for "${path}": ${result}`);
    return result;
  }

  async getActiveEndpoints(serviceId: string): Promise<string[]> {
    const route = this.routes.get(serviceId);
    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return route.endpoints
      .filter((endpoint) => endpoint.isActive)
      .map((endpoint) => endpoint.url);
  }

  async refreshRoutes(): Promise<void> {
    await this.loadRoutes();
  }
}
