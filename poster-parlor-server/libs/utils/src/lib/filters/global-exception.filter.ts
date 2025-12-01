/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { MongoError, MongoServerError } from 'mongodb';
import { Error as MongooseError } from 'mongoose';
import { LoggerService } from '@poster-parler/logger';
import { ErrorResponse, ValidationError } from '@poster-parler/common';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(@Inject(LoggerService) private readonly logger: LoggerService) {
    this.logger.setContext(GlobalExceptionFilter.name);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const path = request.url;

    let errorResponse: ErrorResponse;

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      errorResponse = this.handleHttpException(exception, path);
    } else if (this.isMongoError(exception)) {
      errorResponse = this.handleMongoError(exception as any, path);
    } else if (exception instanceof MongooseError.ValidationError) {
      errorResponse = this.handleMongooseValidationError(exception, path);
    } else if (exception instanceof MongooseError.CastError) {
      errorResponse = this.handleMongoCastError(exception, path);
    } else {
      errorResponse = this.handleGenericError(exception, path);
    }

    // Simple, informative error log
    this.logError(exception, request, errorResponse);

    response.status(errorResponse.statusCode).json(errorResponse);
  }

  private isMongoError(exception: unknown): boolean {
    return (
      exception instanceof MongoError ||
      exception instanceof MongoServerError ||
      (exception as any)?.name === 'MongoServerError' ||
      (exception as any)?.name === 'MongoError' ||
      typeof (exception as any)?.code === 'number'
    );
  }

  private handleHttpException(
    exception: HttpException,
    path: string
  ): ErrorResponse {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = 'An error occurred';
    let validationErrors: ValidationError[] = [];
    let details: any = null;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (typeof exceptionResponse === 'object') {
      const response = exceptionResponse as any;
      message = response.message || response.error || message;

      if (response.message && Array.isArray(response.message)) {
        validationErrors = response.message.map((msg: string) => ({
          field: this.extractFieldFromMessage(msg),
          message: msg,
        }));
        message = 'Validation failed';
      }

      details = response.details;
    }

    return {
      success: false,
      message,
      error: {
        code: this.getErrorCode(status),
        details,
        ...(validationErrors.length > 0 && { validationErrors }),
      },
      statusCode: status,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private handleMongoError(exception: any, path: string): ErrorResponse {
    let message = 'Database error occurred';
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let details: any = undefined;

    if (exception.code === 11000) {
      message = 'Resource already exists';
      statusCode = HttpStatus.CONFLICT;

      const field = this.extractDuplicateField(exception);
      details = {
        field,
        message: `${field} already exists`,
      };
    }

    return {
      success: false,
      message,
      error: {
        code: exception.code === 11000 ? 'DUPLICATE_KEY' : 'DATABASE_ERROR',
        details:
          process.env['NODE_ENV'] === 'development'
            ? details || exception.message
            : details,
      },
      statusCode,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private extractDuplicateField(exception: any): string {
    try {
      if (exception.keyPattern) {
        return Object.keys(exception.keyPattern)[0];
      }

      const match = exception.message?.match(/index: (\w+)_\d+/);
      if (match) return match[1];

      const dupKeyMatch = exception.message?.match(/dup key: \{ (\w+):/);
      if (dupKeyMatch) return dupKeyMatch[1];
    } catch (e) {
      this.logger.warn('Could not extract duplicate field name', {
        error: e instanceof Error ? e.message : 'unknown',
      });
    }

    return 'field';
  }

  private handleMongooseValidationError(
    exception: MongooseError.ValidationError,
    path: string
  ): ErrorResponse {
    const validationErrors: ValidationError[] = Object.values(
      exception.errors
    ).map((error) => ({
      field: error.path,
      message: error.message,
    }));

    return {
      success: false,
      message: 'Validation failed',
      error: {
        code: 'VALIDATION_ERROR',
        validationErrors,
      },
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private handleMongoCastError(
    exception: MongooseError.CastError,
    path: string
  ): ErrorResponse {
    return {
      success: false,
      message: `Invalid ${exception.path}: ${exception.value}`,
      error: {
        code: 'INVALID_ID',
        details: {
          field: exception.path,
          value: exception.value,
        },
      },
      statusCode: HttpStatus.BAD_REQUEST,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private handleGenericError(exception: unknown, path: string): ErrorResponse {
    const message =
      exception instanceof Error ? exception.message : 'Internal server error';

    return {
      success: false,
      message: 'Internal server error',
      error: {
        code: 'INTERNAL_ERROR',
        details:
          process.env['NODE_ENV'] === 'development' ? message : undefined,
      },
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      timestamp: new Date().toISOString(),
      path,
    };
  }

  private getErrorCode(status: HttpStatus): string {
    const codes: Record<number, string> = {
      [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
      [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
      [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
      [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
      [HttpStatus.CONFLICT]: 'CONFLICT',
      [HttpStatus.UNPROCESSABLE_ENTITY]: 'VALIDATION_ERROR',
      [HttpStatus.INTERNAL_SERVER_ERROR]: 'INTERNAL_ERROR',
    };
    return codes[status] || 'UNKNOWN_ERROR';
  }

  private extractFieldFromMessage(message: string): string {
    const words = message.split(' ');
    return words[0] || 'unknown';
  }

  private logError(
    exception: unknown,
    request: Request,
    errorResponse: ErrorResponse
  ) {
    const { method, url, headers } = request;
    const user = (request as any).user;
    const statusCode = errorResponse.statusCode;

    // Get the actual error details
    let errorDetails = errorResponse.message;
    if (errorResponse.error.validationErrors) {
      const validationMsgs = errorResponse.error.validationErrors
        .map((e) => e.message)
        .join(', ');
      errorDetails = validationMsgs;
    }

    // Simple one-line log
    const logMessage = `✗ ${method} ${url} ${statusCode} - ${errorDetails}`;

    // Only show detailed metadata in development or for 500 errors
    const shouldShowDetails =
      process.env['NODE_ENV'] === 'development' || statusCode >= 500;

    if (statusCode >= 500) {
      // Server errors: show stack trace
      const stack = exception instanceof Error ? exception.stack : undefined;

      if (shouldShowDetails) {
        this.logger.error(logMessage, stack, {
          userId: user?.id || user?.sub,
          ip: headers['x-forwarded-for'] || headers['x-real-ip'] || request.ip,
        });
      } else {
        this.logger.error(logMessage, stack, 'HTTP');
      }
    } else if (statusCode >= 400) {
      // Client errors: simple warning
      if (shouldShowDetails) {
        this.logger.warn(logMessage, {
          userId: user?.id || user?.sub,
          errorCode: errorResponse.error.code,
        });
      } else {
        this.logger.warn(logMessage, 'HTTP');
      }
    }

    // Log security events for auth issues
    if (statusCode === HttpStatus.UNAUTHORIZED) {
      this.logger.logSecurity('Unauthorized access attempt', 'medium', {
        url,
        ip: (headers['x-forwarded-for'] as string) || request.ip,
      });
    } else if (statusCode === HttpStatus.FORBIDDEN) {
      this.logger.logSecurity('Forbidden access attempt', 'high', {
        url,
        userId: user?.id || user?.sub,
      });
    }
  }
}
