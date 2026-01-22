import { Router } from 'express';
import { prisma } from '../lib/prisma.js';

const router = Router();

// ============================================
// Settings Keys
// ============================================
const SETTINGS_GROUPS = {
  cleanup: [
    'cleanup.schedule.enabled',
    'cleanup.schedule.interval',
    'cleanup.schedule.time',
    'cleanup.schedule.dryRun',
    'cleanup.deletion.deleteFromDisk',
    'cleanup.deletion.removeFromArr',
    'cleanup.deletion.removeFromMediaServer',
    'cleanup.deletion.addExclusion',
    'cleanup.age.enabled',
    'cleanup.age.movieMaxAge',
    'cleanup.age.showMaxAge',
    'cleanup.age.ignoreIfInCollection',
  ],
  notifications: [
    'notifications.triggers.onCleanupComplete',
    'notifications.triggers.onError',
    'notifications.triggers.onItemDeleted',
    'notifications.triggers.weeklySummary',
    'notifications.triggers.testNotifications',
  ],
  general: [
    'general.instanceName',
    'general.logLevel',
    'general.authentication',
    'general.apiKey',
  ],
  ui: [
    'ui.theme',
    'ui.accentColor',
    'ui.showPosters',
    'ui.dateFormat',
    'ui.timeFormat',
  ],
  leavingSoon: [
    'leavingSoon.enabled',
    'leavingSoon.syncIntervalMinutes',
    'leavingSoon.autoSync',
    'leavingSoon.refreshLibraryAfterSync',
  ],
};

// Default values
const DEFAULT_VALUES: Record<string, string> = {
  'cleanup.schedule.enabled': 'false',
  'cleanup.schedule.interval': 'daily',
  'cleanup.schedule.time': '03:00',
  'cleanup.schedule.dryRun': 'true',
  'cleanup.deletion.deleteFromDisk': 'false',
  'cleanup.deletion.removeFromArr': 'true',
  'cleanup.deletion.removeFromMediaServer': 'false',
  'cleanup.deletion.addExclusion': 'false',
  'cleanup.age.enabled': 'false',
  'cleanup.age.movieMaxAge': '180',
  'cleanup.age.showMaxAge': '90',
  'cleanup.age.ignoreIfInCollection': 'true',
  'notifications.triggers.onCleanupComplete': 'true',
  'notifications.triggers.onError': 'true',
  'notifications.triggers.onItemDeleted': 'false',
  'notifications.triggers.weeklySummary': 'false',
  'notifications.triggers.testNotifications': 'true',
  'general.instanceName': 'Sweeparr',
  'general.logLevel': 'info',
  'general.authentication': 'none',
  'general.apiKey': '',
  'ui.theme': 'dark',
  'ui.accentColor': 'indigo',
  'ui.showPosters': 'true',
  'ui.dateFormat': 'MM/DD/YYYY',
  'ui.timeFormat': '12h',
  // Leaving Soon defaults (paths are now per-media-server)
  'leavingSoon.enabled': 'true',
  'leavingSoon.syncIntervalMinutes': '60',
  'leavingSoon.autoSync': 'true',
  'leavingSoon.refreshLibraryAfterSync': 'true',
};

// ============================================
// Routes
// ============================================

// Get all settings (as a key-value map)
router.get('/', async (req, res, next) => {
  try {
    const settings = await prisma.settings.findMany();
    const settingsMap = settings.reduce((acc: Record<string, string>, setting: { key: string; value: string }) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    // Merge with defaults
    const result = { ...DEFAULT_VALUES, ...settingsMap };

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Get settings by group
router.get('/group/:group', async (req, res, next) => {
  try {
    const { group } = req.params;
    const keys = SETTINGS_GROUPS[group as keyof typeof SETTINGS_GROUPS];

    if (!keys) {
      return res.status(400).json({ success: false, error: `Unknown settings group: ${group}` });
    }

    const settings = await prisma.settings.findMany({
      where: { key: { in: keys } },
    });

    const settingsMap = settings.reduce((acc: Record<string, string>, setting: { key: string; value: string }) => {
      acc[setting.key] = setting.value;
      return acc;
    }, {} as Record<string, string>);

    // Merge with defaults for this group
    const result: Record<string, string> = {};
    for (const key of keys) {
      result[key] = settingsMap[key] ?? DEFAULT_VALUES[key] ?? '';
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// Get single setting
router.get('/:key', async (req, res, next) => {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: req.params.key },
    });

    if (!setting) {
      // Return default value if available
      const defaultValue = DEFAULT_VALUES[req.params.key];
      if (defaultValue !== undefined) {
        return res.json({
          success: true,
          data: { key: req.params.key, value: defaultValue },
        });
      }
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    res.json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
});

// Update or create single setting
router.put('/:key', async (req, res, next) => {
  try {
    const { value } = req.body;

    const setting = await prisma.settings.upsert({
      where: { key: req.params.key },
      update: { value: String(value) },
      create: { key: req.params.key, value: String(value) },
    });

    res.json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
});

// Bulk update settings
router.put('/', async (req, res, next) => {
  try {
    const settings = req.body as Record<string, any>;

    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ success: false, error: 'Settings object required' });
    }

    // Upsert each setting
    const operations = Object.entries(settings).map(([key, value]) =>
      prisma.settings.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    );

    await Promise.all(operations);

    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    next(error);
  }
});

// Delete setting
router.delete('/:key', async (req, res, next) => {
  try {
    await prisma.settings.delete({
      where: { key: req.params.key },
    });

    res.json({ success: true, message: 'Setting deleted' });
  } catch (error) {
    next(error);
  }
});

export default router;
