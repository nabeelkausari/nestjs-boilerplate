import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendAlert(alert: {
    severity: 'low' | 'medium' | 'high';
    service: string;
    message: string;
    error?: string;
    timestamp: Date;
  }) {
    // Log the alert
    this.logger.warn(`Alert: ${alert.message}`, {
      ...alert,
    });

    // TODO: Implement your preferred notification method:
    // - Email notifications
    // - Slack notifications
    // - PagerDuty
    // - SMS
    // etc.
  }
}
