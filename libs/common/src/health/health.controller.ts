import { Controller, Get, Logger } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  MongooseHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);
  private readonly checks: Array<() => Promise<any>>;

  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private mongoose?: MongooseHealthIndicator,
  ) {
    // Initialize with memory checks using higher thresholds
    this.checks = [
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300MB
      () => this.memory.checkRSS('memory_rss', 300 * 1024 * 1024), // 300MB
    ];

    // Add mongoose check if available
    if (this.mongoose) {
      const mongooseIndicator = this.mongoose;
      this.checks.push(() => mongooseIndicator.pingCheck('mongodb'));
    }
  }

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Check health status',
  })
  async check() {
    this.logger.log('Health check requested');
    try {
      const result = await this.health.check(this.checks);
      this.logger.log('Health check completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }
}
