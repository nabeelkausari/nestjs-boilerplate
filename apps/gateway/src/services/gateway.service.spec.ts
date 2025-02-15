import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { RouteService } from './route.service';
import { LoadBalancerService } from './load-balancer.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { RateLimiterService } from './rate-limiter.service';
import { Request } from 'express';
import axios from 'axios';
import { ServiceStatus } from '../schemas/route.schema';
import { Types } from 'mongoose';

jest.mock('axios');
const mockedAxios = jest as jest.Mocked<typeof jest>;

describe('GatewayService', () => {
  let service: GatewayService;
  let routeService: jest.Mocked<RouteService>;
  let loadBalancer: jest.Mocked<LoadBalancerService>;
  let circuitBreaker: jest.Mocked<CircuitBreakerService>;
  let rateLimiter: jest.Mocked<RateLimiterService>;
  let configService: jest.Mocked<ConfigService>;

  const mockRoute = {
    _id: new Types.ObjectId(),
    serviceId: 'test-service',
    name: 'Test Service',
    pathPattern: '/test',
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
    const mockServices = {
      routeService: {
        getRouteForPath: jest.fn(),
        getRoutes: jest.fn(),
      },
      loadBalancer: {
        getServiceInstance: jest.fn(),
      },
      circuitBreaker: {
        checkService: jest.fn(),
        recordSuccess: jest.fn(),
        recordError: jest.fn(),
      },
      rateLimiter: {
        checkLimit: jest.fn(),
      },
      configService: {
        get: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GatewayService,
        {
          provide: RouteService,
          useValue: mockServices.routeService,
        },
        {
          provide: LoadBalancerService,
          useValue: mockServices.loadBalancer,
        },
        {
          provide: CircuitBreakerService,
          useValue: mockServices.circuitBreaker,
        },
        {
          provide: RateLimiterService,
          useValue: mockServices.rateLimiter,
        },
        {
          provide: ConfigService,
          useValue: mockServices.configService,
        },
      ],
    }).compile();

    service = module.get<GatewayService>(GatewayService);
    routeService = module.get(RouteService);
    loadBalancer = module.get(LoadBalancerService);
    circuitBreaker = module.get(CircuitBreakerService);
    rateLimiter = module.get(RateLimiterService);
    configService = module.get(ConfigService);

    // Default mock implementations
    configService.get.mockImplementation((key: string) => {
      const config = {
        REQUEST_TIMEOUT: 30000,
        AUTH_SERVICE_TIMEOUT: 5000,
        PAYMENT_SERVICE_TIMEOUT: 10000,
      };
      return config[key];
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('handleRequest', () => {
    const mockRequest = {
      path: '/test',
      method: 'GET',
      headers: {
        authorization: 'Bearer token',
        'content-type': 'application/json',
      },
      body: {},
    } as Request;

    it('should successfully forward request', async () => {
      // Arrange
      routeService.getRouteForPath.mockResolvedValue(mockRoute);
      loadBalancer.getServiceInstance.mockResolvedValue(
        'http://test-service:3000',
      );
      circuitBreaker.checkService.mockResolvedValue(undefined);
      rateLimiter.checkLimit.mockResolvedValue(undefined);

      const mockAxiosResponse = {
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { message: 'success' },
      };
      (axios as any).mockResolvedValue(mockAxiosResponse);

      // Act
      const result = await service.handleRequest(mockRequest);

      // Assert
      expect(result).toEqual({
        status: 200,
        headers: { 'content-type': 'application/json' },
        data: { message: 'success' },
      });
      expect(routeService.getRouteForPath).toHaveBeenCalledWith('/test');
      expect(loadBalancer.getServiceInstance).toHaveBeenCalledWith(
        'test-service',
      );
      expect(circuitBreaker.checkService).toHaveBeenCalledWith('test-service');
      expect(rateLimiter.checkLimit).toHaveBeenCalledWith(mockRequest);
      expect(circuitBreaker.recordSuccess).toHaveBeenCalledWith('test-service');
    });

    it('should throw NotFoundException when route not found', async () => {
      // Arrange
      routeService.getRouteForPath.mockResolvedValue(null);
      rateLimiter.checkLimit.mockResolvedValue(undefined);

      // Act & Assert
      await expect(service.handleRequest(mockRequest)).rejects.toThrow(
        'Service not found',
      );
      expect(loadBalancer.getServiceInstance).not.toHaveBeenCalled();
    });

    it('should throw ServiceUnavailableException when circuit breaker is open', async () => {
      // Arrange
      routeService.getRouteForPath.mockResolvedValue(mockRoute);
      rateLimiter.checkLimit.mockResolvedValue(undefined);
      circuitBreaker.checkService.mockRejectedValue(
        new Error('Circuit breaker open'),
      );

      // Act & Assert
      await expect(service.handleRequest(mockRequest)).rejects.toThrow(
        'Service Unavailable',
      );
      expect(loadBalancer.getServiceInstance).not.toHaveBeenCalled();
    });
  });

  describe('checkHealth', () => {
    it('should return health status of all services', async () => {
      // Arrange
      const mockRoutes = [
        {
          ...mockRoute,
          _id: new Types.ObjectId(),
          serviceId: 'service1',
          pathPattern: '/service1',
        },
        {
          ...mockRoute,
          _id: new Types.ObjectId(),
          serviceId: 'service2',
          pathPattern: '/service2',
        },
      ];
      routeService.getRoutes.mockResolvedValue(mockRoutes);
      loadBalancer.getServiceInstance.mockResolvedValue('http://test:3000');

      const mockHealthyResponse = {
        status: 200,
        data: { status: 'up' },
      };
      (axios as any)
        .mockRejectedValueOnce(new Error('Service down'))
        .mockRejectedValueOnce(new Error('Service down'));

      // Act
      const result = await service.checkHealth();

      // Assert
      expect(result).toEqual({
        status: 'degraded',
        info: {
          gateway: { status: 'up' },
          service1: { status: 'down' },
          service2: { status: 'down' },
        },
        details: {
          gateway: { status: 'up' },
          service1: { status: 'down' },
          service2: { status: 'down' },
        },
      });
    });
  });

  describe('filterHeaders', () => {
    it('should only allow specified headers', async () => {
      // Arrange
      const inputHeaders = {
        authorization: 'Bearer token',
        'content-type': 'application/json',
        'x-request-id': '123',
        'x-api-key': 'key',
        cookie: 'session=123',
        'custom-header': 'value',
      };

      // Act
      const result = (service as any).filterHeaders(inputHeaders);

      // Assert
      expect(result).toEqual({
        authorization: 'Bearer token',
        'content-type': 'application/json',
        'x-request-id': '123',
        'x-api-key': 'key',
      });
      expect(result).not.toHaveProperty('cookie');
      expect(result).not.toHaveProperty('custom-header');
    });
  });
});
