import { Logger } from '@nestjs/common';
import { AppConfigService } from '@poster-parlor-api/config';

export function buildMongoConfig(appConfigService: AppConfigService) {
  const logger = new Logger('DatabaseConfig');

  const dbUrl = appConfigService.appConfig.dburl;
  const dbName = appConfigService.appConfig.dbname;

  if (!dbUrl) {
    throw new Error('DATABASE_URL (dburl) is missing');
  }

  if (!dbName) {
    throw new Error('DB_NAME (dbname) is missing');
  }

  const isProduction = appConfigService.isProduction;
  const poolSize = 10;
  const minPoolSize = Math.floor(poolSize * 0.2);

  logger.log(
    `Connecting to ${dbName} at ${dbUrl.replace(/\/\/.*:.*@/, '//***:***@')}`
  );

  return {
    uri: dbUrl,
    dbName,

    serverSelectionTimeoutMS: isProduction ? 30000 : 5000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,

    maxPoolSize: poolSize,
    minPoolSize: minPoolSize,

    retryAttempts: 5,
    retryDelay: 2000,

    autoIndex: !isProduction,
    autoCreate: !isProduction,

    tls: isProduction,
    tlsAllowInvalidCertificates: false,

    readPreference: 'primaryPreferred',
    w: 'majority',
    journal: true,

    compressors: ['zlib'],
    zlibCompressionLevel: 6,
  };
}

