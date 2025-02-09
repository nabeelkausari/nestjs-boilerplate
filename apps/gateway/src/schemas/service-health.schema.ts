import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractSchema } from '@app/common';

export enum HealthStatus {
  HEALTHY = 'healthy',
  UNHEALTHY = 'unhealthy',
  DEGRADED = 'degraded',
}

@Schema({ _id: false })
export class HealthCheck {
  @Prop({ required: true, enum: HealthStatus })
  status: HealthStatus;

  @Prop({ required: true })
  lastCheck: Date;

  @Prop()
  error?: string;

  @Prop({ type: Object })
  metrics?: {
    responseTime?: number;
    successRate?: number;
    errorRate?: number;
  };
}

export const HealthCheckSchema = SchemaFactory.createForClass(HealthCheck);

@Schema({ versionKey: false, timestamps: true })
export class ServiceHealth extends AbstractSchema {
  @Prop({ required: true })
  serviceId: string;

  @Prop({ required: true, type: HealthCheckSchema })
  health: HealthCheck;

  @Prop({ type: [HealthCheckSchema], default: [] })
  history: HealthCheck[];

  @Prop({ type: Object, default: {} })
  metadata: Record<string, any>;
}

export const ServiceHealthSchema = SchemaFactory.createForClass(ServiceHealth);

// Add indexes
ServiceHealthSchema.index({ serviceId: 1 }, { unique: true });
ServiceHealthSchema.index({ 'health.status': 1 });
ServiceHealthSchema.index({ 'health.lastCheck': 1 });
