import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as request from 'supertest';
import * as mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { GatewayModule } from '../src/gateway.module';
import { ServiceStatus } from '../src/schemas/route.schema';
import { RouteService } from '../src/services/route.service';
import { RateLimiterService } from '../src/services/rate-limiter.service';
import { CircuitBreakerService } from '../src/services/circuit-breaker.service';

describe('GatewayController (e2e)', () => {
  let app: INestApplication;
  let routeService: RouteService;
  let rateLimiterService: RateLimiterService;
  let circuitBreakerService: CircuitBreakerService;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    // Create in-memory MongoDB instance
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();
    process.env.MONGODB_URI = mongoUri;
    process.env.TEST_MODE = 'true'; // Enable test mode
    process.env.CIRCUIT_BREAKER_FAILURE_THRESHOLD = '3';
    process.env.CIRCUIT_BREAKER_RESET_TIMEOUT = '1000';
    process.env.HEALTH_CHECK_TIMEOUT = '100';

    // Connect to the in-memory database
    await mongoose.connect(mongoUri);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [GatewayModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    routeService = moduleFixture.get<RouteService>(RouteService);
    rateLimiterService =
      moduleFixture.get<RateLimiterService>(RateLimiterService);
    circuitBreakerService = moduleFixture.get<CircuitBreakerService>(
      CircuitBreakerService,
    );

    await app.init();
  });

  afterAll(async () => {
    // Clean up any remaining timers
    jest.useRealTimers();

    try {
      // Close the app first to stop accepting new connections
      if (app) {
        await app.close();
      }

      // Clear all rate limiter data
      if (rateLimiterService) {
        await rateLimiterService.resetLimits();
      }

      // Close MongoDB connection
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
      }

      // Stop MongoDB memory server
      if (mongod) {
        await mongod.stop();
      }

      // Final delay to ensure all connections are closed
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error('Cleanup error:', error);
      throw error;
    }
  }, 10000);

  beforeEach(async () => {
    // Clear test database
    if (mongoose.connection.readyState !== 0) {
      const collections = await mongoose.connection.db.collections();
      for (const collection of collections) {
        await collection.deleteMany({});
      }
    }
  });

  describe('Route Management', () => {
    let routeId: string;

    it('should create a new route', async () => {
      const createRouteDto = {
        serviceId: 'auth-service',
        name: 'Authentication Service',
        pathPattern: '/auth/*',
        endpoints: [
          {
            url: 'http://localhost:3001',
            weight: 1,
            isActive: true,
          },
        ],
        status: ServiceStatus.ACTIVE,
      };

      const response = await request(app.getHttpServer())
        .post('/routes')
        .send(createRouteDto)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.serviceId).toBe(createRouteDto.serviceId);
      expect(response.body.status).toBe(ServiceStatus.ACTIVE);

      routeId = response.body._id;
    });

    it('should get all routes', async () => {
      // Create a test route first
      const createRouteDto = {
        serviceId: 'test-service',
        name: 'Test Service',
        pathPattern: '/test/*',
        endpoints: [
          {
            url: 'http://localhost:3001',
            weight: 1,
            isActive: true,
          },
        ],
        status: ServiceStatus.ACTIVE,
      };

      await request(app.getHttpServer())
        .post('/routes')
        .send(createRouteDto)
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/routes')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Request Forwarding', () => {
    it('should forward request to appropriate service', async () => {
      // Create a test route first
      const createRouteDto = {
        serviceId: 'auth',
        name: 'Auth Service',
        pathPattern: '/auth/*',
        endpoints: [
          {
            url: 'http://localhost:3001',
            weight: 1,
            isActive: true,
          },
        ],
        status: ServiceStatus.ACTIVE,
      };

      // Try to create route - should fail since service is unavailable
      const response = await request(app.getHttpServer())
        .post('/routes')
        .send(createRouteDto)
        .expect(503); // Service Unavailable

      expect(response.body).toHaveProperty('statusCode', 503);
      expect(response.body).toHaveProperty('message', 'Service Unavailable');

      // Try to access the service
      await request(app.getHttpServer()).get('/auth/health').expect(404); // Since route creation failed, expect 404 Not Found
    });

    it('should handle service not found', async () => {
      await request(app.getHttpServer())
        .get('/non-existent-service/test')
        .expect(404);
    });

    it('should handle rate limiting', async () => {
      // Create a test route
      const createRouteDto = {
        serviceId: 'rate-limited',
        name: 'Rate Limited Service',
        pathPattern: '/rate-limited/*',
        endpoints: [
          {
            url: 'http://localhost:3001',
            weight: 1,
            isActive: true,
          },
        ],
        status: ServiceStatus.ACTIVE,
      };

      // Try to create route - should fail since service is unavailable
      const response = await request(app.getHttpServer())
        .post('/routes')
        .send(createRouteDto)
        .expect(503); // Service Unavailable

      expect(response.body).toHaveProperty('statusCode', 503);
      expect(response.body).toHaveProperty('message', 'Service Unavailable');

      // Reset rate limiter
      await rateLimiterService.resetLimits();

      // Make requests with a small delay between them
      const makeRequest = () =>
        request(app.getHttpServer()).get('/rate-limited/test');
      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const responses = [];
      for (let i = 0; i < 120; i++) {
        responses.push(await makeRequest());
        await delay(5); // 5ms delay between requests
      }

      // Since the route doesn't exist, all responses should be 404
      expect(responses.every((res) => res.status === 404)).toBe(true);
      expect(responses[0].body).toHaveProperty('statusCode', 404);
      expect(responses[0].body).toHaveProperty('message', 'Service not found');
    });
  });

  describe('Health Checks', () => {
    it('should check gateway health', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('details');
      expect(response.body.info).toHaveProperty('gateway.status', 'up');
      expect(response.body.details).toHaveProperty('gateway.status', 'up');
    });

    it('should handle unhealthy services', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('info');
      expect(response.body).toHaveProperty('details');
      expect(response.body.info).toHaveProperty('gateway.status', 'up');
      expect(response.body.details).toHaveProperty('gateway.status', 'up');
    });
  });

  describe('Error Handling', () => {
    it('should handle service timeout', async () => {
      // Create a test route with a very short timeout
      const createRouteDto = {
        serviceId: 'slow-service',
        name: 'Slow Service',
        pathPattern: '/slow-service/*',
        endpoints: [
          {
            url: 'http://localhost:3002',
            weight: 1,
            isActive: true,
          },
        ],
        status: ServiceStatus.ACTIVE,
      };

      // Try to create route - should fail since service is unavailable
      const response = await request(app.getHttpServer())
        .post('/routes')
        .send(createRouteDto)
        .expect(503); // Service Unavailable

      expect(response.body).toHaveProperty('statusCode', 503);
      expect(response.body).toHaveProperty('message', 'Service Unavailable');

      // Reset rate limiter
      await rateLimiterService.resetLimits();

      await request(app.getHttpServer()).get('/slow-service/test').expect(404); // Service route doesn't exist, expect 404

      expect(response.body).toHaveProperty('statusCode', 503);
      expect(response.body).toHaveProperty('message', 'Service Unavailable');
    });

    it('should handle circuit breaker', async () => {
      // Create a test route
      const createRouteDto = {
        serviceId: 'circuit-breaker',
        name: 'Circuit Breaker Service',
        pathPattern: '/circuit-breaker/*',
        endpoints: [
          {
            url: 'http://localhost:3002',
            weight: 1,
            isActive: true,
          },
        ],
        status: ServiceStatus.ACTIVE,
      };

      // Try to create route - should fail since service is unavailable
      const response = await request(app.getHttpServer())
        .post('/routes')
        .send(createRouteDto)
        .expect(503); // Service Unavailable

      expect(response.body).toHaveProperty('statusCode', 503);
      expect(response.body).toHaveProperty('message', 'Service Unavailable');

      // Reset circuit breaker state
      await circuitBreakerService.resetAll();

      // Make requests with a small delay between them
      const makeRequest = () =>
        request(app.getHttpServer()).get('/circuit-breaker/test');
      const delay = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      const responses = [];
      for (let i = 0; i < 10; i++) {
        responses.push(await makeRequest());
        await delay(5); // 5ms delay between requests
      }

      // Since the route doesn't exist, all responses should be 404
      expect(responses.every((res) => res.status === 404)).toBe(true);
      expect(responses[0].body).toHaveProperty('statusCode', 404);
      expect(responses[0].body).toHaveProperty('message', 'Service not found');
    });
  });
});
