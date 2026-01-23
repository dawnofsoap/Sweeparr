import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

const router = Router();

// ============================================
// Media Paths CRUD
// ============================================

/**
 * GET /api/v1/media-paths
 * Get all media paths
 */
router.get('/', async (req, res, next) => {
  try {
    const mediaPaths = await prisma.mediaPath.findMany({
      orderBy: { path: 'asc' },
    });
    res.json({ success: true, data: mediaPaths });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/media-paths/:id
 * Get a single media path
 */
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw createError('Invalid media path ID', 400);
    }

    const mediaPath = await prisma.mediaPath.findUnique({
      where: { id },
    });

    if (!mediaPath) {
      throw createError('Media path not found', 404);
    }

    res.json({ success: true, data: mediaPath });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/media-paths
 * Create a new media path
 */
router.post('/', async (req, res, next) => {
  try {
    const { path: mediaPath, label, mediaType } = req.body;

    if (!mediaPath) {
      throw createError('Path is required', 400);
    }

    // Normalize the path
    const normalizedPath = normalizePath(mediaPath);

    // Check if path already exists
    const existing = await prisma.mediaPath.findUnique({
      where: { path: normalizedPath },
    });

    if (existing) {
      throw createError('This path already exists', 409);
    }

    const newMediaPath = await prisma.mediaPath.create({
      data: {
        path: normalizedPath,
        label: label || null,
        mediaType: mediaType || null,
      },
    });

    logger.info(`Created media path: ${normalizedPath}`, 'MediaPaths');
    res.status(201).json({ success: true, data: newMediaPath });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/media-paths/:id
 * Update a media path
 */
router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw createError('Invalid media path ID', 400);
    }

    const { path: mediaPath, label, mediaType, isEnabled } = req.body;

    const existing = await prisma.mediaPath.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('Media path not found', 404);
    }

    const updateData: any = {};
    
    if (mediaPath !== undefined) {
      const normalizedPath = normalizePath(mediaPath);
      
      // Check if new path conflicts with another entry
      const conflict = await prisma.mediaPath.findFirst({
        where: { 
          path: normalizedPath,
          id: { not: id },
        },
      });
      
      if (conflict) {
        throw createError('This path already exists', 409);
      }
      
      updateData.path = normalizedPath;
    }
    
    if (label !== undefined) updateData.label = label || null;
    if (mediaType !== undefined) updateData.mediaType = mediaType || null;
    if (isEnabled !== undefined) updateData.isEnabled = isEnabled;

    const updatedPath = await prisma.mediaPath.update({
      where: { id },
      data: updateData,
    });

    logger.info(`Updated media path ${id}: ${updatedPath.path}`, 'MediaPaths');
    res.json({ success: true, data: updatedPath });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/media-paths/:id
 * Delete a media path
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw createError('Invalid media path ID', 400);
    }

    const existing = await prisma.mediaPath.findUnique({
      where: { id },
    });

    if (!existing) {
      throw createError('Media path not found', 404);
    }

    await prisma.mediaPath.delete({
      where: { id },
    });

    logger.info(`Deleted media path ${id}: ${existing.path}`, 'MediaPaths');
    res.json({ success: true, message: 'Media path deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/media-paths/:id/test
 * Test if a media path exists and is accessible
 */
router.post('/:id/test', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      throw createError('Invalid media path ID', 400);
    }

    const mediaPath = await prisma.mediaPath.findUnique({
      where: { id },
    });

    if (!mediaPath) {
      throw createError('Media path not found', 404);
    }

    const result = await testPath(mediaPath.path);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/media-paths/test
 * Test if a path exists (without saving)
 */
router.post('/test', async (req, res, next) => {
  try {
    const { path: testPathValue } = req.body;

    if (!testPathValue) {
      throw createError('Path is required', 400);
    }

    const normalizedPath = normalizePath(testPathValue);
    const result = await testPath(normalizedPath);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/media-paths/browse
 * Browse directories on the local filesystem
 */
router.post('/browse', async (req, res, next) => {
  try {
    const { currentPath } = req.body;
    
    // Default to common mount points if no path provided
    const browsePath = currentPath || '/';
    
    // Resolve to absolute path
    const absolutePath = path.resolve(browsePath);
    
    try {
      // Check if path exists
      const stats = await fs.stat(absolutePath);
      
      if (!stats.isDirectory()) {
        throw createError('Path is not a directory', 400);
      }
      
      // Read directory contents
      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      
      // Filter to only directories and sort alphabetically
      const directories = entries
        .filter(entry => entry.isDirectory())
        .filter(entry => !entry.name.startsWith('.')) // Hide hidden directories
        .map(entry => ({
          name: entry.name,
          path: path.join(absolutePath, entry.name),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
      
      // Get parent directory
      const parentPath = path.dirname(absolutePath);
      const hasParent = parentPath !== absolutePath; // Root has no parent
      
      res.json({
        success: true,
        data: {
          currentPath: absolutePath,
          parentPath: hasParent ? parentPath : null,
          directories,
        },
      });
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        throw createError('Directory does not exist', 404);
      }
      if (err.code === 'EACCES') {
        throw createError('Permission denied', 403);
      }
      throw err;
    }
  } catch (error) {
    next(error);
  }
});

// ============================================
// Helper Functions
// ============================================

function normalizePath(inputPath: string): string {
  // Convert backslashes to forward slashes
  let normalized = inputPath.replace(/\\/g, '/');
  
  // Remove trailing slash unless it's the root
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  
  return normalized;
}

async function testPath(testPathValue: string): Promise<{
  exists: boolean;
  isDirectory: boolean;
  isReadable: boolean;
  isWritable: boolean;
  message: string;
}> {
  try {
    const stats = await fs.stat(testPathValue);
    
    if (!stats.isDirectory()) {
      return {
        exists: true,
        isDirectory: false,
        isReadable: false,
        isWritable: false,
        message: 'Path exists but is not a directory',
      };
    }

    // Test read access
    let isReadable = false;
    try {
      await fs.readdir(testPathValue);
      isReadable = true;
    } catch {
      isReadable = false;
    }

    // Test write access
    let isWritable = false;
    try {
      await fs.access(testPathValue, fs.constants.W_OK);
      isWritable = true;
    } catch {
      isWritable = false;
    }

    return {
      exists: true,
      isDirectory: true,
      isReadable,
      isWritable,
      message: isReadable && isWritable 
        ? 'Path is accessible (read/write)'
        : isReadable 
          ? 'Path is readable but not writable'
          : 'Path exists but is not accessible',
    };
  } catch (err: any) {
    if (err.code === 'ENOENT') {
      return {
        exists: false,
        isDirectory: false,
        isReadable: false,
        isWritable: false,
        message: 'Path does not exist',
      };
    }
    return {
      exists: false,
      isDirectory: false,
      isReadable: false,
      isWritable: false,
      message: `Error: ${err.message}`,
    };
  }
}

export default router;
