import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma.js';
import { createError } from '../middleware/errorHandler.js';
import { createArrClient } from '../integrations/index.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get all *arr apps
router.get('/', async (req, res, next) => {
  try {
    const apps = await prisma.arrApp.findMany({
      include: { mediaServer: true },
    });
    res.json({ success: true, data: apps });
  } catch (error) {
    next(error);
  }
});

// Get single *arr app
router.get('/:id', async (req, res, next) => {
  try {
    const app = await prisma.arrApp.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { mediaServer: true },
    });
    
    if (!app) {
      throw createError('*arr app not found', 404);
    }
    
    res.json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
});

// Create *arr app
router.post('/', async (req, res, next) => {
  try {
    const { name, type, url, apiKey, mediaServerId } = req.body;
    
    // Validate required fields
    if (!name || !type || !url || !apiKey) {
      throw createError('Missing required fields: name, type, url, apiKey', 400);
    }
    
    // Validate type
    if (!['radarr', 'sonarr'].includes(type)) {
      throw createError('Invalid *arr app type. Must be: radarr or sonarr', 400);
    }
    
    // Check for duplicate URL
    const existing = await prisma.arrApp.findUnique({ where: { url } });
    if (existing) {
      throw createError(`An *arr service with URL "${url}" already exists`, 409);
    }
    
    const app = await prisma.arrApp.create({
      data: { 
        name, 
        type, 
        url, 
        apiKey,
        mediaServerId: mediaServerId || null,
      },
    });
    
    logger.info(`Created *arr app: ${name} (${type})`, 'Arr Services');
    res.status(201).json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
});

// Update *arr app
router.put('/:id', async (req, res, next) => {
  try {
    const { name, type, url, apiKey, isEnabled, mediaServerId } = req.body;
    
    const app = await prisma.arrApp.update({
      where: { id: parseInt(req.params.id) },
      data: { 
        name, 
        type, 
        url, 
        apiKey, 
        isEnabled,
        mediaServerId: mediaServerId !== undefined ? (mediaServerId || null) : undefined,
      },
    });
    
    logger.info(`Updated *arr app: ${app.name}`, 'Arr Services');
    res.json({ success: true, data: app });
  } catch (error) {
    next(error);
  }
});

// Delete *arr app
router.delete('/:id', async (req, res, next) => {
  try {
    const app = await prisma.arrApp.delete({
      where: { id: parseInt(req.params.id) },
    });
    
    logger.info(`Deleted *arr app: ${app.name}`, 'Arr Services');
    res.json({ success: true, message: '*arr app deleted' });
  } catch (error) {
    next(error);
  }
});

// Test connection
router.post('/:id/test', async (req, res, next) => {
  try {
    const app = await prisma.arrApp.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    
    if (!app) {
      throw createError('*arr app not found', 404);
    }
    
    try {
      const client = createArrClient({
        type: app.type as 'radarr' | 'sonarr',
        url: app.url,
        apiKey: app.apiKey,
      });
      
      const result = await client.testConnection();
      
      res.json({
        success: true,
        data: {
          connected: result.success,
          message: result.message,
          serverInfo: result.systemInfo ? {
            name: result.systemInfo.appName,
            version: result.systemInfo.version,
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

// Test connection without saving (for testing before adding)
router.post('/test', async (req, res, next) => {
  try {
    const { type, url, apiKey } = req.body;
    
    if (!type || !url || !apiKey) {
      throw createError('Missing required fields: type, url, apiKey', 400);
    }
    
    if (!['radarr', 'sonarr'].includes(type)) {
      throw createError('Invalid *arr app type. Must be: radarr or sonarr', 400);
    }
    
    try {
      const client = createArrClient({
        type: type as 'radarr' | 'sonarr',
        url,
        apiKey,
      });
      
      const result = await client.testConnection();
      
      res.json({
        success: true,
        data: {
          connected: result.success,
          message: result.message,
          serverInfo: result.systemInfo ? {
            name: result.systemInfo.appName,
            version: result.systemInfo.version,
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

// ============================================
// Image Proxy - Securely proxy poster images
// ============================================

// 1x1 transparent PNG placeholder
const PLACEHOLDER_IMAGE = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

/**
 * Proxy poster images from Radarr/Sonarr
 * 
 * Strategy:
 * 1. Fetch movie/series details from Radarr/Sonarr API (authenticated)
 * 2. Extract the remoteUrl (TMDB/TVDB direct link) from images
 * 3. Fetch and proxy that image to the client
 * 
 * URL format: /api/arr/:arrAppId/poster/:mediaId
 * Query params:
 *   - type: 'movie' | 'series' (required)
 */
router.get('/:id/poster/:mediaId', async (req, res, next) => {
  try {
    const arrAppId = parseInt(req.params.id);
    const mediaId = parseInt(req.params.mediaId);
    const mediaType = req.query.type as string;
    
    if (!mediaType || !['movie', 'series'].includes(mediaType)) {
      throw createError('Query param "type" is required (movie or series)', 400);
    }
    
    // Get the Arr app configuration
    const arrApp = await prisma.arrApp.findUnique({
      where: { id: arrAppId },
    });
    
    if (!arrApp) {
      throw createError('Arr app not found', 404);
    }
    
    // Fetch movie/series details from Radarr/Sonarr API to get the poster URL
    const apiEndpoint = mediaType === 'movie' ? 'movie' : 'series';
    const detailsUrl = `${arrApp.url}/api/v3/${apiEndpoint}/${mediaId}`;
    
    logger.info(`[Poster Proxy] Fetching ${mediaType} details from: ${detailsUrl}`, 'Arr Services');
    
    const detailsResponse = await axios.get(detailsUrl, {
      headers: {
        'X-Api-Key': arrApp.apiKey,
      },
      timeout: 10000,
    });
    
    if (detailsResponse.status !== 200) {
      logger.warn(`Failed to fetch ${mediaType} details: ${detailsResponse.status}`, 'Arr Services');
      res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
      res.send(PLACEHOLDER_IMAGE);
      return;
    }
    
    // Find the poster image with remoteUrl
    const images = detailsResponse.data.images || [];
    const posterImage = images.find((img: any) => img.coverType === 'poster');
    
    if (!posterImage?.remoteUrl) {
      logger.info(`[Poster Proxy] No remoteUrl found for ${mediaType} ${mediaId}. Image data: ${JSON.stringify(posterImage || 'none')}`, 'Arr Services');
      res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=3600' });
      res.send(PLACEHOLDER_IMAGE);
      return;
    }
    
    // Use w500 size for faster loading (instead of /original/)
    const posterUrl = posterImage.remoteUrl.replace('/original/', '/w500/');
    
    logger.info(`[Poster Proxy] Proxying poster from TMDB: ${posterUrl}`, 'Arr Services');
    
    // Fetch the image from TMDB
    const imageResponse = await axios.get(posterUrl, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        // Some servers require a user agent
        'User-Agent': 'Sweeparr/1.0',
      },
    });
    
    if (imageResponse.status !== 200) {
      logger.warn(`Failed to fetch poster from TMDB (status ${imageResponse.status}): ${posterUrl}`, 'Arr Services');
      res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' });
      res.send(PLACEHOLDER_IMAGE);
      return;
    }
    
    // Get content type from response or default to jpeg
    const contentType = imageResponse.headers['content-type'] || 'image/jpeg';
    
    // Set caching headers - cache for 1 day
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    });
    
    // Send the image data
    res.send(Buffer.from(imageResponse.data));
  } catch (error: any) {
    logger.warn(`Failed to proxy poster: ${error.message}`, 'Arr Services');
    
    // Return placeholder on any error
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=60' });
    res.send(PLACEHOLDER_IMAGE);
  }
});

export default router;
