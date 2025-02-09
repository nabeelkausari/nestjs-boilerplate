import { Test, TestingModule } from '@nestjs/testing';
import { GatewayController } from './gateway.controller';
import { GatewayService } from '../services/gateway.service';
import { RouteService } from '../services/route.service';
import { ServiceStatus } from '../schemas/route.schema';

describe('GatewayController', () => {
  let controller: GatewayController;
  let gatewayService: GatewayService;
  let routeService: RouteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GatewayController],
      providers: [
        {
          provide: GatewayService,
          useValue: {
            handleRequest: jest.fn(),
            checkHealth: jest.fn(),
          },
        },
        {
          provide: RouteService,
          useValue: {
            getRoutes: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<GatewayController>(GatewayController);
    gatewayService = module.get<GatewayService>(GatewayService);
    routeService = module.get<RouteService>(RouteService);
  });

  describe('handleRequest', () => {
    it('should forward request to appropriate service', async () => {
      const mockRequest = {
        method: 'GET',
        path: '/api/test',
        headers: {},
        body: {},
      };

      const expectedResponse = { data: 'test response' };

      jest
        .spyOn(gatewayService, 'handleRequest')
        .mockResolvedValue(expectedResponse);

      const result = await controller.handleRequest(mockRequest as any);

      expect(result).toEqual(expectedResponse);
      expect(gatewayService.handleRequest).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('healthCheck', () => {
    it('should return health status of all services', async () => {
      const expectedHealth = {
        gateway: 'healthy',
        services: {
          auth: { status: 'healthy' },
          users: { status: 'healthy' },
        },
        timestamp: expect.any(Date),
      };

      jest
        .spyOn(gatewayService, 'checkHealth')
        .mockResolvedValue(expectedHealth);

      const result = await controller.healthCheck();

      expect(result).toEqual(expectedHealth);
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
