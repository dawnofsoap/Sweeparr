/**
 * Storage Sources API Routes
 * Manages storage sources (local, SMB, NFS, TrueNAS) and their monitoring
 */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../utils/logger.js';
import { 
  TrueNASClient, 
  StorageClient,
} from '../integrations/index.js';

const router = Router();

// Error wrapper
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Helper to safely parse ID from params
function parseId(id: string | string[] | undefined): number {
  const idStr = Array.isArray(id) ? id[0] : id;
  return parseInt(idStr || '0', 10);
}

// Helper to format bytes
function formatBytes(bytes: number | bigint): string {
  const b = Number(bytes);
  if (b === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// GET /storage-sources/summary - Get summary of all storage sources (must be before /:id)
router.get('/summary', asyncHandler(async (_req: Request, res: Response) => {
  const sources = await prisma.storageSource.findMany({
    where: { isEnabled: true },
  });

  let totalSize = BigInt(0);
  let totalUsed = BigInt(0);
  let totalFree = BigInt(0);
  let sourcesAboveThreshold = 0;

  for (const source of sources) {
    if (source.lastSize) totalSize += source.lastSize;
    if (source.lastUsed) totalUsed += source.lastUsed;
    if (source.lastFree) totalFree += source.lastFree;
    
    if (source.lastSize && source.lastUsed) {
      const usedPercent = Number(source.lastUsed) / Number(source.lastSize) * 100;
      if (usedPercent >= source.thresholdPct) {
        sourcesAboveThreshold++;
      }
    }
  }

  res.json({
    success: true,
    data: {
      totalSources: sources.length,
      sourcesAboveThreshold,
      totalSize: Number(totalSize),
      totalUsed: Number(totalUsed),
      totalFree: Number(totalFree),
      totalSizeFormatted: formatBytes(totalSize),
      totalUsedFormatted: formatBytes(totalUsed),
      totalFreeFormatted: formatBytes(totalFree),
      overallUsedPercent: totalSize > BigInt(0) 
        ? (Number(totalUsed) / Number(totalSize) * 100).toFixed(1)
        : '0',
    },
  });
}));

// GET /storage-sources - List all storage sources
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const sources = await prisma.storageSource.findMany({
    orderBy: { createdAt: 'asc' },
  });

  // Add formatted sizes
  const formattedSources = sources.map(source => ({
    ...source,
    lastSize: source.lastSize ? Number(source.lastSize) : null,
    lastUsed: source.lastUsed ? Number(source.lastUsed) : null,
    lastFree: source.lastFree ? Number(source.lastFree) : null,
    lastSizeFormatted: source.lastSize ? formatBytes(source.lastSize) : null,
    lastUsedFormatted: source.lastUsed ? formatBytes(source.lastUsed) : null,
    lastFreeFormatted: source.lastFree ? formatBytes(source.lastFree) : null,
    usedPercent: source.lastSize && source.lastUsed 
      ? (Number(source.lastUsed) / Number(source.lastSize) * 100).toFixed(1)
      : null,
    isAboveThreshold: source.lastSize && source.lastUsed
      ? (Number(source.lastUsed) / Number(source.lastSize) * 100) >= source.thresholdPct
      : false,
  }));

  res.json({ success: true, data: formattedSources });
}));

// GET /storage-sources/:id - Get a specific storage source
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  const source = await prisma.storageSource.findUnique({
    where: { id },
  });

  if (!source) {
    res.status(404).json({ success: false, error: 'Storage source not found' });
    return;
  }

  res.json({
    success: true,
    data: {
      ...source,
      lastSize: source.lastSize ? Number(source.lastSize) : null,
      lastUsed: source.lastUsed ? Number(source.lastUsed) : null,
      lastFree: source.lastFree ? Number(source.lastFree) : null,
      lastSizeFormatted: source.lastSize ? formatBytes(source.lastSize) : null,
      lastUsedFormatted: source.lastUsed ? formatBytes(source.lastUsed) : null,
      lastFreeFormatted: source.lastFree ? formatBytes(source.lastFree) : null,
    },
  });
}));

