import { AuthGuard } from '@nestjs/passport';
import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
//   async canActivate(context: ExecutionContext) {
//     const req = context.switchToHttp().getRequest();
//     const token = this.extractor(req); // Existing
//     const payload = this.jwtService.verify(token);
//     if (payload.ip !== req.ip)
//       throw new UnauthorizedException('IP mismatch (security)');
//     if (await this.authService.isTokenBlacklisted(token))
//       throw new UnauthorizedException('Token revoked');
//     req.user = payload;
//     return true;
//   }
}
