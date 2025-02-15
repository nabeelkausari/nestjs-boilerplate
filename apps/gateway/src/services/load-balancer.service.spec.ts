import { Test, TestingModule } from '@nestjs/testing';
import { LoadBalancerService } from './load-balancer.service';
import { RouteService } from './route.service';
import { ServiceUnavailableException } from '@nestjs/common';

describe('LoadBalancerService', () => {
  let service: LoadBalancerService;
  let routeService: jest.Mocked<RouteService>;

  const mockEndpoints = [
    'http://service1:3000',
    'http://service2:3000',
    'http://service3:3000',
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoadBalancerService,
        {
          provide: RouteService,
          useValue: {
            getActiveEndpoints: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LoadBalancerService>(LoadBalancerService);
    routeService = module.get(RouteService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getServiceInstance', () => {
    it('should return endpoints in round-robin fashion', async () => {
      // Mock the same endpoints for each call to maintain the round-robin order
      routeService.getActiveEndpoints
        .mockResolvedValueOnce(mockEndpoints)
        .mockResolvedValueOnce(mockEndpoints)
        .mockResolvedValueOnce(mockEndpoints)
        .mockResolvedValueOnce(mockEndpoints);

      // First call should return first endpoint
      const firstInstance = await service.getServiceInstance('test-service');
      expect(firstInstance).toBe(mockEndpoints[0]);

      // Second call should return second endpoint
      const secondInstance = await service.getServiceInstance('test-service');
      expect(secondInstance).toBe(mockEndpoints[1]);

      // Third call should return third endpoint
      const thirdInstance = await service.getServiceInstance('test-service');
      expect(thirdInstance).toBe(mockEndpoints[2]);

      // Fourth call should wrap around to first endpoint
      const fourthInstance = await service.getServiceInstance('test-service');
      expect(fourthInstance).toBe(mockEndpoints[0]);
    });

    it('should throw ServiceUnavailableException when no endpoints available', async () => {
      routeService.getActiveEndpoints.mockResolvedValue([]);

      await expect(service.getServiceInstance('test-service')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException when endpoints is null', async () => {
      routeService.getActiveEndpoints.mockResolvedValue(null);

      await expect(service.getServiceInstance('test-service')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should refresh endpoints on each call', async () => {
      routeService.getActiveEndpoints.mockResolvedValue(mockEndpoints);

      await service.getServiceInstance('test-service');
      await service.getServiceInstance('test-service');

      expect(routeService.getActiveEndpoints).toHaveBeenCalledTimes(2);
      expect(routeService.getActiveEndpoints).toHaveBeenCalledWith(
        'test-service',
      );
    });

    it('should handle endpoint updates', async () => {
      // Initial endpoints
      routeService.getActiveEndpoints.mockResolvedValueOnce(mockEndpoints);
      const firstInstance = await service.getServiceInstance('test-service');
      expect(firstInstance).toBe(mockEndpoints[0]);

      // Updated endpoints
      const updatedEndpoints = ['http://new-service:3000'];
      routeService.getActiveEndpoints.mockResolvedValueOnce(updatedEndpoints);
      const secondInstance = await service.getServiceInstance('test-service');
      expect(secondInstance).toBe(updatedEndpoints[0]);

      // Verify that getActiveEndpoints was called twice
      expect(routeService.getActiveEndpoints).toHaveBeenCalledTimes(2);
      expect(routeService.getActiveEndpoints).toHaveBeenCalledWith('test-service');
    });
  });

  describe('refreshEndpoints', () => {
    it('should update endpoints for a service', async () => {
      routeService.getActiveEndpoints.mockResolvedValue(mockEndpoints);

      await service.refreshEndpoints('test-service');
      const instance = await service.getServiceInstance('test-service');

      expect(instance).toBe(mockEndpoints[0]);
      expect(routeService.getActiveEndpoints).toHaveBeenCalledWith(
        'test-service',
      );
    });

    it('should handle empty endpoints during refresh', async () => {
      routeService.getActiveEndpoints.mockResolvedValue([]);

      await service.refreshEndpoints('test-service');

      await expect(service.getServiceInstance('test-service')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('clearEndpoints', () => {
    it('should remove endpoints for a specific service', async () => {
      // First set some endpoints
      routeService.getActiveEndpoints.mockResolvedValueOnce(mockEndpoints);
      await service.getServiceInstance('test-service');

      // Clear the endpoints
      await service.clearEndpoints('test-service');

      // Next call should fetch fresh endpoints
      const newEndpoints = ['http://new-service:3000'];
      routeService.getActiveEndpoints.mockResolvedValueOnce(newEndpoints);
      const instance = await service.getServiceInstance('test-service');

      expect(instance).toBe(newEndpoints[0]);
    });
  });

  describe('clearAllEndpoints', () => {
    it('should remove all service endpoints', async () => {
      // First set some endpoints for multiple services
      routeService.getActiveEndpoints.mockResolvedValue(mockEndpoints);
      await service.getServiceInstance('service1');
      await service.getServiceInstance('service2');

      // Clear all endpoints
      await service.clearAllEndpoints();

      // Next calls should fetch fresh endpoints
      const newEndpoints = ['http://new-service:3000'];
      routeService.getActiveEndpoints.mockResolvedValue(newEndpoints);

      const instance1 = await service.getServiceInstance('service1');
      const instance2 = await service.getServiceInstance('service2');

      expect(instance1).toBe(newEndpoints[0]);
      expect(instance2).toBe(newEndpoints[0]);
    });
  });
});
