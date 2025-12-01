/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  LoggerService as NestLoggerService,
  Inject,
} from '@nestjs/common';
import * as winston from 'winston';
import * as path from 'path';
import * as fs from 'fs';
import { LoggerConfig } from './logger.config';

export interface LogMetadata {
  userId?: string;
  orderId?: string;
  productId?: string;
  transactionId?: string;
  ip?: string;
  userAgent?: string;
  correlationId?: string;
  duration?: number;
  [key: string]: any;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private logger!: winston.Logger;
  private context?: string;
  private readonly sensitiveFields = [
    'password',
    'token',
    'accessToken',
    'refreshToken',
    'creditCard',
    'cvv',
    'ssn',
    'apiKey',
    'secret',
    'authorization',
  ];

  constructor(@Inject('LOGGER_CONFIG') private config: LoggerConfig) {
    this.initializeLogger();
  }

  // -- helpers for safe stringify (handles circular refs) --
  private static getCircularReplacer() {
    const seen = new WeakSet();
    return (_key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
      }
      return value;
    };
  }

  private safeStringify(obj: any) {
    try {
      // Convert null-prototype objects to plain objects first
      if (
        obj &&
        typeof obj === 'object' &&
        Object.getPrototypeOf(obj) === null
      ) {
        obj = Object.assign({}, obj);
      }
      return JSON.stringify(obj, LoggerService.getCircularReplacer());
    } catch {
      try {
        return String(obj);
      } catch {
        return '[Unserializable]';
      }
    }
  }

  private initializeLogger() {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.config.logsDir)) {
      fs.mkdirSync(this.config.logsDir, { recursive: true });
    }

    // Define log format
    const logFormat = winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.printf(
        ({ timestamp, level, message, context, trace, ...meta }) => {
          // context: if object, stringify; if string, keep
          let ctxStr = '';
          if (context !== undefined && context !== null) {
            ctxStr =
              typeof context === 'string'
                ? `[${context}]`
                : `[${this.safeStringify(this.maskSensitiveData(context))}]`;
          }

          const service = `[${this.config.serviceName}]`;

          // meta: mask sensitive fields and stringify if present
          const metaObj = { ...meta };
          delete (metaObj as any)['context'];
          delete (metaObj as any)['trace'];

          const metaStr = Object.keys(metaObj).length
            ? ` | ${this.safeStringify(this.maskSensitiveData(metaObj))}`
            : '';

          const traceStr = trace ? `\n${trace}` : '';

          // message: if object/array, stringify safely
          const msgStr =
            typeof message === 'string' ? message : this.safeStringify(message);

          return `${timestamp} ${service} [${level.toUpperCase()}] ${ctxStr} ${msgStr}${metaStr}${traceStr}`;
        }
      )
    );

    // Console format with colors and pretty meta
    // inside your consoleFormat definition
    const consoleFormat = winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
      winston.format.printf(
        ({ timestamp, level, message, context, trace, ...meta }) => {
          let ctxStr = '';
          if (context !== undefined && context !== null) {
            ctxStr =
              typeof context === 'string'
                ? `[${context}]`
                : `[${this.safeStringify(this.maskSensitiveData(context))}]`;
          }

          const metaObj = { ...meta };
          delete (metaObj as any)['context'];
          delete (metaObj as any)['trace'];

          const metaStr = Object.keys(metaObj).length
            ? `\n  ${JSON.stringify(this.maskSensitiveData(metaObj), null, 2)}`
            : '';

          const traceStr = trace ? `\n${trace}` : '';
          const msgStr =
            typeof message === 'string' ? message : this.safeStringify(message);

          return `${timestamp} ${level} ${ctxStr} ${msgStr}${metaStr}${traceStr}`;
        }
      )
    );

    // Configure transports
    const transports: winston.transport[] = [
      // Error logs
      new winston.transports.File({
        filename: path.join(this.config.logsDir, 'error.log'),
        level: 'error',
        format: logFormat,
        maxsize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
      }),
      // Warning logs
      new winston.transports.File({
        filename: path.join(this.config.logsDir, 'warn.log'),
        level: 'warn',
        format: logFormat,
        maxsize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
      }),
      // Combined logs
      new winston.transports.File({
        filename: path.join(this.config.logsDir, 'combined.log'),
        format: logFormat,
        maxsize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
      }),
      // Business events (orders, payments, etc.)
      new winston.transports.File({
        filename: path.join(this.config.logsDir, 'business.log'),
        level: 'info',
        format: logFormat,
        maxsize: this.config.maxFileSize,
        maxFiles: this.config.maxFiles,
      }),
    ];

    // Add console transport if enabled
    if (this.config.enableConsole) {
      transports.push(
        new winston.transports.Console({
          format: consoleFormat,
        })
      );
    }

    this.logger = winston.createLogger({
      level: process.env['LOG_LEVEL'] || 'info',
      transports,
      exitOnError: false,
    });
  }

  private maskSensitiveData(obj: any): any {
    if (!this.config.enableSensitiveDataMasking) {
      return obj;
    }

    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.maskSensitiveData(item));
    }

    const masked: any = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();
      const isSensitive = this.sensitiveFields.some((field) =>
        lowerKey.includes(field.toLowerCase())
      );

      if (isSensitive) {
        masked[key] = '***MASKED***';
      } else if (typeof value === 'object' && value !== null) {
        masked[key] = this.maskSensitiveData(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  setContext(context: string) {
    this.context = context;
  }

  // Normalize caller-supplied context: if object -> treat as meta, if string -> keep as context
  private normalizeContextAndMeta(
    contextOrMeta?: any,
    fallbackContext?: string
  ) {
    let ctx = fallbackContext ?? this.context;
    let meta: any = {};

    if (contextOrMeta === undefined || contextOrMeta === null) {
      // nothing passed
      return { ctx, meta };
    }

    if (typeof contextOrMeta === 'string') {
      ctx = contextOrMeta;
    } else if (typeof contextOrMeta === 'object') {
      meta = contextOrMeta;
    } else {
      // number/boolean => convert to string context
      ctx = String(contextOrMeta);
    }

    return { ctx, meta };
  }

  log(message: any, contextOrMeta?: any) {
    const { ctx, meta } = this.normalizeContextAndMeta(
      contextOrMeta,
      undefined
    );
    const msg =
      typeof message === 'string' ? message : this.safeStringify(message);
    this.logger.info(msg, { ...this.maskSensitiveData(meta), context: ctx });
  }

  error(message: any, trace?: string | Error, contextOrMeta?: any) {
    const { ctx, meta } = this.normalizeContextAndMeta(
      contextOrMeta,
      undefined
    );
    const traceStr =
      trace instanceof Error
        ? trace.stack ?? trace.message
        : typeof trace === 'string'
        ? trace
        : undefined;
    const msg =
      typeof message === 'string' ? message : this.safeStringify(message);
    this.logger.error(msg, {
      ...this.maskSensitiveData(meta),
      context: ctx,
      trace: traceStr,
    });
  }

  warn(message: any, contextOrMeta?: any) {
    const { ctx, meta } = this.normalizeContextAndMeta(
      contextOrMeta,
      undefined
    );
    const msg =
      typeof message === 'string' ? message : this.safeStringify(message);
    this.logger.warn(msg, { ...this.maskSensitiveData(meta), context: ctx });
  }

  debug(message: any, contextOrMeta?: any) {
    const { ctx, meta } = this.normalizeContextAndMeta(
      contextOrMeta,
      undefined
    );
    const msg =
      typeof message === 'string' ? message : this.safeStringify(message);
    this.logger.debug(msg, { ...this.maskSensitiveData(meta), context: ctx });
  }

  verbose(message: any, contextOrMeta?: any) {
    const { ctx, meta } = this.normalizeContextAndMeta(
      contextOrMeta,
      undefined
    );
    const msg =
      typeof message === 'string' ? message : this.safeStringify(message);
    this.logger.verbose(msg, { ...this.maskSensitiveData(meta), context: ctx });
  }

  // E-commerce specific logging methods
  logOrder(action: string, orderId: string, metadata?: LogMetadata) {
    this.logger.info(`Order ${action}`, {
      context: this.context || 'OrderService',
      orderId,
      ...this.maskSensitiveData(metadata),
    });
  }

  logPayment(action: string, transactionId: string, metadata?: LogMetadata) {
    this.logger.info(`Payment ${action}`, {
      context: this.context || 'PaymentService',
      transactionId,
      ...this.maskSensitiveData(metadata),
    });
  }

  logUser(action: string, userId: string, metadata?: LogMetadata) {
    this.logger.info(`User ${action}`, {
      context: this.context || 'UserService',
      userId,
      ...this.maskSensitiveData(metadata),
    });
  }

  logProduct(action: string, productId: string, metadata?: LogMetadata) {
    this.logger.info(`Product ${action}`, {
      context: this.context || 'ProductService',
      productId,
      ...this.maskSensitiveData(metadata),
    });
  }

  // HTTP request logging
  logHttpRequest(
    method: string,
    url: string,
    statusCode: number,
    metadata?: LogMetadata
  ) {
    const level =
      statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
    this.logger.log(level, `${method} ${url} ${statusCode}`, {
      context: 'HTTP',
      method,
      url,
      statusCode,
      ...this.maskSensitiveData(metadata),
    });
  }

  // Performance logging
  logPerformance(operation: string, duration: number, metadata?: LogMetadata) {
    const level = duration > 1000 ? 'warn' : 'info';
    this.logger.log(level, `Performance: ${operation} took ${duration}ms`, {
      context: 'Performance',
      operation,
      duration,
      ...this.maskSensitiveData(metadata),
    });
  }

  // Security logging
  logSecurity(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    metadata?: LogMetadata
  ) {
    const level =
      severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this.logger.log(level, `Security Event: ${event}`, {
      context: 'Security',
      event,
      severity,
      ...this.maskSensitiveData(metadata),
    });
  }

  // Audit logging
  logAudit(action: string, actor: string, metadata?: LogMetadata) {
    this.logger.info(`Audit: ${action}`, {
      context: 'Audit',
      action,
      actor,
      timestamp: new Date().toISOString(),
      ...this.maskSensitiveData(metadata),
    });
  }

  // Generic log with metadata — still useful for structured logging
  logWithMeta(
    level: string,
    message: string,
    meta: LogMetadata,
    context?: string
  ) {
    this.logger.log(level, message, {
      ...this.maskSensitiveData(meta),
      context: context || this.context,
    });
  }
}
