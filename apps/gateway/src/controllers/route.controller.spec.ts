import { Test, TestingModule } from '@nestjs/testing';
import { RouteController } from './route.controller';
import { RouteService } from '../services/route.service';
import { CreateRouteDto } from '../dtos/create-route.dto';
import { UpdateRouteDto } from '../dtos/update-route.dto';
import { Route, ServiceStatus } from '../schemas/route.schema';
import { Types } from 'mongoose';

describe('RouteController', () => {
  let controller: RouteController;
  let routeService: jest.Mocked<RouteService>;

  const mockRoute: Route = {
    _id: new Types.ObjectId(),
    serviceId: 'test-service',
    name: 'Test Service',
    pathPattern: '/test/*',
    endpoints: [
      {
        url: 'http://localhost:3000',
        weight: 1,
        isActive: true,
      },
    ],
    status: ServiceStatus.ACTIVE,
    version: 1,
    config: {},
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RouteController],
      providers: [
        {
          provide: RouteService,
          useValue: {
            createRoute: jest.fn(),
            getRoutes: jest.fn(),
            getRouteById: jest.fn(),
            updateRouteById: jest.fn(),
            deleteRouteById: jest.fn(),
            refreshRoutes: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<RouteController>(RouteController);
    routeService = module.get(RouteService);
  });

  describe('createRoute', () => {
    it('should create a new route', async () => {
      const createRouteDto: CreateRouteDto = {
        serviceId: 'test-service',
        name: 'Test Service',
        pathPattern: '/test/*',
        endpoints: [
          {
            url: 'http://localhost:3000',
            weight: 1,
            isActive: true,
          },
        ],
        status: ServiceStatus.ACTIVE,
        config: {},
      };

      routeService.createRoute.mockResolvedValue(mockRoute);

      const result = await controller.createRoute(createRouteDto);

      expect(result).toEqual(mockRoute);
      expect(routeService.createRoute).toHaveBeenCalledWith(createRouteDto);
    });
  });

  describe('getRoutes', () => {
    it('should return all routes', async () => {
      const routes = [mockRoute];
      routeService.getRoutes.mockResolvedValue(routes);

      const result = await controller.getRoutes();

      expect(result).toEqual(routes);
      expect(routeService.getRoutes).toHaveBeenCalled();
    });
  });

  describe('getRoute', () => {
    it('should return a route by id', async () => {
      const id = mockRoute._id.toString();
      routeService.getRouteById.mockResolvedValue(mockRoute);

      const result = await controller.getRoute(id);

      expect(result).toEqual(mockRoute);
      expect(routeService.getRouteById).toHaveBeenCalledWith(id);
    });
  });

  describe('updateRoute', () => {
    it('should update a route', async () => {
      const id = mockRoute._id.toString();
      const updateRouteDto: UpdateRouteDto = {
        name: 'Updated Service',
        status: ServiceStatus.MAINTENANCE,
      };

      const updatedRoute = {
        ...mockRoute,
        name: updateRouteDto.name,
        status: updateRouteDto.status,
      };

      routeService.updateRouteById.mockResolvedValue(updatedRoute);

      const result = await controller.updateRoute(id, updateRouteDto);

      expect(result).toEqual(updatedRoute);
      expect(routeService.updateRouteById).toHaveBeenCalledWith(
        id,
        updateRouteDto,
      );
    });
  });

  describe('deleteRoute', () => {
    it('should delete a route', async () => {
      const id = mockRoute._id.toString();
      routeService.deleteRouteById.mockResolvedValue(undefined);

      await controller.deleteRoute(id);

      expect(routeService.deleteRouteById).toHaveBeenCalledWith(id);
    });
  });

  describe('refreshRoutes', () => {
    it('should refresh routes', async () => {
      routeService.refreshRoutes.mockResolvedValue(undefined);

      await controller.refreshRoutes();

      expect(routeService.refreshRoutes).toHaveBeenCalled();
    });
  });
});
