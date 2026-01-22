import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { createError } from '../middleware/errorHandler.js';
import { createMediaServerClient } from '../integrations/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get all media servers
router.get('/', async (req, res, next) => {
  try {
    const servers = await prisma.mediaServer.findMany({
      include: { libraries: true },
    });
    res.json({ success: true, data: servers });
  } catch (error) {
    next(error);
  }
});

// Get single media server
router.get('/:id', async (req, res, next) => {
  try {
    const server = await prisma.mediaServer.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { libraries: true },
    });
    
    if (!server) {
      throw createError('Media server not found', 404);
    }
    
    res.json({ success: true, data: server });
  } catch (error) {
    next(error);
  }
});

// Create media server
router.post('/', async (req, res, next) => {
  try {
    const { name, type, url, apiKey, isDefault } = req.body;
    
    // Validate required fields
    if (!name || !type || !url || !apiKey) {
      throw createError('Missing required fields: name, type, url, apiKey', 400);
    }
    
    // Validate type
    if (!['jellyfin', 'emby', 'plex'].includes(type)) {
      throw createError('Invalid media server type. Must be: jellyfin, emby, or plex', 400);
    }
    
    // Check for duplicate URL
    const existing = await prisma.mediaServer.findUnique({ where: { url } });
    if (existing) {
      throw createError(`A media server with URL "${url}" already exists`, 409);
    }
    
    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.mediaServer.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    
    const server = await prisma.mediaServer.create({
      data: { 
        name, 
        type, 
        url, 
        apiKey, 
        isDefault: isDefault || false,
        isEnabled: true,
      },
    });
    
    logger.info(`Created media server: ${name} (${type})`, 'Media Server');
    res.status(201).json({ success: true, data: server });
  } catch (error: any) {
    logger.error(`Failed to create media server: ${error.message || error}`, 'Media Server');
    next(error);
  }
});

// Update media server
router.put('/:id', async (req, res, next) => {
  try {
    const { 
      name, 
      type, 
      url, 
      apiKey, 
      isDefault, 
      isEnabled,
      // Leaving Soon paths
      leavingSoonMoviesPath,
      leavingSoonTvPath,
      leavingSoonMoviesMediaPath,
      leavingSoonTvMediaPath,
    } = req.body;
    
    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.mediaServer.updateMany({
        where: { isDefault: true, id: { not: parseInt(req.params.id) } },
        data: { isDefault: false },
      });
    }
    
    const server = await prisma.mediaServer.update({
      where: { id: parseInt(req.params.id) },
      data: { 
        name, 
        type, 
        url, 
        apiKey, 
        isDefault, 
        isEnabled,
        // Only update leaving soon paths if provided (allow explicit null to clear)
        ...(leavingSoonMoviesPath !== undefined && { leavingSoonMoviesPath: leavingSoonMoviesPath || null }),
        ...(leavingSoonTvPath !== undefined && { leavingSoonTvPath: leavingSoonTvPath || null }),
        ...(leavingSoonMoviesMediaPath !== undefined && { leavingSoonMoviesMediaPath: leavingSoonMoviesMediaPath || null }),
        ...(leavingSoonTvMediaPath !== undefined && { leavingSoonTvMediaPath: leavingSoonTvMediaPath || null }),
      },
    });
    
    logger.info(`Updated media server: ${server.name}`, 'Media Server');
    res.json({ success: true, data: server });
  } catch (error) {
    next(error);
  }
});

// Delete media server
router.delete('/:id', async (req, res, next) => {
  try {
    const server = await prisma.mediaServer.delete({
      where: { id: parseInt(req.params.id) },
    });
    
    logger.info(`Deleted media server: ${server.name}`, 'Media Server');
    res.json({ success: true, message: 'Media server deleted' });
  } catch (error) {
    next(error);
  }
});