// POST /storage-sources - Create a new storage source
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const {
    name,
    type,
    path,
    host,
    share,
    export: nfsExport,
    dataset,
    pool,
    username,
    password,
    apiKey,
    port,
    useSsl,
    isEnabled = true,
    thresholdPct = 90,
    autoCleanup = false,
  } = req.body;

  // Validate required fields based on type
  if (!name || !type) {
    res.status(400).json({ success: false, error: 'Name and type are required' });
    return;
  }

  const validTypes = ['local', 'smb', 'nfs', 'truenas'];
  if (!validTypes.includes(type)) {
    res.status(400).json({ success: false, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    return;
  }

  // Type-specific validation
  if (type === 'local' && !path) {
    res.status(400).json({ success: false, error: 'Path is required for local storage' });
    return;
  }
  
  if (type === 'smb' && (!path || !host || !share)) {
    res.status(400).json({ success: false, error: 'Path (mount point), host, and share are required for SMB storage' });
    return;
  }
  
  if (type === 'nfs' && (!path || !host || !nfsExport)) {
    res.status(400).json({ success: false, error: 'Path (mount point), host, and export are required for NFS storage' });
    return;
  }
  
  if (type === 'truenas' && (!host || !apiKey)) {
    res.status(400).json({ success: false, error: 'Host and API key are required for TrueNAS' });
    return;
  }

  const source = await prisma.storageSource.create({
    data: {
      name,
      type,
      path,
      host,
      share,
      export: nfsExport,
      dataset,
      pool,
      username,
      password,
      apiKey,
      port,
      useSsl: useSsl ?? true,
      isEnabled,
      thresholdPct,
      autoCleanup,
    },
  });

  logger.info(`Created storage source: ${name} (${type})`, 'Storage');

  res.status(201).json({
    success: true,
    data: {
      ...source,
      lastSize: source.lastSize ? Number(source.lastSize) : null,
      lastUsed: source.lastUsed ? Number(source.lastUsed) : null,
      lastFree: source.lastFree ? Number(source.lastFree) : null,
    },
  });
}));

// PUT /storage-sources/:id - Update a storage source
router.put('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const {
    name,
    type,
    path,
    host,
    share,
    export: nfsExport,
    dataset,
    pool,
    username,
    password,
    apiKey,
    port,
    useSsl,
    isEnabled,
    thresholdPct,
    autoCleanup,
  } = req.body;

  const existing = await prisma.storageSource.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({ success: false, error: 'Storage source not found' });
    return;
  }

  // Build update data, only including fields that were provided
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (path !== undefined) updateData.path = path;
  if (host !== undefined) updateData.host = host;
  if (share !== undefined) updateData.share = share;
  if (nfsExport !== undefined) updateData.export = nfsExport;
  if (dataset !== undefined) updateData.dataset = dataset;
  if (pool !== undefined) updateData.pool = pool;
  if (username !== undefined) updateData.username = username;
  if (password !== undefined) updateData.password = password;
  if (apiKey !== undefined) updateData.apiKey = apiKey;
  if (port !== undefined) updateData.port = port;
  if (useSsl !== undefined) updateData.useSsl = useSsl;
  if (isEnabled !== undefined) updateData.isEnabled = isEnabled;
  if (thresholdPct !== undefined) updateData.thresholdPct = thresholdPct;
  if (autoCleanup !== undefined) updateData.autoCleanup = autoCleanup;

  const source = await prisma.storageSource.update({
    where: { id },
    data: updateData,
  });

  logger.info(`Updated storage source: ${source.name}`, 'Storage');

  res.json({
    success: true,
    data: {
      ...source,
      lastSize: source.lastSize ? Number(source.lastSize) : null,
      lastUsed: source.lastUsed ? Number(source.lastUsed) : null,
      lastFree: source.lastFree ? Number(source.lastFree) : null,
      lastSizeFormatted: source.lastSize ? formatBytes(source.lastSize) : null,
      lastUsedFormatted: source.lastUsed ? formatBytes(source.lastUsed) : null,
      lastFreeFormatted: source.lastFree ? formatBytes(source.lastFree) : null,
    },
  });
}));

// DELETE /storage-sources/:id - Delete a storage source
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  const existing = await prisma.storageSource.findUnique({
    where: { id },
  });

  if (!existing) {
    res.status(404).json({ success: false, error: 'Storage source not found' });
    return;
  }

  await prisma.storageSource.delete({
    where: { id },
  });

  logger.info(`Deleted storage source: ${existing.name}`, 'Storage');

  res.json({ success: true, data: { message: 'Storage source deleted' } });
}));

