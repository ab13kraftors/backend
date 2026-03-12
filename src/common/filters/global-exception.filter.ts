import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let details: any = undefined;

    let message: string | string[] = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        // Most common case: validation errors return { message: string | string[], ... }
        if ('message' in response) {
          const msg = (response as any).message;
          message = Array.isArray(msg) ? msg : String(msg ?? 'Error');
        } else {
          message = exception.message;
        }
      } else {
        message = exception.message;
      }
    } else {
      // unknown / non-HTTP exception
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );

      if (!isProduction) {
        message = 'Internal server error (dev mode)';
        details = {
          name: exception instanceof Error ? exception.name : 'Unknown',
          message:
            exception instanceof Error ? exception.message : String(exception),
        };
      }
    }

    // Normalize message to always be string or string[]
    const clientMessage =
      Array.isArray(message) && message.length > 0
        ? message.join('. ') // most common choice for validation errors
        : typeof message === 'string'
          ? message
          : 'An unexpected error occurred';

    const payload: any = {
      statusCode: status,
      message: clientMessage,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    if (details && !isProduction) {
      payload.details = details;
    }

    // Optional: add correlation id or trace id in future
    // payload.traceId = request.headers['x-request-id'] || uuid();

    response.status(status).json(payload);
  }
}
