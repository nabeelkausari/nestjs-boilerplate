import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisModule } from '@nestjs-modules/ioredis';
import { HealthModule, RmqModule } from '@app/common';
import { GatewayController } from './controllers/gateway.controller';
import { GatewayService } from './services/gateway.service';
import { RouteService } from './services/route.service';
import { LoadBalancerService } from './services/load-balancer.service';
import { CircuitBreakerService } from './services/circuit-breaker.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { Route, RouteSchema } from './schemas/route.schema';
import {
  ServiceHealth,
  ServiceHealthSchema,
} from './schemas/service-health.schema';
import { TerminusModule, MemoryHealthIndicator } from '@nestjs/terminus';
import { HttpModule } from '@nestjs/axios';
import { RouteController } from './controllers/route.controller';
import {
  HealthStatus,
  HealthStatusSchema,
} from './schemas/health-status.schema';
import { HealthMonitorService } from './services/health-monitor.service';
import { NotificationService } from './services/notification.service';
import { PrometheusService } from './services/prometheus.service';

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? './apps/gateway/.env.test'
          : './apps/gateway/.env',
    }),
    MongooseModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        uri: configService.get('MONGODB_URI'),
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
    RmqModule.register({ name: 'NOTIFICATION' }),
    TerminusModule,
    HttpModule,
  ],
  controllers: [GatewayController, RouteController],
  providers: [
    HealthMonitorService,
    NotificationService,
    PrometheusService,
    GatewayService,
    RouteService,
    LoadBalancerService,
    CircuitBreakerService,
    RateLimiterService,
    MemoryHealthIndicator,
  ],
})
export class GatewayModule {}
