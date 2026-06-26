/**
 * @file jobs/iss-poller.ts
 * @description Background job that continuously polls the ISS position
 * and publishes updates to Kafka for real-time WebSocket distribution.
 *
 * Poll interval is configurable via ISS_POLLING_INTERVAL_MS (default: 5000ms).
 * This job is started once at server boot and stopped on graceful shutdown.
 */

import { getISSPosition } from '../services/iss.service';
import logger from '../lib/logger';

/**
 * Starts the ISS position polling loop.
 *
 * @returns A stop function to cancel the polling loop
 */
export function startISSPoller(): () => void {
  const intervalMs = parseInt(process.env['ISS_POLLING_INTERVAL_MS'] ?? '5000', 10);
  let running = true;

  logger.info({ intervalMs }, 'ISS poller starting');

  // Use a recursive setTimeout rather than setInterval to prevent
  // overlapping calls if the fetch takes longer than the interval
  const poll = async (): Promise<void> => {
    if (!running) return;

    try {
      await getISSPosition();
      // ISS position is published to Kafka inside getISSPosition()
    } catch (err) {
      // Only log — don't crash the process on transient network errors
      logger.warn(err, 'ISS poller: fetch failed — will retry');
    }

    if (running) {
      setTimeout(() => {
        void poll();
      }, intervalMs);
    }
  };

  // Kick off immediately then schedule
  void poll();

  return () => {
    logger.info('ISS poller stopping');
    running = false;
  };
}
