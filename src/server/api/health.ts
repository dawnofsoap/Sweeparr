import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
  });
});

router.get('/ready', async (req, res) => {
  try {
    // Check database connection
    let databaseConnected = false;
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseConnected = true;
    } catch {
      databaseConnected = false;
    }

    // Check if any enabled media servers exist
    const enabledMediaServers = await prisma.mediaServer.count({
      where: { isEnabled: true },
    });

    // Check if any enabled arr apps exist
    const enabledArrApps = await prisma.arrApp.count({
      where: { isEnabled: true },
    });

    res.json({
      status: 'ready',
      checks: {
        database: databaseConnected,
        mediaServer: enabledMediaServers > 0,
        arrApps: enabledArrApps > 0,
      },
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.json({
      status: 'error',
      checks: {
        database: false,
        mediaServer: false,
        arrApps: false,
      },
    });
  }
});

export default router;
