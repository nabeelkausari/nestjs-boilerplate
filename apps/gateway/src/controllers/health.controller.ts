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

  constructor(
    private health: HealthCheckService,
    private mongoose: MongooseHealthIndicator,
    private memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Check health status of the gateway and its dependencies',
  })
  async check() {
    this.logger.log('Health check requested');
    try {
      const result = await this.health.check([
        () => this.mongoose.pingCheck('mongodb'),
        () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB
        () => this.memory.checkRSS('memory_rss', 150 * 1024 * 1024), // 150MB
      ]);
      this.logger.log('Health check completed successfully');
      return result;
    } catch (error) {
      this.logger.error('Health check failed', error);
      throw error;
    }
  }
}
