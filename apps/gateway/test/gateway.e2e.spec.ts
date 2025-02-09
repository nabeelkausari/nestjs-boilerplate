import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as mongoose from 'mongoose';
import { GatewayModule } from '../src/gateway.module';
import { ServiceStatus } from '../src/schemas/route.schema';

describe('GatewayController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [GatewayModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    // Clear test database
    await mongoose.connect(process.env.MONGODB_URI);
    await mongoose.connection.dropDatabase();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
    await app.close();
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
            url: 'http://auth-service:3001',
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
      const response = await request(app.getHttpServer())
        .get('/routes')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe('Request Forwarding', () => {
    it('should forward request to appropriate service', async () => {
      const response = await request(app.getHttpServer())
        .get('/auth/health')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });

    it('should handle service not found', async () => {
      await request(app.getHttpServer())
        .get('/non-existent-service/test')
        .expect(404);
    });

    it('should handle rate limiting', async () => {
      // Make multiple requests quickly
      const requests = Array(150)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/auth/health'));

      const responses = await Promise.all(requests);
      const tooManyRequests = responses.some((res) => res.status === 429);
      expect(tooManyRequests).toBe(true);
    });
  });

  describe('Health Checks', () => {
    it('should check gateway health', async () => {
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toHaveProperty('gateway');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should handle unhealthy services', async () => {
      // Stop a service to simulate unhealthy state
      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body.services).toHaveProperty('auth-service');
      expect(Object.values(response.body.services)).toContain('unhealthy');
    });
  });

  describe('Error Handling', () => {
    it('should handle service timeout', async () => {
      // Configure a route with a very short timeout
      await request(app.getHttpServer()).get('/slow-service/test').expect(504);
    });

    it('should handle circuit breaker', async () => {
      // Make multiple failed requests to trigger circuit breaker
      const requests = Array(10)
        .fill(null)
        .map(() => request(app.getHttpServer()).get('/failing-service/test'));

      await Promise.all(requests);

      // Next request should be rejected by circuit breaker
      await request(app.getHttpServer())
        .get('/failing-service/test')
        .expect(503);
    });
  });
});
