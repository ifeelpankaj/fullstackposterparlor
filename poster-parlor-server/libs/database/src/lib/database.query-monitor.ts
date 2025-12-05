import { Logger } from '@nestjs/common';
import { Connection } from 'mongoose';

export function registerQueryMonitor(
  connection: Connection,
  logger: Logger
) {
  const queryTimes = new Map<string, number>();

  connection.on('commandStarted', (event) => {
    if (
      ['find', 'aggregate', 'insert', 'update', 'delete'].includes(
        event.commandName
      )
    ) {
      queryTimes.set(event.requestId.toString(), Date.now());
    }
  });

  connection.on('commandSucceeded', (event) => {
    const req = event.requestId.toString();
    const start = queryTimes.get(req);

    if (start) {
      const duration = Date.now() - start;
      queryTimes.delete(req);

      if (duration > 1000) {
        logger.warn(
          `⚠ Slow query: ${event.commandName} took ${duration}ms`
        );
      }
    }
  });

  connection.on('commandFailed', (event) => {
    queryTimes.delete(event.requestId.toString());
    logger.error(
      `❌ Query failed: ${event.commandName} | ${event.failure}`
    );
  });
}

