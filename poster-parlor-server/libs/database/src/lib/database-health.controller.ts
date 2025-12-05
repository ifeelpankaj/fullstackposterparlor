// health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service';

@Controller('db-health')
export class DatabaseHealthController {
  constructor(private readonly dbHealthService: DatabaseHealthService) {}

  @Get()
  async healthCheck() {
    const isHealthy = await this.dbHealthService.checkHealth();
    return {
      status: isHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('detailed')
  async detailedHealthCheck() {
    return this.dbHealthService.getHealthCheckResponse();
  }

  @Get('database')
  async databaseHealth() {
    return this.dbHealthService.getDetailedHealth();
  }
}
