import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
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

export class CreateRouteDto {
  @ApiProperty()
  @IsString()
  serviceId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  pathPattern: string;

  @ApiProperty({ type: [ServiceEndpointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ServiceEndpointDto)
  endpoints: ServiceEndpointDto[];

  @ApiProperty({ enum: ServiceStatus })
  @IsEnum(ServiceStatus)
  status: ServiceStatus;

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
