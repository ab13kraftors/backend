import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// Catching ALL unhandled exceptions
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  // Logger instance for internal error logging
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  // ================== catch ==================
  // Global handler for all application exceptions
  catch(exception: unknown, host: ArgumentsHost) {
    // Switch execution context to HTTP
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Default response values for unexpected errors
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';

    // Handle known HTTP exceptions
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      // Extract message from response object if available
      message =
        typeof res === 'object' && 'message' in (res as any)
          ? (res as any).message
          : exception.message;
    } else {
      // Log unexpected errors internally
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Send standardized error response
    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
