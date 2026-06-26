import { z } from 'zod';

export const KafkaSchemas = {
  ISS_POSITION: z.object({
    noradId: z.number(),
    latitude: z.number(),
    longitude: z.number(),
    altitude: z.number(),
    velocity: z.number(),
    timestamp: z.number(),
  }),
  SATELLITE_POSITIONS: z.object({
    satellites: z.array(z.object({
      noradId: z.number(),
      latitude: z.number(),
      longitude: z.number(),
      altitude: z.number(),
    })),
    timestamp: z.number(),
  }),
  PLANETARY_EPHEMERIS: z.object({
    bodyName: z.string(),
    coordinates: z.object({
      x: z.number(),
      y: z.number(),
      z: z.number(),
    }),
    velocity: z.object({
      vx: z.number(),
      vy: z.number(),
      vz: z.number(),
    }),
    epoch: z.string(),
  }),
};

export type KafkaMessage = {
  [K in keyof typeof KafkaSchemas]: z.infer<typeof KafkaSchemas[K]>;
};
