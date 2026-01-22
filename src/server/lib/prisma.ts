import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Create and export Prisma client
export const prisma = new PrismaClient({
  log: [
    { emit: 'stdout', level: 'query' },
    { emit: 'stdout', level: 'error' },
    { emit: 'stdout', level: 'warn' },
  ],
});

// Test connection on startup
prisma.$connect()
  .then(() => logger.info('✅ Prisma connected to database'))
  .catch((err) => logger.error(`❌ Prisma connection failed: ${err}`));

// For backwards compatibility, also export as default
export default prisma;
