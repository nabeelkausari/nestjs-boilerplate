import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsService } from './notifications.service';
import { NotifyEmailDto } from './dto/notify-email.dto';
import {
  disableLogging,
  setupTestLogging,
  restoreTestLogging,
} from '@app/common';

describe('NotificationsService', () => {
  let service: NotificationsService;

  beforeAll(async () => {
    setupTestLogging();
  });

  afterAll(async () => {
    restoreTestLogging();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsService],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('notifyEmail', () => {
    it('should process email notification', async () => {
      const notifyEmailDto: NotifyEmailDto = {
        email: 'test@example.com',
      };

      const consoleSpy = jest.spyOn(console, 'log');

      await service.notifyEmail(notifyEmailDto);

      expect(consoleSpy).toHaveBeenCalledWith(notifyEmailDto);
      consoleSpy.mockRestore();
    });
  });
});
