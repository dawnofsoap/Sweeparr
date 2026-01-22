import { Router } from 'express';
import { pathMappingService } from '../services/pathMappingService.js';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================
// Arr App Path Mappings
// ============================================

/**
 * GET /api/v1/path-mappings/arr/:arrAppId
 * Get path mappings for an Arr app
 */
router.get('/arr/:arrAppId', async (req, res, next) => {
  try {
    const arrAppId = parseInt(req.params.arrAppId);
    if (isNaN(arrAppId)) {
      throw createError('Invalid Arr app ID', 400);
    }

    const mappings = await pathMappingService.getArrPathMappings(arrAppId);
    res.json({ success: true, data: mappings });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/path-mappings/arr/:arrAppId
 * Update path mappings for an Arr app
 */
router.put('/arr/:arrAppId', async (req, res, next) => {
  try {
    const arrAppId = parseInt(req.params.arrAppId);
    if (isNaN(arrAppId)) {
      throw createError('Invalid Arr app ID', 400);
    }

    const { mappings } = req.body;
    if (!Array.isArray(mappings)) {
      throw createError('Mappings must be an array', 400);
    }

    // Validate each mapping
    for (const mapping of mappings) {
      if (!mapping.arrPath || !mapping.localPath) {
        throw createError('Each mapping must have arrPath and localPath', 400);
      }
    }

    await pathMappingService.setArrPathMappings(arrAppId, mappings);
    const updatedMappings = await pathMappingService.getArrPathMappings(arrAppId);
    
    res.json({ success: true, data: updatedMappings });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/path-mappings/arr/:arrAppId/test
 * Test path mappings for an Arr app
 */
router.post('/arr/:arrAppId/test', async (req, res, next) => {
  try {
    const arrAppId = parseInt(req.params.arrAppId);
    if (isNaN(arrAppId)) {
      throw createError('Invalid Arr app ID', 400);
    }

    const results = await pathMappingService.testArrPathMappings(arrAppId);
    
    const validCount = results.filter(r => r.localPathExists).length;
    const invalidCount = results.filter(r => !r.localPathExists).length;

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          valid: validCount,
          invalid: invalidCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Media Server Path Mappings
// ============================================

/**
 * GET /api/v1/path-mappings/media-server/:mediaServerId
 * Get path mappings for a media server
 */
router.get('/media-server/:mediaServerId', async (req, res, next) => {
  try {
    const mediaServerId = parseInt(req.params.mediaServerId);
    if (isNaN(mediaServerId)) {
      throw createError('Invalid media server ID', 400);
    }

    const mappings = await pathMappingService.getMediaServerPathMappings(mediaServerId);
    res.json({ success: true, data: mappings });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/path-mappings/media-server/:mediaServerId
 * Update path mappings for a media server
 */
router.put('/media-server/:mediaServerId', async (req, res, next) => {
  try {
    const mediaServerId = parseInt(req.params.mediaServerId);
    if (isNaN(mediaServerId)) {
      throw createError('Invalid media server ID', 400);
    }

    const { mappings } = req.body;
    if (!Array.isArray(mappings)) {
      throw createError('Mappings must be an array', 400);
    }

    // Validate each mapping
    for (const mapping of mappings) {
      if (!mapping.localPath || !mapping.mediaServerPath) {
        throw createError('Each mapping must have localPath and mediaServerPath', 400);
      }
    }

    await pathMappingService.setMediaServerPathMappings(mediaServerId, mappings);
    const updatedMappings = await pathMappingService.getMediaServerPathMappings(mediaServerId);
    
    res.json({ success: true, data: updatedMappings });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/path-mappings/media-server/:mediaServerId/test
 * Test path mappings for a media server
 */
router.post('/media-server/:mediaServerId/test', async (req, res, next) => {
  try {
    const mediaServerId = parseInt(req.params.mediaServerId);
    if (isNaN(mediaServerId)) {
      throw createError('Invalid media server ID', 400);
    }

    const results = await pathMappingService.testMediaServerPathMappings(mediaServerId);
    
    const validCount = results.filter(r => r.localPathExists).length;
    const invalidCount = results.filter(r => !r.localPathExists).length;

    res.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          valid: validCount,
          invalid: invalidCount,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Leaving Soon Paths
// ============================================

/**
 * GET /api/v1/path-mappings/media-server/:mediaServerId/leaving-soon
 * Get Leaving Soon paths for a media server
 */
router.get('/media-server/:mediaServerId/leaving-soon', async (req, res, next) => {
  try {
    const mediaServerId = parseInt(req.params.mediaServerId);
    if (isNaN(mediaServerId)) {
      throw createError('Invalid media server ID', 400);
    }

    const paths = await pathMappingService.getLeavingSoonPaths(mediaServerId);
    res.json({ success: true, data: paths });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/path-mappings/media-server/:mediaServerId/leaving-soon
 * Update Leaving Soon paths for a media server
 */
router.put('/media-server/:mediaServerId/leaving-soon', async (req, res, next) => {
  try {
    const mediaServerId = parseInt(req.params.mediaServerId);
    if (isNaN(mediaServerId)) {
      throw createError('Invalid media server ID', 400);
    }

    const { moviesLocalPath, tvLocalPath, moviesMediaPath, tvMediaPath } = req.body;

    await pathMappingService.setLeavingSoonPaths(mediaServerId, {
      moviesLocalPath,
      tvLocalPath,
      moviesMediaPath,
      tvMediaPath,
    });

    const paths = await pathMappingService.getLeavingSoonPaths(mediaServerId);
    res.json({ success: true, data: paths });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Path Translation
// ============================================

/**
 * POST /api/v1/path-mappings/translate
 * Translate a path between different formats
 */
router.post('/translate', async (req, res, next) => {
  try {
    const { path, arrAppId, mediaServerId, from } = req.body;

    if (!path) {
      throw createError('Path is required', 400);
    }

    let result: any = { original: path };

    if (from === 'arr' && arrAppId) {
      result.local = await pathMappingService.translateArrToLocal(path, arrAppId);
      
      if (mediaServerId) {
        result.mediaServer = await pathMappingService.translateLocalToMediaServer(result.local, mediaServerId);
      }
    } else if (from === 'local' && mediaServerId) {
      result.local = path;
      result.mediaServer = await pathMappingService.translateLocalToMediaServer(path, mediaServerId);
    } else if (from === 'mediaServer' && mediaServerId) {
      result.mediaServer = path;
      result.local = await pathMappingService.translateMediaServerToLocal(path, mediaServerId);
    } else {
      throw createError('Invalid translation parameters. Provide "from" (arr|local|mediaServer) and required IDs.', 400);
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/path-mappings/test-path
 * Test if a local path exists
 */
router.post('/test-path', async (req, res, next) => {
  try {
    const { path } = req.body;

    if (!path) {
      throw createError('Path is required', 400);
    }

    const result = await pathMappingService.testLocalPath(path);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
