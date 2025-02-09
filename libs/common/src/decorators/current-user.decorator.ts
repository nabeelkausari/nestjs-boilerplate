import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserDto } from '../dto';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): UserDto => {
    const request = context.switchToHttp().getRequest();
    return request.user;
  },
);
