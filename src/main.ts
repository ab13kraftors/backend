import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AccountsService } from './accounts/accounts.service';

async function bootstrap() {
  // Validate all env vars at startup
  const required = [
    'JWT_SECRET',
    'AES_SECRET',
    // 'FRONTEND_URL',
    'DB_HOST',
    'DB_PORT',
    'DB_USER',
    'DB_PASS',
    'DB_NAME',
  ];

  for (const key of required) {
    if (!process.env[key])
      throw new Error(`Missing required environment variable: ${key}`);
  }

  if (process.env.AES_SECRET!.length !== 64) {
    throw new Error('AES_SECRET must be exactly 64 hex characters (32 bytes)');
  }

  const app = await NestFactory.create(AppModule);

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.use(
    helmet({
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
      contentSecurityPolicy: {
        directives: { defaultSrc: ["'self'"] },
      },
    }),
  );

  app.use(cookieParser());

  // Modern CSRF Configuration (csrf-csrf)
  // src/main.ts

  const { doubleCsrfProtection } = doubleCsrf({
    getSecret: () =>
      process.env.JWT_SECRET || '13dddefc0b865032b849ac0e6bd8d2c0',
    cookieName: 'x-csrf-token',
    // ADD THIS: A function that returns a unique ID for the current user/session
    getSessionIdentifier: (req) => {
      // For now, use the participant-id header or a fallback for dev
      return (req.headers['participant-id'] as string) || 'guest-session';
    },
    cookieOptions: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
    size: 64,
    ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
    getCsrfTokenFromRequest: (req) => {
      const token = req.headers['x-xsrf-token'];
      return Array.isArray(token) ? token[0] : token;
    },
  });

  if (process.env.NODE_ENV === 'production') {
    app.use(doubleCsrfProtection);
  }

  app.enableCors({
    origin: process.env.FRONTEND_URL || true, // remove true when have frontend
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'participant-id',
      'X-XSRF-Token',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const accountsService = app.get(AccountsService);
  await accountsService.ensureSystemAccounts();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
