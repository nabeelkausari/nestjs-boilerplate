import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractSchema } from '@app/common';

@Schema({ versionKey: false, timestamps: true })
export class HealthStatus extends AbstractSchema {
  @Prop({ required: true })
  gateway: string;

  @Prop({ type: Object, required: true })
  services: Record<
    string,
    {
      status: string;
      details?: any;
      error?: string;
    }
  >;

  @Prop({ required: true })
  timestamp: Date;

  @Prop({ type: Object })
  metrics?: {
    responseTime?: number;
    uptime?: number;
    totalServices?: number;
    healthyServices?: number;
  };
}

export const HealthStatusSchema = SchemaFactory.createForClass(HealthStatus);
HealthStatusSchema.index({ timestamp: -1 });
