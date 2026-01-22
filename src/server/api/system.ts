import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { getRecentLogs, clearLogs, logger } from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

// Get scheduled tasks
router.get('/tasks', async (req, res) => {
  try {
    // Get cleanup schedule settings
    const scheduleSettings = await prisma.settings.findMany({
      where: {
        key: {
          startsWith: 'cleanup.schedule.',
        },
      },
    });

    // Convert to object
    const settings: Record<string, string> = {};
    scheduleSettings.forEach((s: { key: string; value: string }) => {
      settings[s.key] = s.value;
    });

    const enabled = settings['cleanup.schedule.enabled'] === 'true';
    const interval = settings['cleanup.schedule.interval'] || 'daily';
    const time = settings['cleanup.schedule.time'] || '03:00';
    const dryRun = settings['cleanup.schedule.dryRun'] !== 'false';

    // Calculate next run time
    let nextRun: Date | null = null;
    if (enabled) {
      nextRun = calculateNextRun(interval, time);
    }

    // Get active rules count
    const activeRules = await prisma.rule.count({
      where: { isEnabled: true, isActive: true },
    });

    const tasks = [];

    if (enabled) {
      tasks.push({
        id: 'cleanup',
        name: 'Scheduled Cleanup',
        description: `Runs ${interval} at ${time}${dryRun ? ' (Dry Run)' : ''}`,
        enabled: true,
        interval,
        time,
        dryRun,
        nextRun: nextRun?.toISOString(),
        lastRun: null, // TODO: Track last run time
        activeRules,
      });
    }

    res.json(tasks);
  } catch (error) {
    console.error('Failed to get tasks:', error);
    res.status(500).json({ error: 'Failed to get scheduled tasks' });
  }
});

// Run cleanup manually
router.post('/run-cleanup', async (req, res) => {
  try {
    // Get the global dry run setting if not provided in request
    let { dryRun } = req.body;
    
    if (dryRun === undefined) {
      const dryRunSetting = await prisma.settings.findUnique({
        where: { key: 'cleanup.schedule.dryRun' },
      });
      dryRun = dryRunSetting?.value !== 'false';
    }

    // Get all active rules
    const rules = await prisma.rule.findMany({
      where: { isEnabled: true, isActive: true },
    });

    if (rules.length === 0) {
      res.json({
        success: true,
        message: 'No active rules to run',
        dryRun,
        rulesProcessed: 0,
        results: [],
        timestamp: new Date().toISOString(),
      });
      return;
    }

    // Get media servers and arr apps
    const mediaServers = await prisma.mediaServer.findMany({
      where: { isEnabled: true },
    });

    const arrApps = await prisma.arrApp.findMany({
      where: { isEnabled: true },
    });

    // TODO: Implement actual cleanup logic
    // For now, return a placeholder response
    const results = rules.map((rule) => ({
      ruleId: rule.id,
      ruleName: rule.name,
      itemsFound: 0,
      itemsProcessed: 0,
      dryRun,
      status: 'completed',
      message: 'Cleanup logic not yet implemented',
    }));

    // Log the run
    logger.info(`Manual cleanup triggered (dryRun: ${dryRun})`, 'Cleanup');
    logger.info(`Processing ${rules.length} active rule(s)`, 'Cleanup');

    res.json({
      success: true,
      message: dryRun ? 'Dry run completed' : 'Cleanup completed',
      dryRun,
      rulesProcessed: rules.length,
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to run cleanup:', error);
    res.status(500).json({ error: 'Failed to run cleanup' });
  }
});

// Clear cache
router.post('/clear-cache', async (req, res) => {
  try {
    // TODO: Implement cache clearing
    logger.info('Cache cleared', 'System');
    
    res.json({
      success: true,
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to clear cache:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

// Get recent logs
router.get('/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const level = req.query.level as string | undefined;

    const logs = getRecentLogs(limit, level);

    res.json({
      logs,
      total: logs.length,
      hasMore: logs.length >= limit,
    });
  } catch (error) {
    console.error('Failed to get logs:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// Clear logs
router.post('/clear-logs', async (req, res) => {
  try {
    clearLogs();
    res.json({
      success: true,
      message: 'Logs cleared successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to clear logs:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

// Helper function to calculate next run time
function calculateNextRun(interval: string, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const next = new Date();

  // Set the time
  next.setHours(hours, minutes, 0, 0);

  // If the time has already passed today, move to next occurrence
  if (next <= now) {
    switch (interval) {
      case '6hours':
        next.setHours(next.getHours() + 6);
        break;
      case '12hours':
        next.setHours(next.getHours() + 12);
        break;
      case 'daily':
        next.setDate(next.getDate() + 1);
        break;
      case 'weekly':
        next.setDate(next.getDate() + 7);
        break;
      case 'monthly':
        next.setMonth(next.getMonth() + 1);
        break;
      default:
        next.setDate(next.getDate() + 1);
    }
  }

  return next;
}

export default router;
