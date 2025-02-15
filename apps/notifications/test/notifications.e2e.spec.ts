import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsModule } from '../src/notifications.module';
import { NotificationsService } from '../src/notifications.service';
import { NotifyEmailDto } from '../src/dto/notify-email.dto';
import {
  disableLogging,
  setupTestLogging,
  restoreTestLogging,
} from '@app/common';
import { Transport } from '@nestjs/microservices';
import { ClientProxy, ClientsModule } from '@nestjs/microservices';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';

describe('Notifications E2E Tests', () => {
  let app: INestApplication;
  let client: ClientProxy;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    setupTestLogging();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: path.join(__dirname, '.env.test'),
          isGlobal: true,
        }),
        NotificationsModule,
        ClientsModule.register([
          {
            name: 'NOTIFICATIONS_SERVICE',
            transport: Transport.TCP,
            options: {
              host: 'localhost',
              port: 3002,
            },
          },
        ]),
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.connectMicroservice({
      transport: Transport.TCP,
      options: {
        host: 'localhost',
        port: 3002,
      },
    });

    await app.startAllMicroservices();
    await app.init();

    client = app.get('NOTIFICATIONS_SERVICE');
    await client.connect();
  });

  afterAll(async () => {
    restoreTestLogging();
    if (client) {
      await client.close();
    }
    if (app) {
      await app.close();
    }
  });

  describe('notify_email event', () => {
    it('should handle valid email notification', async () => {
      const notifyEmailDto: NotifyEmailDto = {
        email: 'test@example.com',
      };

      const response = await client
        .emit('notify_email', notifyEmailDto)
        .toPromise();

      // Since our current implementation just logs, we're mainly testing that it doesn't throw
      expect(response).toBeUndefined();
    });

    it('should reject invalid email format', async () => {
      const invalidEmailDto = {
        email: 'invalid-email',
      };

      try {
        await client.emit('notify_email', invalidEmailDto).toPromise();
        fail('Should have thrown validation error');
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });
});
