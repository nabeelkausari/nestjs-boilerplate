import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { RouteService } from './route.service';
import { Route, ServiceStatus } from '../schemas/route.schema';
import { CreateRouteDto } from '../dtos/create-route.dto';
import { UpdateRouteDto } from '../dtos/update-route.dto';
import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('RouteService', () => {
  let service: RouteService;
  let routeModel: Model<Route>;
  let configService: ConfigService;

  const mockRoute = {
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRouteModel = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RouteService,
        {
          provide: getModelToken(Route.name),
          useValue: mockRouteModel,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                HEALTH_CHECK_TIMEOUT: 1000,
                TEST_MODE: false,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RouteService>(RouteService);
    routeModel = module.get<Model<Route>>(getModelToken(Route.name));
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRoutes', () => {
    it('should return all routes', async () => {
      const routes = [mockRoute];
      mockRouteModel.find.mockResolvedValue(routes);

      const result = await service.getRoutes();

      expect(result).toEqual(routes);
      expect(mockRouteModel.find).toHaveBeenCalled();
    });

    it('should handle errors when getting routes', async () => {
      mockRouteModel.find.mockRejectedValue(new Error('Database error'));

      await expect(service.getRoutes()).rejects.toThrow('Database error');
    });
  });

  describe('getRouteForPath', () => {
    it('should return matching route for path', async () => {
      mockRouteModel.find.mockResolvedValue([mockRoute]);

      const result = await service.getRouteForPath('/test/123');

      expect(result).toEqual(mockRoute);
    });

    it('should return null when no matching route found', async () => {
      mockRouteModel.find.mockResolvedValue([mockRoute]);

      const result = await service.getRouteForPath('/nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createRoute', () => {
    const createRouteDto: CreateRouteDto = {
      serviceId: 'new-service',
      name: 'New Service',
      pathPattern: '/new/*',
      endpoints: [
        {
          url: 'http://localhost:3001',
          weight: 1,
          isActive: true,
        },
      ],
      status: ServiceStatus.ACTIVE,
      config: {},
    };

    it('should create a new route successfully', async () => {
      mockRouteModel.findOne.mockResolvedValue(null);
      mockedAxios.get.mockResolvedValue({ status: 200 });
      mockRouteModel.create.mockResolvedValue({
        ...createRouteDto,
        _id: new Types.ObjectId(),
      });

      const result = await service.createRoute(createRouteDto);

      expect(result).toBeDefined();
      expect(result.serviceId).toBe(createRouteDto.serviceId);
      expect(mockRouteModel.create).toHaveBeenCalled();
    });

    it('should throw BadRequestException when route already exists', async () => {
      mockRouteModel.findOne.mockResolvedValue(mockRoute);

      await expect(service.createRoute(createRouteDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ServiceUnavailableException when no endpoints are available', async () => {
      mockRouteModel.findOne.mockResolvedValue(null);
      mockedAxios.get.mockRejectedValue(new Error('Connection failed'));

      await expect(service.createRoute(createRouteDto)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('updateRoute', () => {
    const updateRouteDto: UpdateRouteDto = {
      name: 'Updated Service',
      status: ServiceStatus.ACTIVE,
    };

    it('should update route successfully', async () => {
      const updatedRoute = { ...mockRoute, ...updateRouteDto };
      mockRouteModel.findOneAndUpdate.mockResolvedValue(updatedRoute);

      const result = await service.updateRoute('test-service', updateRouteDto);

      expect(result).toEqual(updatedRoute);
      expect(mockRouteModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('should throw NotFoundException when route not found', async () => {
      mockRouteModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.updateRoute('nonexistent', updateRouteDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteRoute', () => {
    it('should delete route successfully', async () => {
      mockRouteModel.deleteOne.mockResolvedValue({ deletedCount: 1 });

      await service.deleteRoute('test-service');

      expect(mockRouteModel.deleteOne).toHaveBeenCalledWith({
        serviceId: 'test-service',
      });
    });

    it('should throw NotFoundException when route not found', async () => {
      mockRouteModel.deleteOne.mockResolvedValue({ deletedCount: 0 });

      await expect(service.deleteRoute('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('matchPath', () => {
    it('should match exact path', async () => {
      const result = await service.getRouteForPath('/test/path');
      expect(mockRouteModel.find).toHaveBeenCalled();
    });

    it('should match wildcard path', async () => {
      const result = await service.getRouteForPath('/test/anything/here');
      expect(mockRouteModel.find).toHaveBeenCalled();
    });

    it('should not match invalid path', async () => {
      const result = await service.getRouteForPath('/invalid/path');
      expect(result).toBeNull();
    });
  });

  describe('getActiveEndpoints', () => {
    it('should return active endpoints', async () => {
      mockRouteModel.find.mockResolvedValue([mockRoute]);
      mockedAxios.get.mockResolvedValue({ status: 200 });

      // Load routes first
      await service.loadRoutes();

      const result = await service.getActiveEndpoints('test-service');

      expect(result).toEqual(['http://localhost:3000']);
    });

    it('should throw NotFoundException when service not found', async () => {
      mockRouteModel.find.mockResolvedValue([]);

      // Load routes first
      await service.loadRoutes();

      await expect(service.getActiveEndpoints('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ServiceUnavailableException when no active endpoints', async () => {
      const routeWithNoActiveEndpoints = {
        ...mockRoute,
        endpoints: [
          {
            ...mockRoute.endpoints[0],
            isActive: false,
          },
        ],
      };

      mockRouteModel.find.mockResolvedValue([routeWithNoActiveEndpoints]);
      mockedAxios.get.mockRejectedValue(new Error('Connection failed'));

      // Load routes first
      await service.loadRoutes();

      await expect(service.getActiveEndpoints('test-service')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
