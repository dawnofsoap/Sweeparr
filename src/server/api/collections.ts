import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';

const router = Router();

// Get all collections
router.get('/', async (req, res, next) => {
  try {
    const collections = await prisma.collection.findMany({
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
    res.json({ success: true, data: collections });
  } catch (error) {
    next(error);
  }
});

// Get single collection with items
router.get('/:id', async (req, res, next) => {
  try {
    const collection = await prisma.collection.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        items: {
          orderBy: { addedAt: 'desc' },
        },
      },
    });
    
    if (!collection) {
      throw createError('Collection not found', 404);
    }
    
    res.json({ success: true, data: collection });
  } catch (error) {
    next(error);
  }
});

// Create collection
router.post('/', async (req, res, next) => {
  try {
    const { name, description, isExclusion } = req.body;
    
    const collection = await prisma.collection.create({
      data: { name, description, isExclusion: isExclusion || false },
    });
    
    logger.info(`Created collection: ${name}${isExclusion ? ' (exclusion list)' : ''}`, 'Collections');
    res.status(201).json({ success: true, data: collection });
  } catch (error) {
    next(error);
  }
});

// Update collection
router.put('/:id', async (req, res, next) => {
  try {
    const { name, description, isActive } = req.body;
    
    const collection = await prisma.collection.update({
      where: { id: parseInt(req.params.id) },
      data: { name, description, isActive },
    });
    
    res.json({ success: true, data: collection });
  } catch (error) {
    next(error);
  }
});

// Delete collection
router.delete('/:id', async (req, res, next) => {
  try {
    const collection = await prisma.collection.delete({
      where: { id: parseInt(req.params.id) },
    });
    
    logger.info(`Deleted collection: ${collection.name}`, 'Collections');
    res.json({ success: true, message: 'Collection deleted' });
  } catch (error) {
    next(error);
  }
});

// Exclude item from collection
router.post('/:id/items/:itemId/exclude', async (req, res, next) => {
  try {
    const item = await prisma.collectionItem.update({
      where: { id: parseInt(req.params.itemId) },
      data: { isExcluded: true },
    });
    
    // Also add to global exclusions
    await prisma.exclusion.create({
      data: {
        mediaId: item.mediaId,
        mediaType: item.mediaType,
        title: item.title,
        reason: 'Excluded from collection',
      },
    });
    
    logger.info(`Excluded item from cleanup: ${item.title}`, 'Collections');
    res.json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
});

// Remove item from collection
router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    await prisma.collectionItem.delete({
      where: { id: parseInt(req.params.itemId) },
    });
    
    res.json({ success: true, message: 'Item removed from collection' });
  } catch (error) {
    next(error);
  }
});

// Sync collection to media server
router.post('/:id/sync', async (req, res, next) => {
  try {
    const collection = await prisma.collection.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    
    if (!collection) {
      throw createError('Collection not found', 404);
    }

    // TODO: Implement sync to media server
    res.json({
      success: true,
      data: {
        synced: false,
        message: 'Collection sync not yet implemented',
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
