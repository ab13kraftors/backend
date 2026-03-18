import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from 'src/common/decorators/auth/roles.decorator';
import { Role } from 'src/common/enums/auth.enums';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const validRoles = Object.values(Role);
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.roles || !Array.isArray(user.roles)) {
      throw new ForbiddenException('No roles found — access denied');
    }

    // Normalize and filter user roles
    const normalizedUserRoles: Role[] = user.roles
      .map((r: string) => r.toLowerCase())
      .filter((r: string) => validRoles.includes(r as Role)) as Role[];

    if (normalizedUserRoles.length === 0)
      throw new ForbiddenException('Invalid role set');

    // Normalize required roles too, for consistency
    const normalizedRequiredRoles = requiredRoles.map((r) => r.toLowerCase());

    const hasRole = normalizedUserRoles.some((role) =>
      normalizedRequiredRoles.includes(role),
    );

    if (!hasRole)
      throw new ForbiddenException('Access denied: Insufficient permission');

    return true;
  }
}
