/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { LoggerService } from '@poster-parler/logger';

export interface Response<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
  path: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Response<T>> {
  constructor(@Inject(LoggerService) private readonly logger: LoggerService) {
    this.logger.setContext(ResponseInterceptor.name);
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<Response<T>> {
    const httpCtx = context.switchToHttp();
    const req = httpCtx.getRequest();
    const res = httpCtx.getResponse();
    const { method, url } = req as any;
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        const duration = Date.now() - startTime;
        const statusCode = res?.statusCode ?? 200;

        // Simple success log
        this.logger.log(
          `✓ ${method} ${url} ${statusCode} [${duration}ms]`,
          'HTTP'
        );

        return {
          success: true,
          message: 'Request successful',
          data,
          timestamp: new Date().toISOString(),
          path: req.url,
        } as Response<T>;
      }),
      catchError((err) => {
        const duration = Date.now() - startTime;
        const statusCode = err?.status || 500;

        // Extract the ACTUAL error message
        let errorMessage = 'Request failed';
        let validationErrors: string[] = [];

        if (err instanceof HttpException) {
          const response = err.getResponse();

          if (typeof response === 'object' && response !== null) {
            const responseObj = response as any;

            // Get validation errors if they exist
            if (Array.isArray(responseObj.message)) {
              validationErrors = responseObj.message;
              errorMessage = `Validation failed: ${validationErrors.join(
                ', '
              )}`;
            } else if (responseObj.message) {
              errorMessage = responseObj.message;
            } else if (responseObj.error) {
              errorMessage = responseObj.error;
            }
          } else if (typeof response === 'string') {
            errorMessage = response;
          }
        } else if (err?.message) {
          errorMessage = err.message;
        }

        // Clean, informative error log
        const logMessage = `✗ ${method} ${url} ${statusCode} [${duration}ms] - ${errorMessage}`;

        if (statusCode >= 500) {
          this.logger.error(logMessage, err.stack, 'HTTP');
        } else {
          this.logger.warn(logMessage, 'HTTP');
        }

        return throwError(() => err);
      })
    );
  }
}
