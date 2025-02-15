import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '@nestjs-modules/ioredis';
import { GatewayModule } from '../src/gateway.module';
import { Route, RouteSchema, ServiceStatus } from '../src/schemas/route.schema';
import {
  ServiceHealth,
  ServiceHealthSchema,
} from '../src/schemas/service-health.schema';
import {
  HealthStatus,
  HealthStatusSchema,
} from '../src/schemas/health-status.schema';
import { MongoMemoryServer } from 'mongodb-memory-server';
import {
  disableLogging,
  setupTestLogging,
  restoreTestLogging,
} from '@app/common';
import { Model } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { RateLimiterService } from '../src/services/rate-limiter.service';

describe('Gateway Integration Tests', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;
  let moduleRef: TestingModule;
  let routeModel: Model<Route>;

  beforeAll(async () => {
    // Setup test logging
    setupTestLogging();

    // Start in-memory MongoDB
    mongod = await MongoMemoryServer.create();
    const mongoUri = mongod.getUri();

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              MONGODB_URI: mongoUri,
              REDIS_HOST: 'localhost',
              REDIS_PORT: 6379,
              REDIS_PASSWORD: '',
              REDIS_DB: 0,
              TEST_MODE: true,
              RATE_LIMIT_LIMIT: 10, // Strict rate limit for testing
              RATE_LIMIT_TTL: 5, // Short duration for testing
            }),
          ],
        }),
        MongooseModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) => ({
            uri: configService.get<string>('MONGODB_URI'),
          }),
          inject: [ConfigService],
        }),
        RedisModule.forRootAsync({
          useFactory: (configService: ConfigService) => ({
            type: 'single',
            url: `redis://${configService.get('REDIS_HOST')}:${configService.get('REDIS_PORT')}`,
            password: configService.get('REDIS_PASSWORD'),
            db: configService.get('REDIS_DB', 0),
          }),
          inject: [ConfigService],
        }),
        MongooseModule.forFeature([
          { name: Route.name, schema: RouteSchema },
          { name: ServiceHealth.name, schema: ServiceHealthSchema },
          { name: HealthStatus.name, schema: HealthStatusSchema },
        ]),
        GatewayModule,
      ],
    }).compile();

    moduleRef = await disableLogging(moduleRef);
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    routeModel = moduleRef.get<Model<Route>>(getModelToken(Route.name));
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongod) {
      await mongod.stop();
    }
    restoreTestLogging();
  });

  beforeEach(async () => {
    // Clean up the database before each test
    await routeModel.deleteMany({});
  });

  describe('Route Management', () => {
    it('should create a new route', () => {
      return request(app.getHttpServer())
        .post('/routes')
        .send({
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
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('serviceId', 'test-service');
          expect(res.body).toHaveProperty('name', 'Test Service');
          expect(res.body).toHaveProperty('pathPattern', '/test');
          expect(res.body.endpoints).toHaveLength(1);
          expect(res.body.endpoints[0]).toHaveProperty(
            'url',
            'http://localhost:3000',
          );
          expect(res.body).toHaveProperty('status', ServiceStatus.ACTIVE);
        });
    });

    it('should get all routes', async () => {
      // Create a test route first
      await routeModel.create({
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
      });

      return request(app.getHttpServer())
        .get('/routes')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('serviceId', 'test-service');
        });
    });

    it('should validate route creation payload', () => {
      return request(app.getHttpServer())
        .post('/routes')
        .send({
          // Missing required fields
          serviceId: 'test-service',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(Array.isArray(res.body.message)).toBe(true);
          expect(res.body.message.length).toBeGreaterThan(0);
        });
    });
  });

  describe('Request Forwarding', () => {
    it('should return 404 for non-existent route', () => {
      return request(app.getHttpServer()).get('/non-existent-path').expect(404);
    });

    it('should handle rate limiting', async () => {
      // Create a test route
      await routeModel.create({
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
      });

      // Get the rate limiter service to reset limits
      const rateLimiterService = moduleRef.get(RateLimiterService);
      await rateLimiterService.resetLimits();

      // Make sequential requests with the same IP
      const testIP = '127.0.0.1';
      let rateLimitedCount = 0;

      for (let i = 0; i < 20; i++) {
        const response = await request(app.getHttpServer())
          .get('/test')
          .set('X-Forwarded-For', testIP);

        if (response.status === 429) {
          rateLimitedCount++;
        }
        // Small delay to ensure Redis operations complete
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Health Checks', () => {
    it('should return gateway health status', () => {
      return request(app.getHttpServer())
        .get('/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('info');
          expect(res.body).toHaveProperty('details');
          expect(res.body.info).toHaveProperty('gateway');
        });
    });

    it('should return detailed services health status', async () => {
      // Create a test route
      await routeModel.create({
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
      });

      return request(app.getHttpServer())
        .get('/health/services')
        .expect(200)
        .expect((res) => {
          expect(typeof res.body).toBe('object');
          expect(res.body).toHaveProperty('test-service');
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', () => {
      return request(app.getHttpServer())
        .post('/routes')
        .send({
          invalidField: 'value',
        })
        .expect(400)
        .expect((res) => {
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('error');
        });
    });

    it('should handle internal server errors gracefully', async () => {
      // Force an internal error by sending invalid data type
      return request(app.getHttpServer())
        .post('/routes')
        .send('invalid-json')
        .set('Content-Type', 'application/json')
        .expect(400);
    });
  });
});
