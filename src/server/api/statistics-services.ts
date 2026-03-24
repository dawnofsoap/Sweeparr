import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { createStatisticsClient, JellystatClient } from '../integrations/index.js';
import { logger } from '../utils/logger.js';

const router = Router();
const prisma = new PrismaClient();

// Helper to safely parse ID from params
function parseId(param: string | string[] | undefined): number {
  const value = Array.isArray(param) ? param[0] : param;
  return parseInt(value || '0', 10);
}

// ============================================
// Statistics Services CRUD
// ============================================

/**
 * GET /api/statistics-services
 * Get all statistics services
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const services = await prisma.statisticsService.findMany({
      include: {
        mediaServers: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Don't expose API keys in the response
    const sanitized = services.map((service) => ({
      ...service,
      apiKey: service.apiKey ? '••••••••' : null,
      hasApiKey: !!service.apiKey,
    }));

    res.json({ success: true, data: sanitized });
  } catch (error: any) {
    logger.error(`Failed to get statistics services: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch statistics services' });
  }
});

/**
 * GET /api/statistics-services/:id
 * Get a specific statistics service
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const service = await prisma.statisticsService.findUnique({
      where: { id },
      include: {
        mediaServers: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!service) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    // Don't expose API key
    const sanitized = {
      ...service,
      apiKey: service.apiKey ? '••••••••' : null,
      hasApiKey: !!service.apiKey,
    };

    res.json({ success: true, data: sanitized });
  } catch (error: any) {
    logger.error(`Failed to get statistics service: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch statistics service' });
  }
});

/**
 * POST /api/statistics-services
 * Create a new statistics service
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, type, url, apiKey, isEnabled = true } = req.body;

    // Validate required fields
    if (!name || !type || !url || !apiKey) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['name', 'type', 'url', 'apiKey'],
      });
    }

    // Validate type
    const validTypes = ['jellystat', 'tautulli'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
      });
    }

    // Clean URL
    const cleanUrl = url.replace(/\/$/, '');

    // Check for duplicate URL
    const existing = await prisma.statisticsService.findUnique({
      where: { url: cleanUrl },
    });

    if (existing) {
      return res.status(409).json({
        error: 'A statistics service with this URL already exists',
        existingId: existing.id,
      });
    }

    // Create the service
    // watchDataReliableAfter is set to now — items added before this
    // date will be excluded from watch-based rule conditions since
    // the stats service wasn't tracking them yet.
    const service = await prisma.statisticsService.create({
      data: {
        name,
        type,
        url: cleanUrl,
        apiKey,
        isEnabled,
        watchDataReliableAfter: new Date(),
      },
    });

    logger.info(`Created statistics service: ${name} (${type})`);

    res.status(201).json({
      success: true,
      data: {
        ...service,
        apiKey: '••••••••',
        hasApiKey: true,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to create statistics service: ${error.message}`);
    res.status(500).json({ error: 'Failed to create statistics service' });
  }
});

/**
 * PUT /api/statistics-services/:id
 * Update a statistics service
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { name, type, url, apiKey, isEnabled } = req.body;

    // Check if service exists
    const existing = await prisma.statisticsService.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) {
      const validTypes = ['jellystat', 'tautulli'];
      if (!validTypes.includes(type)) {
        return res.status(400).json({
          error: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
        });
      }
      updateData.type = type;
    }
    if (url !== undefined) updateData.url = url.replace(/\/$/, '');
    if (apiKey !== undefined) updateData.apiKey = apiKey;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    // Check for duplicate URL if changing it
    if (updateData.url && updateData.url !== existing.url) {
      const duplicate = await prisma.statisticsService.findUnique({
        where: { url: updateData.url },
      });
      if (duplicate) {
        return res.status(409).json({
          error: 'A statistics service with this URL already exists',
        });
      }
    }

    const service = await prisma.statisticsService.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Updated statistics service: ${service.name}`);

    res.json({
      success: true,
      data: {
        ...service,
        apiKey: '••••••••',
        hasApiKey: true,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to update statistics service: ${error.message}`);
    res.status(500).json({ error: 'Failed to update statistics service' });
  }
});

/**
 * DELETE /api/statistics-services/:id
 * Delete a statistics service
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    const existing = await prisma.statisticsService.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    await prisma.statisticsService.delete({
      where: { id },
    });

    logger.info(`Deleted statistics service: ${existing.name}`);

    res.json({ success: true, deleted: existing.name });
  } catch (error: any) {
    logger.error(`Failed to delete statistics service: ${error.message}`);
    res.status(500).json({ error: 'Failed to delete statistics service' });
  }
});

// ============================================
// Connection Testing
// ============================================

/**
 * POST /api/statistics-services/test
 * Test connection to a statistics service (without saving)
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { type, url, apiKey } = req.body;

    if (!type || !url || !apiKey) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['type', 'url', 'apiKey'],
      });
    }

    const client = createStatisticsClient({
      type,
      url: url.replace(/\/$/, ''),
      apiKey,
    });

    const result = await client.testConnection();

    res.json({
      success: true,
      data: { connected: result.success, message: result.message },
    });
  } catch (error: any) {
    logger.error(`Statistics service connection test failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || 'Connection test failed',
    });
  }
});

/**
 * POST /api/statistics-services/:id/test
 * Test connection to an existing statistics service
 */
