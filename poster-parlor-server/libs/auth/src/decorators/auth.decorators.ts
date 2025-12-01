import {
  SetMetadata,
  UseGuards,
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';

import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { UserRole } from '@poster-parler/models';
import { RolesGuard } from '../guards/role.guard';
import { AuthenticatedUser, RequestWithUser } from '@poster-parler/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const ROLES_KEY = 'roles';

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

export const Auth = (...roles: UserRole[]) => {
  if (roles.length === 0) {
    return applyDecorators(UseGuards(JwtAuthGuard));
  }

  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard), Roles(...roles));
};

export const CurrentUser = createParamDecorator(
  (
    data: keyof AuthenticatedUser | undefined,
    ctx: ExecutionContext
  ): AuthenticatedUser | string => {
    const request = ctx.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    return data ? user[data] : user;
  }
);
