import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from '../src/notifications.controller';
import { NotificationsService } from '../src/notifications.service';
import { NotifyEmailDto } from '../src/dto/notify-email.dto';
import {
  disableLogging,
  setupTestLogging,
  restoreTestLogging,
} from '@app/common';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

describe('Notifications Integration Tests', () => {
  let controller: NotificationsController;
  let service: NotificationsService;

  beforeAll(async () => {
    setupTestLogging();
  });

  afterAll(async () => {
    restoreTestLogging();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [NotificationsService],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationsService>(NotificationsService);
  });

  describe('notifyEmail', () => {
    it('should successfully process email notification event', async () => {
      const notifyEmailDto: NotifyEmailDto = {
        email: 'test@example.com',
      };

      const serviceSpy = jest.spyOn(service, 'notifyEmail');

      await controller.notifyEmail(notifyEmailDto);

      expect(serviceSpy).toHaveBeenCalledWith(notifyEmailDto);
    });

    it('should throw validation error for invalid email', async () => {
      const invalidEmailDto = {
        email: 'invalid-email',
      };

      const dto = plainToInstance(NotifyEmailDto, invalidEmailDto);
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].constraints).toHaveProperty('isEmail');
    });
  });
});
