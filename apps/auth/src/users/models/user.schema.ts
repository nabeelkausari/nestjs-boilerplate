import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { AbstractSchema } from '@app/common';
import { Types } from 'mongoose';

@Schema({ versionKey: false })
export class UserDocument extends AbstractSchema {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: [String], default: ['user'] })
  roles: string[];

  @Prop({ default: true })
  isActive: boolean;

  _id: Types.ObjectId;
}

export const UserSchema = SchemaFactory.createForClass(UserDocument);

// Add indexes
UserSchema.index({ email: 1 }, { unique: true });