// POST /storage-sources/test - Test a storage connection without saving
router.post('/test', asyncHandler(async (req: Request, res: Response) => {
  const { type, path, host, apiKey, pool, dataset, useSsl } = req.body;

  try {
    if (type === 'truenas') {
      if (!host || !apiKey) {
        res.json({ success: true, data: { connected: false, message: 'Host and API key are required' } });
        return;
      }
      
      const client = new TrueNASClient({
        url: host,
        apiKey,
        useSsl: useSsl ?? true,
      });
      
      const result = await client.testConnection();
      
      // If pool or dataset specified, also get those stats
      if (result.connected && (pool || dataset)) {
        let stats = null;
        if (dataset) {
          stats = await client.getDatasetStats(dataset);
        } else if (pool) {
          stats = await client.getPoolStats(pool);
        }
        
        if (stats) {
          res.json({
            success: true,
            data: {
              ...result,
              message: `${result.message} - ${formatBytes(stats.used)} used of ${formatBytes(stats.total)} (${stats.usedPercent.toFixed(1)}%)`,
              stats,
            },
          });
          return;
        }
      }
      
      res.json({ success: true, data: result });
    } else {
      // Local, SMB, or NFS - all accessed via local path
      if (!path) {
        res.json({ success: true, data: { connected: false, message: 'Path is required' } });
        return;
      }
      
      const client = new StorageClient({ type, path });
      const result = await client.testConnection();
      
      res.json({ success: true, data: result });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Connection test failed';
    res.json({
      success: true,
      data: {
        connected: false,
        message,
      },
    });
  }
}));

// POST /storage-sources/pools - Get TrueNAS pools without a saved source (for testing before save)
router.post('/pools', asyncHandler(async (req: Request, res: Response) => {
  const { host, apiKey, useSsl } = req.body;

  if (!host || !apiKey) {
    res.status(400).json({ success: false, error: 'Host and API key are required' });
    return;
  }

  try {
    const client = new TrueNASClient({
      url: host,
      apiKey,
      useSsl: useSsl ?? true,
    });

    const pools = await client.getPools();

    res.json({
      success: true,
      data: pools.map(p => ({
        name: p.name,
        status: p.status,
        healthy: p.healthy,
        size: p.size,
        allocated: p.allocated,
        free: p.free,
        sizeFormatted: formatBytes(p.size),
        allocatedFormatted: formatBytes(p.allocated),
        freeFormatted: formatBytes(p.free),
        usedPercent: p.size > 0 ? ((p.allocated / p.size) * 100).toFixed(1) : '0',
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get pools';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}));

// POST /storage-sources/datasets - Get TrueNAS datasets without a saved source (for testing before save)
router.post('/datasets', asyncHandler(async (req: Request, res: Response) => {
  const { host, apiKey, useSsl, pool } = req.body;

  if (!host || !apiKey) {
    res.status(400).json({ success: false, error: 'Host and API key are required' });
    return;
  }

  try {
    const client = new TrueNASClient({
      url: host,
      apiKey,
      useSsl: useSsl ?? true,
    });

    let datasets = await client.getDatasets();
    
    // Filter by pool if specified
    if (pool) {
      datasets = datasets.filter(d => {
        // Include datasets that belong to this pool
        const belongsToPool = d.pool === pool || d.name.startsWith(`${pool}/`);
        // Exclude the root pool dataset itself (pool name equals dataset name)
        const isRootPoolDataset = d.name === pool;
        return belongsToPool && !isRootPoolDataset;
      });
    }

    res.json({
      success: true,
      data: datasets.map(d => ({
        id: d.id,
        name: d.name,
        pool: d.pool,
        type: d.type,
        mountpoint: d.mountpoint,
        used: d.used.parsed,
        available: d.available.parsed,
        usedFormatted: formatBytes(d.used.parsed || 0),
        availableFormatted: formatBytes(d.available.parsed || 0),
        compression: d.compression.value,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get datasets';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}));

// POST /storage-sources/:id/test - Test a saved storage source
router.post('/:id/test', asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  const source = await prisma.storageSource.findUnique({
    where: { id },
  });

  if (!source) {
    res.status(404).json({ success: false, error: 'Storage source not found' });
    return;
  }

  try {
    if (source.type === 'truenas') {
      if (!source.host || !source.apiKey) {
        res.json({ success: true, data: { connected: false, message: 'Host and API key are required' } });
        return;
      }
      
      const client = new TrueNASClient({
        url: source.host,
        apiKey: source.apiKey,
        useSsl: source.useSsl ?? true,
      });
      
      const result = await client.testConnection();
      res.json({ success: true, data: result });
    } else {
      if (!source.path) {
        res.json({ success: true, data: { connected: false, message: 'Path is required' } });
        return;
      }
      
      const client = new StorageClient({ 
        type: source.type as 'local' | 'smb' | 'nfs', 
        path: source.path 
      });
      const result = await client.testConnection();
      res.json({ success: true, data: result });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Connection test failed';
    res.json({
      success: true,
      data: {
        connected: false,
        message,
      },
    });
  }
}));

// POST /storage-sources/:id/refresh - Refresh storage stats
router.post('/:id/refresh', asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  const source = await prisma.storageSource.findUnique({
    where: { id },
  });

  if (!source) {
    res.status(404).json({ success: false, error: 'Storage source not found' });
    return;
  }

  try {
    let stats: { total: number; used: number; free: number } | null = null;

    if (source.type === 'truenas') {
      if (!source.host || !source.apiKey) {
        res.status(400).json({ success: false, error: 'Host and API key are required' });
        return;
      }
      
      const client = new TrueNASClient({
        url: source.host,
        apiKey: source.apiKey,
        useSsl: source.useSsl ?? true,
      });
      
      // Try dataset first, then pool
      if (source.dataset) {
        stats = await client.getDatasetStats(source.dataset);
      } else if (source.pool) {
        stats = await client.getPoolStats(source.pool);
      } else {
        // Get first pool stats
        const pools = await client.getPools();
        if (pools.length > 0) {
          stats = await client.getPoolStats(pools[0].name);
        }
      }
    } else {
      if (!source.path) {
        res.status(400).json({ success: false, error: 'Path is required' });
        return;
      }
      
      const client = new StorageClient({ 
        type: source.type as 'local' | 'smb' | 'nfs', 
        path: source.path 
      });
      const storageStats = await client.getStats();
      stats = {
        total: storageStats.total,
        used: storageStats.used,
        free: storageStats.free,
      };
    }

    if (!stats) {
      res.status(400).json({ success: false, error: 'Could not retrieve storage stats' });
      return;
    }

    // Update the source with new stats
    const updatedSource = await prisma.storageSource.update({
      where: { id },
      data: {
        lastSize: BigInt(Math.floor(stats.total)),
        lastUsed: BigInt(Math.floor(stats.used)),
        lastFree: BigInt(Math.floor(stats.free)),
        lastChecked: new Date(),
      },
    });

    const usedPercent = stats.total > 0 ? (stats.used / stats.total * 100) : 0;
    const isAboveThreshold = usedPercent >= source.thresholdPct;

    logger.info(`Refreshed storage stats for ${source.name}: ${usedPercent.toFixed(1)}% used`, 'Storage');

    res.json({
      success: true,
      data: {
        ...updatedSource,
        lastSize: Number(updatedSource.lastSize),
        lastUsed: Number(updatedSource.lastUsed),
        lastFree: Number(updatedSource.lastFree),
        lastSizeFormatted: formatBytes(stats.total),
        lastUsedFormatted: formatBytes(stats.used),
        lastFreeFormatted: formatBytes(stats.free),
        usedPercent: usedPercent.toFixed(1),
        isAboveThreshold,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to refresh storage stats';
    logger.error(`Failed to refresh storage stats for ${source.name}: ${message}`, 'Storage');
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}));

// POST /storage-sources/refresh-all - Refresh all storage sources
router.post('/refresh-all', asyncHandler(async (_req: Request, res: Response) => {
  const sources = await prisma.storageSource.findMany({
    where: { isEnabled: true },
  });

  const results: Array<{
    id: number;
    name: string;
    success: boolean;
    message: string;
    stats?: { total: number; used: number; free: number; usedPercent: number };
  }> = [];

  for (const source of sources) {
    try {
      let stats: { total: number; used: number; free: number } | null = null;

      if (source.type === 'truenas') {
        if (!source.host || !source.apiKey) continue;
        
        const client = new TrueNASClient({
          url: source.host,
          apiKey: source.apiKey,
          useSsl: source.useSsl ?? true,
        });
        
        if (source.dataset) {
          stats = await client.getDatasetStats(source.dataset);
        } else if (source.pool) {
          stats = await client.getPoolStats(source.pool);
        }
      } else {
        if (!source.path) continue;
        
        const client = new StorageClient({ 
          type: source.type as 'local' | 'smb' | 'nfs', 
          path: source.path 
        });
        const storageStats = await client.getStats();
        stats = {
          total: storageStats.total,
          used: storageStats.used,
          free: storageStats.free,
        };
      }

      if (stats) {
        await prisma.storageSource.update({
          where: { id: source.id },
          data: {
            lastSize: BigInt(Math.floor(stats.total)),
            lastUsed: BigInt(Math.floor(stats.used)),
            lastFree: BigInt(Math.floor(stats.free)),
            lastChecked: new Date(),
          },
        });

        const usedPercent = stats.total > 0 ? (stats.used / stats.total * 100) : 0;
        
        results.push({
          id: source.id,
          name: source.name,
          success: true,
          message: `${usedPercent.toFixed(1)}% used`,
          stats: {
            total: stats.total,
            used: stats.used,
            free: stats.free,
            usedPercent,
          },
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to refresh';
      results.push({
        id: source.id,
        name: source.name,
        success: false,
        message,
      });
    }
  }

  logger.info(`Refreshed ${results.filter(r => r.success).length}/${sources.length} storage sources`, 'Storage');

  res.json({
    success: true,
    data: {
      total: sources.length,
      refreshed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    },
  });
}));

// GET /storage-sources/:id/pools - Get TrueNAS pools (for TrueNAS sources only)
router.get('/:id/pools', asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);

  const source = await prisma.storageSource.findUnique({
    where: { id },
  });

  if (!source) {
    res.status(404).json({ success: false, error: 'Storage source not found' });
    return;
  }

  if (source.type !== 'truenas') {
    res.status(400).json({ success: false, error: 'This endpoint is only for TrueNAS sources' });
    return;
  }

  if (!source.host || !source.apiKey) {
    res.status(400).json({ success: false, error: 'Host and API key are required' });
    return;
  }

  try {
    const client = new TrueNASClient({
      url: source.host,
      apiKey: source.apiKey,
      useSsl: source.useSsl ?? true,
    });

    const pools = await client.getPools();

    res.json({
      success: true,
      data: pools.map(p => ({
        name: p.name,
        status: p.status,
        healthy: p.healthy,
        size: p.size,
        allocated: p.allocated,
        free: p.free,
        sizeFormatted: formatBytes(p.size),
        allocatedFormatted: formatBytes(p.allocated),
        freeFormatted: formatBytes(p.free),
        usedPercent: p.size > 0 ? ((p.allocated / p.size) * 100).toFixed(1) : '0',
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get pools';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}));

// GET /storage-sources/:id/datasets - Get TrueNAS datasets (for TrueNAS sources only)
router.get('/:id/datasets', asyncHandler(async (req: Request, res: Response) => {
  const id = parseId(req.params.id);
  const poolParam = req.query.pool;
  const pool = typeof poolParam === 'string' ? poolParam : undefined;

  const source = await prisma.storageSource.findUnique({
    where: { id },
  });

  if (!source) {
    res.status(404).json({ success: false, error: 'Storage source not found' });
    return;
  }

  if (source.type !== 'truenas') {
    res.status(400).json({ success: false, error: 'This endpoint is only for TrueNAS sources' });
    return;
  }

  if (!source.host || !source.apiKey) {
    res.status(400).json({ success: false, error: 'Host and API key are required' });
    return;
  }

  try {
    const client = new TrueNASClient({
      url: source.host,
      apiKey: source.apiKey,
      useSsl: source.useSsl ?? true,
    });

    let datasets = await client.getDatasets();
    
    // Filter by pool if specified
    if (pool) {
      datasets = datasets.filter(d => {
        // Include datasets that belong to this pool
        const belongsToPool = d.pool === pool || d.name.startsWith(`${pool}/`);
        // Exclude the root pool dataset itself (pool name equals dataset name)
        const isRootPoolDataset = d.name === pool;
        return belongsToPool && !isRootPoolDataset;
      });
    }

    res.json({
      success: true,
      data: datasets.map(d => ({
        id: d.id,
        name: d.name,
        pool: d.pool,
        type: d.type,
        mountpoint: d.mountpoint,
        used: d.used.parsed,
        available: d.available.parsed,
        usedFormatted: formatBytes(d.used.parsed || 0),
        availableFormatted: formatBytes(d.available.parsed || 0),
        compression: d.compression.value,
      })),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get datasets';
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}));

export default router;
