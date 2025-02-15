import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { LoggerModule, HealthModule } from '@app/common';
import { TerminusModule } from '@nestjs/terminus';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema:
        process.env.NODE_ENV === 'test'
          ? Joi.object({
              MONGODB_URI: Joi.string().optional(),
              RABBITMQ_URI: Joi.string().optional(),
              PORT: Joi.number().optional(),
            })
          : Joi.object({
              MONGODB_URI: Joi.string().required(),
              RABBITMQ_URI: Joi.string().required(),
            }),
    }),
    ...(process.env.NODE_ENV !== 'test'
      ? [
          MongooseModule.forRootAsync({
            useFactory: (configService) => ({
              uri: configService.get('MONGODB_URI'),
            }),
            inject: [ConfigService],
          }),
        ]
      : []),
    LoggerModule,
    TerminusModule,
    HealthModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
