import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Request } from 'express';

interface RateLimitConfig {
  points: number;
  duration: number;
}

@Injectable()
export class RateLimiterService {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly redis: Redis;
  private readonly defaultConfig: RateLimitConfig;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis({
      host: this.configService.get('REDIS_HOST'),
      port: this.configService.get('REDIS_PORT'),
      password: this.configService.get('REDIS_PASSWORD'),
    });

    this.defaultConfig = {
      points: this.configService.get('RATE_LIMIT_POINTS', 100),
      duration: this.configService.get('RATE_LIMIT_DURATION', 60),
    };
  }

  async checkLimit(request: Request, config?: RateLimitConfig): Promise<void> {
    const key = this.getKey(request);
    const { points, duration } = config || this.defaultConfig;

    const multi = this.redis.multi();
    multi.incr(key);
    multi.ttl(key);

    const results = await multi.exec();
    if (!results) throw new Error('Redis multi exec failed');

    const [[incrErr, count], [ttlErr, ttl]] = results;
    if (incrErr || ttlErr) throw new Error('Redis operation failed');

    const currentCount = count as number;
    if (currentCount === 1) {
      await this.redis.expire(key, duration);
    }

    const remainingPoints = points - currentCount;
    const remainingTime = ttl as number;

    if (!request.res) throw new Error('Response object not available');

    // Set rate limit headers
    request.res.setHeader('X-RateLimit-Limit', points);
    request.res.setHeader(
      'X-RateLimit-Remaining',
      Math.max(0, remainingPoints),
    );
    request.res.setHeader(
      'X-RateLimit-Reset',
      Date.now() + remainingTime * 1000,
    );

    if (currentCount > points) {
      throw new HttpException(
        'Too Many Requests',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  private getKey(request: Request): string {
    // Use IP and optional API key for rate limiting
    const identifier = request.headers['x-api-key'] || request.ip;
    return `ratelimit:${identifier}`;
  }

  async resetLimit(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async getLimitInfo(request: Request): Promise<{
    remaining: number;
    reset: number;
  }> {
    const key = this.getKey(request);
    const multi = this.redis.multi();
    multi.get(key);
    multi.ttl(key);

    const results = await multi.exec();
    if (!results) throw new Error('Redis multi exec failed');

    const [[getErr, count], [ttlErr, ttl]] = results;
    if (getErr || ttlErr) throw new Error('Redis operation failed');

    const currentCount = parseInt(count as string) || 0;
    const remaining = Math.max(0, this.defaultConfig.points - currentCount);

    return {
      remaining,
      reset: Date.now() + (ttl as number) * 1000,
    };
  }
}
