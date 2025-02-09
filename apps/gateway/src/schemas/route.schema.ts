import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractSchema } from '@app/common';

export enum ServiceStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  MAINTENANCE = 'MAINTENANCE',
}

@Schema({ _id: false })
export class ServiceEndpoint {
  @Prop({ required: true })
  url: string;

  @Prop({ required: true, default: 1 })
  weight: number;

  @Prop({ required: true, default: true })
  isActive: boolean;
}

export const ServiceEndpointSchema =
  SchemaFactory.createForClass(ServiceEndpoint);

@Schema({ versionKey: false, timestamps: true })
export class Route extends AbstractSchema {
  @Prop({ required: true, unique: true })
  serviceId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  pathPattern: string;

  @Prop({ required: true, type: [ServiceEndpointSchema] })
  endpoints: ServiceEndpoint[];

  @Prop({ required: true, enum: ServiceStatus, default: ServiceStatus.ACTIVE })
  status: ServiceStatus;

  @Prop({ required: true, default: 0 })
  version: number;

  @Prop({ type: Object, default: {} })
  config: {
    timeout?: number;
    retries?: number;
    circuitBreaker?: {
      failureThreshold: number;
      resetTimeout: number;
    };
    rateLimit?: {
      points: number;
      duration: number;
    };
  };

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const RouteSchema = SchemaFactory.createForClass(Route);

// Add indexes
RouteSchema.index({ serviceId: 1 }, { unique: true });
RouteSchema.index({ pathPattern: 1 });
RouteSchema.index({ status: 1 });
