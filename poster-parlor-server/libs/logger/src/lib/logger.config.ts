/* eslint-disable @typescript-eslint/no-explicit-any */
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

export const tsFormat = (): string => {
  const now = new Date();

  // Convert to IST (UTC+5:30)
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const istTime = new Date(now.getTime() + istOffset);

  // Month names
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  // Extract date parts
  const day = String(istTime.getUTCDate()).padStart(2, '0');
  const month = months[istTime.getUTCMonth()];
  const year = istTime.getUTCFullYear();
  const hours = String(istTime.getUTCHours()).padStart(2, '0');
  const minutes = String(istTime.getUTCMinutes()).padStart(2, '0');
  const seconds = String(istTime.getUTCSeconds()).padStart(2, '0');

  // Format: "02 Dec 2025 15:30:45"
  return `${day} ${month} ${year} ${hours}:${minutes}:${seconds}`;
};

// Custom JSON format for file logs
const productionFormat = winston.format.printf(
  ({ timestamp, level, message, context, trace, error, ...metadata }) => {
    const logObject: any = {
      '@timestamp': timestamp,
      level: level.toUpperCase(),
      message,
      context: context || 'Application',
    };

    // Add error details if present
    if (error) {
      logObject.error = error;
    }

    // Add stack trace if present
    if (trace) {
      logObject.trace = trace;
    }

    // Add any additional metadata
    if (Object.keys(metadata).length > 0) {
      Object.assign(logObject, metadata);
    }

    return JSON.stringify(logObject);
  }
);

export const loggerConfig = {
  format: winston.format.combine(
    winston.format.timestamp({ format: tsFormat }),
    winston.format.errors({ stack: true })
  ),

  transports: [
    // Console - Pretty format for development
    new winston.transports.Console({
      level: process.env['NODE_ENV'] === 'production' ? 'info' : 'debug',
      format: winston.format.combine(
        winston.format.colorize(),
        nestWinstonModuleUtilities.format.nestLike('PosterParler', {
          prettyPrint: true,
          colors: true,
        })
      ),
    }),

    // INFO logs (includes info, warn, debug)
    new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'info-%DATE%.log',
      level: 'info',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: winston.format.combine(
        winston.format.timestamp({ format: tsFormat }),
        productionFormat
      ),
    }),

    // ERROR logs only
    new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'error-%DATE%.log',
      level: 'error',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      format: winston.format.combine(
        winston.format.timestamp({ format: tsFormat }),
        productionFormat
      ),
    }),
  ],

  // Handle uncaught exceptions - save to error log
  exceptionHandlers: [
    new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      format: winston.format.combine(
        winston.format.timestamp({ format: tsFormat }),
        productionFormat
      ),
    }),
  ],

  // Handle unhandled promise rejections - save to error log
  rejectionHandlers: [
    new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '90d',
      format: winston.format.combine(
        winston.format.timestamp({ format: tsFormat }),
        productionFormat
      ),
    }),
  ],
};
