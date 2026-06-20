/**
 * @file lib/kafka.ts
 * @description KafkaJS producer singleton for publishing real-time events
 * to the Zenith event streaming platform.
 *
 * Topics published:
 *  - zenith.iss.position       — ISS real-time position updates
 *  - zenith.satellite.positions — Multi-satellite position snapshots
 *  - zenith.tle.refresh        — TLE data refresh notifications
 */

import { Kafka, type Producer, type Message, CompressionTypes } from 'kafkajs';

import logger from './logger';

let producer: Producer | null = null;

/**
 * Initialises and connects the Kafka producer.
 * @returns A cleanup function to gracefully disconnect the producer.
 */
export async function createKafkaProducer(): Promise<() => Promise<void>> {
  const brokers = (process.env['KAFKA_BROKERS'] ?? 'localhost:29092').split(',');

  const kafka = new Kafka({
    clientId: 'satellite-service',
    brokers,
    retry: {
      initialRetryTime: 300,
      retries: 8,
    },
    logCreator: () => ({ log }) => {
      const { message, ...extra } = log;
      logger.debug(extra, `[Kafka] ${message}`);
    },
  });

  producer = kafka.producer({
    allowAutoTopicCreation: false,
    idempotent: true, // Exactly-once semantics
    transactionTimeout: 30000,
  });

  await producer.connect();
  logger.info({ brokers }, 'Kafka producer connected');

  return async () => {
    if (producer) {
      await producer.disconnect();
      logger.info('Kafka producer disconnected');
    }
  };
}

/**
 * Publishes one or more messages to a Kafka topic.
 *
 * @param topic   - Kafka topic name (e.g. 'zenith.iss.position')
 * @param messages - Array of {key, value} message objects. Value is JSON-serialised.
 */
export async function publishToKafka(
  topic: string,
  messages: Array<{ key?: string; value: unknown }>,
): Promise<void> {
  if (!producer) {
    logger.warn({ topic }, 'Kafka producer not available — event dropped');
    return;
  }

  const kafkaMessages: Message[] = messages.map(({ key, value }) => ({
    key: key ?? null,
    value: JSON.stringify(value),
    headers: {
      source: 'satellite-service',
      timestamp: Date.now().toString(),
    },
  }));

  try {
    await producer.send({
      topic,
      compression: CompressionTypes.GZIP,
      messages: kafkaMessages,
    });
  } catch (err) {
    // Log and swallow — Kafka failure should NOT crash the REST API
    logger.error({ topic, err }, 'Failed to publish Kafka event');
  }
}

/** Kafka topic name constants */
export const KAFKA_TOPICS = {
  ISS_POSITION: 'zenith.iss.position',
  SATELLITE_POSITIONS: 'zenith.satellite.positions',
  SATELLITE_PASSES: 'zenith.satellite.passes',
  TLE_REFRESH: 'zenith.tle.refresh',
} as const;
