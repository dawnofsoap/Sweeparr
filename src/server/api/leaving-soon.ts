import { Router } from 'express';
import { leavingSoonService } from '../services/leavingSoonService.js';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================
// Settings
// ============================================

/**
 * GET /api/v1/leaving-soon/settings
 * Get Leaving Soon feature settings
 */
router.get('/settings', async (req, res, next) => {
  try {
    const settings = await leavingSoonService.getSettings();
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/leaving-soon/settings
 * Update Leaving Soon feature settings
 */
router.put('/settings', async (req, res, next) => {
  try {
    await leavingSoonService.updateSettings(req.body);
    const settings = await leavingSoonService.getSettings();
    
    logger.info('Leaving Soon settings updated', 'LeavingSoon');
    res.json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Status & Items
// ============================================

/**
 * GET /api/v1/leaving-soon/status
 * Get overall status of the Leaving Soon feature
 */
router.get('/status', async (req, res, next) => {
  try {
    const status = await leavingSoonService.getStatus();
    res.json({ success: true, data: status });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/leaving-soon/items
 * Get all items currently targeted by rules (in grace period)
 */
router.get('/items', async (req, res, next) => {
  try {
    const items = await leavingSoonService.getTargetedItems();
    
    const movies = items.filter(i => i.mediaType === 'movie');
    const series = items.filter(i => i.mediaType === 'series');
    const expiringSoon = items.filter(i => i.daysUntilExpiry <= 7);
    
    res.json({
      success: true,
      data: {
        items,
        movies,
        series,
        totalCount: items.length,
        movieCount: movies.length,
        seriesCount: series.length,
        expiringSoonCount: expiringSoon.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Sync Operations
// ============================================

/**
 * POST /api/v1/leaving-soon/sync
 * Sync symlinks for all configured media servers
 */
router.post('/sync', async (req, res, next) => {
  try {
    logger.info('Manual sync triggered for all media servers', 'LeavingSoon');
    
    const results = await leavingSoonService.syncAllMediaServers();
    
    const totalCreated = results.reduce((sum, r) => sum + r.moviesCreated + r.tvCreated, 0);
    const totalRemoved = results.reduce((sum, r) => sum + r.moviesRemoved + r.tvRemoved, 0);
    
    res.json({
      success: results.every(r => r.success),
      data: {
        results,
        summary: {
          totalCreated,
          totalRemoved,
          serversProcessed: results.length,
        },
      },
      message: `Sync complete: ${totalCreated} created, ${totalRemoved} removed across ${results.length} servers`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/leaving-soon/sync/:mediaServerId
 * Sync symlinks for a specific media server
 */
router.post('/sync/:mediaServerId', async (req, res, next) => {
  try {
    const mediaServerId = parseInt(req.params.mediaServerId);
    if (isNaN(mediaServerId)) {
      throw createError('Invalid media server ID', 400);
    }

    logger.info(`Manual sync triggered for media server ${mediaServerId}`, 'LeavingSoon');
    
    const result = await leavingSoonService.syncMediaServer(mediaServerId);
    
    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Symlink Stats & Management
// ============================================

/**
 * GET /api/v1/leaving-soon/symlinks/:mediaServerId
 * Get symlink statistics for a media server
 */
router.get('/symlinks/:mediaServerId', async (req, res, next) => {
  try {
    const mediaServerId = parseInt(req.params.mediaServerId);
    if (isNaN(mediaServerId)) {
      throw createError('Invalid media server ID', 400);
    }

    const stats = await leavingSoonService.getSymlinkStats(mediaServerId);
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/leaving-soon/symlinks/:mediaServerId
 * Clear all symlinks for a media server
 */
router.delete('/symlinks/:mediaServerId', async (req, res, next) => {
  try {
    const mediaServerId = parseInt(req.params.mediaServerId);
    if (isNaN(mediaServerId)) {
      throw createError('Invalid media server ID', 400);
    }

    logger.info(`Clearing all symlinks for media server ${mediaServerId}`, 'LeavingSoon');
    
    const result = await leavingSoonService.clearMediaServerSymlinks(mediaServerId);
    
    res.json({
      success: result.errors.length === 0,
      data: result,
      message: `Removed ${result.removed} symlinks`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Auto-Sync Control
// ============================================

/**
 * POST /api/v1/leaving-soon/auto-sync/start
 * Start the auto-sync interval
 */
router.post('/auto-sync/start', async (req, res, next) => {
  try {
    await leavingSoonService.startAutoSync();
    res.json({
      success: true,
      message: 'Auto-sync started',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/leaving-soon/auto-sync/stop
 * Stop the auto-sync interval
 */
router.post('/auto-sync/stop', async (req, res, next) => {
  try {
    await leavingSoonService.stopAutoSync();
    res.json({
      success: true,
      message: 'Auto-sync stopped',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Library Refresh
// ============================================

/**
 * POST /api/v1/leaving-soon/refresh
 * Trigger library refresh on all media servers
 */
router.post('/refresh', async (req, res, next) => {
  try {
    const results = await leavingSoonService.refreshAllMediaServers();
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    res.json({
      success: failed === 0,
      data: {
        results,
        successful,
        failed,
      },
      message: `Refreshed ${successful} servers${failed > 0 ? `, ${failed} failed` : ''}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/leaving-soon/refresh/:mediaServerId
 * Trigger library refresh on a specific media server
 */
router.post('/refresh/:mediaServerId', async (req, res, next) => {
  try {
    const mediaServerId = parseInt(req.params.mediaServerId);
    if (isNaN(mediaServerId)) {
      throw createError('Invalid media server ID', 400);
    }
    
    const result = await leavingSoonService.refreshMediaServer(mediaServerId);
    
    res.json({
      success: result.success,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
