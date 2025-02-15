import { Test, TestingModule } from '@nestjs/testing';
import { GatewayController } from './gateway.controller';
import { GatewayService } from '../services/gateway.service';
import { RouteService } from '../services/route.service';
import { ServiceStatus } from '../schemas/route.schema';
import { HealthCheckService } from '@nestjs/terminus';

describe('GatewayController', () => {
  let controller: GatewayController;
  let gatewayService: GatewayService;
  let routeService: RouteService;
  let healthCheckService: HealthCheckService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [
        {
          provide: GatewayService,
          useValue: {
            handleRequest: jest.fn(),
            checkHealth: jest.fn(),
            checkServicesHealth: jest.fn(),
          },
        },
        {
          provide: RouteService,
          useValue: {
            getRoutes: jest.fn(),
            getRouteForPath: jest.fn(),
          },
        },
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<GatewayController>(GatewayController);
    gatewayService = module.get<GatewayService>(GatewayService);
    routeService = module.get<RouteService>(RouteService);
    healthCheckService = module.get<HealthCheckService>(HealthCheckService);
  });

  describe('handleRequest', () => {
    it('should forward request to appropriate service', async () => {
      const mockRequest = {
        method: 'GET',
        path: '/api/test',
        headers: {},
        body: {},
      };

      const mockResponse = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockNext = jest.fn();

      const expectedResponse = {
        status: 200,
        data: 'test response',
        headers: { 'content-type': 'application/json' },
      };

      jest.spyOn(routeService, 'getRouteForPath').mockResolvedValue({
        serviceId: 'test-service',
        pathPattern: '/api/*',
      } as any);

      jest
        .spyOn(gatewayService, 'handleRequest')
        .mockResolvedValue(expectedResponse);

      await controller.handleRequest(
        mockRequest as any,
        mockResponse as any,
        mockNext,
      );

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'content-type',
        'application/json',
      );
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith('test response');
      expect(gatewayService.handleRequest).toHaveBeenCalledWith(mockRequest);
    });

    it('should skip processing for /routes and /health paths', async () => {
      const mockRequest = {
        method: 'GET',
        path: '/routes',
        headers: {},
        body: {},
      };

      const mockResponse = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockNext = jest.fn();

      await controller.handleRequest(
        mockRequest as any,
        mockResponse as any,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalled();
      expect(gatewayService.handleRequest).not.toHaveBeenCalled();
    });

    it('should handle errors properly', async () => {
      const mockRequest = {
        method: 'GET',
        path: '/api/test',
        headers: {},
        body: {},
      };

      const mockResponse = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockNext = jest.fn();
      const mockError = new Error('Test error');
      mockError['status'] = 400;

      jest.spyOn(routeService, 'getRouteForPath').mockResolvedValue({
        serviceId: 'test-service',
        pathPattern: '/api/*',
      } as any);

      jest.spyOn(gatewayService, 'handleRequest').mockRejectedValue(mockError);

      await controller.handleRequest(
        mockRequest as any,
        mockResponse as any,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 400,
        message: 'Test error',
      });
    });

    it('should handle service not found', async () => {
      const mockRequest = {
        method: 'GET',
        path: '/api/test',
        headers: {},
        body: {},
      };

      const mockResponse = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockNext = jest.fn();

      jest.spyOn(routeService, 'getRouteForPath').mockResolvedValue(null);

      await controller.handleRequest(
        mockRequest as any,
        mockResponse as any,
        mockNext,
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        statusCode: 404,
        message: 'Service not found',
      });
    });
  });

  describe('checkHealth', () => {
    it('should check health status', async () => {
      const mockHealthCheck = {
        status: 'ok',
        info: {
          gateway: {
            status: 'up',
          },
        },
        error: {},
        details: {
          gateway: {
            status: 'up',
          },
        },
      };

      jest
        .spyOn(gatewayService, 'checkHealth')
        .mockResolvedValue(mockHealthCheck);

      const result = await controller.checkHealth();

      expect(result).toEqual(mockHealthCheck);
      expect(gatewayService.checkHealth).toHaveBeenCalled();
    });
  });

  describe('getRoutes', () => {
    it('should return all registered routes', async () => {
      const expectedRoutes = [
        {
          serviceId: 'auth',
          name: 'Authentication Service',
          pathPattern: '/auth/*',
          status: ServiceStatus.ACTIVE,
        },
        {
          serviceId: 'users',
          name: 'User Service',
          pathPattern: '/users/*',
          status: ServiceStatus.ACTIVE,
        },
      ];

      jest
        .spyOn(routeService, 'getRoutes')
        .mockResolvedValue(expectedRoutes as any);

      const result = await controller.getRoutes();

      expect(result).toEqual(expectedRoutes);
      expect(routeService.getRoutes).toHaveBeenCalled();
    });
  });
});