router.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    const service = await prisma.statisticsService.findUnique({
      where: { id },
    });

    if (!service) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    const client = createStatisticsClient({
      type: service.type as 'jellystat' | 'tautulli',
      url: service.url,
      apiKey: service.apiKey,
    });

    const result = await client.testConnection();

    // If this is the first successful test and watchDataReliableAfter
    // isn't set yet, record now as the reliability start date.
    // This handles services created before this feature existed.
    if (result.success && !service.watchDataReliableAfter) {
      await prisma.statisticsService.update({
        where: { id },
        data: { watchDataReliableAfter: new Date() },
      });
      logger.info(`Set watchDataReliableAfter for ${service.name} to now`, 'Statistics');
    }

    res.json({
      success: true,
      data: { connected: result.success, message: result.message },
    });
  } catch (error: any) {
    logger.error(`Statistics service connection test failed: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message || 'Connection test failed',
    });
  }
});

// ============================================
// Jellystat-Specific Endpoints
// ============================================

/**
 * GET /api/statistics-services/:id/libraries
 * Get libraries from a Jellystat service
 */
router.get('/:id/libraries', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    const service = await prisma.statisticsService.findUnique({
      where: { id },
    });

    if (!service) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    if (service.type !== 'jellystat') {
      return res.status(400).json({
        error: 'This endpoint is only available for Jellystat services',
      });
    }

    const client = new JellystatClient({
      url: service.url,
      apiKey: service.apiKey,
    });

    const libraries = await client.getLibraries();

    res.json({ success: true, data: libraries });
  } catch (error: any) {
    logger.error(`Failed to get Jellystat libraries: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch libraries' });
  }
});

/**
 * GET /api/statistics-services/:id/history
 * Get playback history from a statistics service
 */
router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { size, page, search, sort, desc } = req.query;

    const service = await prisma.statisticsService.findUnique({
      where: { id },
    });

    if (!service) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    if (service.type !== 'jellystat') {
      return res.status(400).json({
        error: 'This endpoint is only available for Jellystat services',
      });
    }

    const client = new JellystatClient({
      url: service.url,
      apiKey: service.apiKey,
    });

    const history = await client.getHistory({
      size: size ? parseInt(String(size), 10) : undefined,
      page: page ? parseInt(String(page), 10) : undefined,
      search: search ? String(search) : undefined,
      sort: sort ? String(sort) : undefined,
      desc: desc === 'true',
    });

    res.json({ success: true, data: history });
  } catch (error: any) {
    logger.error(`Failed to get Jellystat history: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

/**
 * GET /api/statistics-services/:id/item/:itemId/last-played
 * Get last played info for a specific item
 */
router.get('/:id/item/:itemId/last-played', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const itemId = String(req.params.itemId);

    const service = await prisma.statisticsService.findUnique({
      where: { id },
    });

    if (!service) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    if (service.type !== 'jellystat') {
      return res.status(400).json({
        error: 'This endpoint is only available for Jellystat services',
      });
    }

    const client = new JellystatClient({
      url: service.url,
      apiKey: service.apiKey,
    });

    const lastPlayed = await client.getLastPlayed(itemId);

    if (!lastPlayed) {
      return res.json({
        success: true,
        data: {
          itemId,
          hasBeenPlayed: false,
          lastPlayed: null,
        },
      });
    }

    res.json({
      success: true,
      data: {
        ...lastPlayed,
        hasBeenPlayed: true,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to get last played info: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch last played info' });
  }
});

/**
 * POST /api/statistics-services/:id/batch-last-played
 * Batch get last played info for multiple items
 */
router.post('/:id/batch-last-played', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds)) {
      return res.status(400).json({
        error: 'itemIds must be an array of strings',
      });
    }

    const service = await prisma.statisticsService.findUnique({
      where: { id },
    });

    if (!service) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    if (service.type !== 'jellystat') {
      return res.status(400).json({
        error: 'This endpoint is only available for Jellystat services',
      });
    }

    const client = new JellystatClient({
      url: service.url,
      apiKey: service.apiKey,
    });

    const results = await client.batchGetLastPlayed(itemIds);

    // Convert Map to object for JSON response
    const response: Record<string, any> = {};
    results.forEach((value, key) => {
      response[key] = value
        ? { ...value, hasBeenPlayed: true }
        : { itemId: key, hasBeenPlayed: false, lastPlayed: null };
    });

    res.json({ success: true, data: response });
  } catch (error: any) {
    logger.error(`Failed to batch get last played info: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch last played info' });
  }
});

/**
 * GET /api/statistics-services/:id/users
 * Get users from a Jellystat service
 */
router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);

    const service = await prisma.statisticsService.findUnique({
      where: { id },
    });

    if (!service) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    if (service.type !== 'jellystat') {
      return res.status(400).json({
        error: 'This endpoint is only available for Jellystat services',
      });
    }

    const client = new JellystatClient({
      url: service.url,
      apiKey: service.apiKey,
    });

    const users = await client.getUsers();

    res.json({ success: true, data: users });
  } catch (error: any) {
    logger.error(`Failed to get Jellystat users: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/statistics-services/:id/stats
 * Get global statistics from a service
 */
router.get('/:id/stats', async (req: Request, res: Response) => {
  try {
    const id = parseId(req.params.id);
    const { days } = req.query;

    const service = await prisma.statisticsService.findUnique({
      where: { id },
    });

    if (!service) {
      return res.status(404).json({ error: 'Statistics service not found' });
    }

    if (service.type !== 'jellystat') {
      return res.status(400).json({
        error: 'This endpoint is only available for Jellystat services',
      });
    }

    const client = new JellystatClient({
      url: service.url,
      apiKey: service.apiKey,
    });

    const stats = await client.getGlobalStats(days ? parseInt(String(days), 10) : 30);

    res.json({ success: true, data: stats || { message: 'Statistics not available from this Jellystat version' } });
  } catch (error: any) {
    logger.error(`Failed to get Jellystat stats: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

export default router;
