import { Logger } from '@nestjs/common';
import { Connection } from 'mongoose';
import { registerQueryMonitor } from './database.query-monitor';

export function setupMongoConnection(
  connection: Connection,
  dbName: string,
  isProduction: boolean
) {
  const logger = new Logger('MongoConnection');

  connection.on('connected', () => {
    logger.log(`MongoDB connected to ${dbName}`);
  });

  connection.on('reconnected', () => {
    logger.log('MongoDB reconnected');
  });

  connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  connection.on('close', () => {
    logger.warn('MongoDB connection closed');
  });

  if (isProduction) {
    registerQueryMonitor(connection, logger);
  }

  return connection;
}

