import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { RateLimiterService } from './rate-limiter.service';
import { HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { Redis } from 'ioredis';

// Create a proper mock for Redis
const mockRedisInstance = {
  multi: jest.fn(),
  incr: jest.fn(),
  ttl: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  get: jest.fn(),
};

// Mock the Redis constructor
jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => mockRedisInstance)
}));

describe('RateLimiterService', () => {
  let service: RateLimiterService;
  let configService: ConfigService;
  let redis: Redis;

  const mockRequest = {
    ip: '127.0.0.1',
    headers: {},
    res: {
      setHeader: jest.fn(),
    } as unknown as Response,
  } as Request;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RateLimiterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                REDIS_PASSWORD: 'password',
                RATE_LIMIT_LIMIT: 100,
                RATE_LIMIT_TTL: 60,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RateLimiterService>(RateLimiterService);
    configService = module.get<ConfigService>(ConfigService);
    redis = (service as any).redis;
  });

  describe('checkLimit', () => {
    it('should allow requests within rate limit', async () => {
      const mockMulti = {
        incr: jest.fn().mockReturnThis(),
        ttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1], // incr result
          [null, 60], // ttl result
        ]),
      };

      mockRedisInstance.multi.mockReturnValue(mockMulti);
      mockRedisInstance.expire.mockResolvedValue(1);

      await service.checkLimit(mockRequest);

      expect(mockRedisInstance.multi).toHaveBeenCalled();
      expect(mockMulti.incr).toHaveBeenCalled();
      expect(mockMulti.ttl).toHaveBeenCalled();
      expect(mockRedisInstance.expire).toHaveBeenCalled();
      expect(mockRequest.res.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        100,
      );
    });

    it('should throw HttpException when rate limit exceeded', async () => {
      const mockMulti = {
        incr: jest.fn().mockReturnThis(),
        ttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 101], // incr result
          [null, 30], // ttl result
        ]),
      };

      mockRedisInstance.multi.mockReturnValue(mockMulti);

      await expect(service.checkLimit(mockRequest)).rejects.toThrow(
        new HttpException('Too Many Requests', HttpStatus.TOO_MANY_REQUESTS),
      );
    });

    it('should use custom rate limit config when provided', async () => {
      const customConfig = { points: 50, duration: 30 };
      const mockMulti = {
        incr: jest.fn().mockReturnThis(),
        ttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1], // incr result
          [null, 30], // ttl result
        ]),
      };

      mockRedisInstance.multi.mockReturnValue(mockMulti);
      mockRedisInstance.expire.mockResolvedValue(1);

      await service.checkLimit(mockRequest, customConfig);

      expect(mockRedisInstance.expire).toHaveBeenCalledWith(expect.any(String), 30);
      expect(mockRequest.res.setHeader).toHaveBeenCalledWith(
        'X-RateLimit-Limit',
        50,
      );
    });

    it('should handle Redis errors gracefully', async () => {
      const mockMulti = {
        incr: jest.fn().mockReturnThis(),
        ttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis connection error')),
      };

      mockRedisInstance.multi.mockReturnValue(mockMulti);

      await expect(service.checkLimit(mockRequest)).rejects.toThrow(
        'Redis connection error',
      );
    });
  });

  describe('resetLimit', () => {
    it('should reset limit for a specific key', async () => {
      mockRedisInstance.del.mockResolvedValue(1);

      await service.resetLimit('ratelimit:test');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('ratelimit:test');
    });

    it('should handle non-existent key', async () => {
      mockRedisInstance.del.mockResolvedValue(0);

      await service.resetLimit('ratelimit:nonexistent');

      expect(mockRedisInstance.del).toHaveBeenCalledWith('ratelimit:nonexistent');
    });
  });

  describe('getLimitInfo', () => {
    it('should return correct limit info', async () => {
      const mockMulti = {
        get: jest.fn().mockReturnThis(),
        ttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, '50'], // get result
          [null, 30], // ttl result
        ]),
      };

      mockRedisInstance.multi.mockReturnValue(mockMulti);

      const result = await service.getLimitInfo(mockRequest);

      expect(result).toHaveProperty('remaining');
      expect(result).toHaveProperty('reset');
      expect(result.remaining).toBe(50); // 100 (limit) - 50 (current)
      expect(typeof result.reset).toBe('number');
    });

    it('should handle case when no requests made', async () => {
      const mockMulti = {
        get: jest.fn().mockReturnThis(),
        ttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, null], // get result
          [null, -2], // ttl result (key doesn't exist)
        ]),
      };

      mockRedisInstance.multi.mockReturnValue(mockMulti);

      const result = await service.getLimitInfo(mockRequest);

      expect(result.remaining).toBe(100); // full limit available
      expect(typeof result.reset).toBe('number');
    });

    it('should handle Redis errors in getLimitInfo', async () => {
      const mockMulti = {
        get: jest.fn().mockReturnThis(),
        ttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Redis error')),
      };

      mockRedisInstance.multi.mockReturnValue(mockMulti);

      await expect(service.getLimitInfo(mockRequest)).rejects.toThrow('Redis error');
    });
  });

  describe('resetLimits', () => {
    it('should reset all rate limits', async () => {
      mockRedisInstance.keys.mockResolvedValue(['ratelimit:1', 'ratelimit:2']);
      mockRedisInstance.del.mockResolvedValue(2);

      await service.resetLimits();

      expect(mockRedisInstance.keys).toHaveBeenCalledWith('ratelimit:*');
      expect(mockRedisInstance.del).toHaveBeenCalledWith('ratelimit:1', 'ratelimit:2');
    });

    it('should handle case when no limits exist', async () => {
      mockRedisInstance.keys.mockResolvedValue([]);

      await service.resetLimits();

      expect(mockRedisInstance.keys).toHaveBeenCalledWith('ratelimit:*');
      expect(mockRedisInstance.del).not.toHaveBeenCalled();
    });

    it('should handle Redis errors in resetLimits', async () => {
      mockRedisInstance.keys.mockRejectedValue(new Error('Redis error'));

      await expect(service.resetLimits()).rejects.toThrow('Redis error');
    });
  });
});