// Test connection without saving (for testing before adding)
router.post('/test', async (req, res, next) => {
  try {
    const { type, url, apiKey } = req.body;
    
    if (!type || !url || !apiKey) {
      throw createError('Missing required fields: type, url, apiKey', 400);
    }
    
    if (!['jellyfin', 'emby'].includes(type)) {
      throw createError('Invalid media server type. Must be: jellyfin or emby', 400);
    }
    
    try {
      const client = createMediaServerClient({
        type: type as 'jellyfin' | 'emby',
        url,
        apiKey,
      });
      
      const result = await client.testConnection();
      
      res.json({
        success: true,
        data: {
          connected: result.success,
          message: result.message,
          serverInfo: result.serverInfo ? {
            name: result.serverInfo.ServerName,
            version: result.serverInfo.Version,
          } : undefined,
        },
      });
    } catch (error: any) {
      res.json({
        success: true,
        data: {
          connected: false,
          message: error.message || 'Connection test failed',
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// Test connection
router.post('/:id/test', async (req, res, next) => {
  try {
    const server = await prisma.mediaServer.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    
    if (!server) {
      throw createError('Media server not found', 404);
    }
    
    // Test connection based on server type
    try {
      const client = createMediaServerClient({
        type: server.type as 'jellyfin' | 'emby' | 'plex',
        url: server.url,
        apiKey: server.apiKey,
      });
      
      const result = await client.testConnection();
      
      res.json({
        success: true,
        data: {
          connected: result.success,
          message: result.message,
          serverInfo: result.serverInfo,
        },
      });
    } catch (error: any) {
      res.json({
        success: true,
        data: {
          connected: false,
          message: error.message || 'Connection test failed',
        },
      });
    }
  } catch (error) {
    next(error);
  }
});

// Sync libraries from media server
router.post('/:id/sync-libraries', async (req, res, next) => {
  try {
    const server = await prisma.mediaServer.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    
    if (!server) {
      throw createError('Media server not found', 404);
    }
    
    // Get libraries from server
    const client = createMediaServerClient({
      type: server.type as 'jellyfin' | 'emby' | 'plex',
      url: server.url,
      apiKey: server.apiKey,
    });
    
    const remoteLibraries = await client.getLibraries();
    
    // Sync libraries to database
    const syncedLibraries = [];
    for (const lib of remoteLibraries) {
      // Map collection type to our internal type
      let libType = 'unknown';
      if (lib.CollectionType === 'movies') libType = 'movies';
      else if (lib.CollectionType === 'tvshows') libType = 'tvshows';
      else if (lib.CollectionType === 'music') libType = 'music';
      
      const library = await prisma.library.upsert({
        where: {
          mediaServerId_externalId: {
            mediaServerId: server.id,
            externalId: lib.Id,
          },
        },
        update: {
          name: lib.Name,
          type: libType,
        },
        create: {
          externalId: lib.Id,
          name: lib.Name,
          type: libType,
          mediaServerId: server.id,
        },
      });
      
      syncedLibraries.push(library);
    }
    
    logger.info(`Synced ${syncedLibraries.length} libraries from ${server.name}`, 'Media Server');
    
    res.json({
      success: true,
      data: {
        synced: true,
        libraryCount: syncedLibraries.length,
        libraries: syncedLibraries,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get items from a specific library
router.get('/:id/libraries/:libraryId/items', async (req, res, next) => {
  try {
    const server = await prisma.mediaServer.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    
    if (!server) {
      throw createError('Media server not found', 404);
    }
    
    const library = await prisma.library.findFirst({
      where: {
        id: parseInt(req.params.libraryId),
        mediaServerId: server.id,
      },
    });
    
    if (!library) {
      throw createError('Library not found', 404);
    }
    
    const client = createMediaServerClient({
      type: server.type as 'jellyfin' | 'emby' | 'plex',
      url: server.url,
      apiKey: server.apiKey,
    });
    
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    
    const result = await client.getItems({
      libraryId: library.externalId,
      limit,
      startIndex: offset,
      recursive: true,
    });
    
    res.json({
      success: true,
      data: {
        items: result.items,
        totalCount: result.totalCount,
        limit,
        offset,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
