import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ServiceStatus } from '../schemas/route.schema';

class ServiceEndpointDto {
  @ApiProperty()
  @IsString()
  url: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  weight?: number;

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  isActive?: boolean;
}

export class UpdateRouteDto {
  @ApiProperty()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty()
  @IsString()
  @IsOptional()
  pathPattern?: string;

  @ApiProperty({ type: [ServiceEndpointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceEndpointDto)
  @IsOptional()
  endpoints?: ServiceEndpointDto[];

  @ApiProperty({ enum: ServiceStatus })
  @IsEnum(ServiceStatus)
  @IsOptional()
  status?: ServiceStatus;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  config?: {
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
}
