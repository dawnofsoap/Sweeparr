import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { createError } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import { RadarrClient, RadarrMovie } from '../integrations/radarr.js';
import { SonarrClient, SonarrSeries } from '../integrations/sonarr.js';
import { JellystatClient } from '../integrations/jellystat.js';

const router = Router();

// Get all rules
router.get('/', async (req, res, next) => {
  try {
    const rules = await prisma.rule.findMany({
      include: {
        mediaServer: true,
        arrApp: true,
        _count: {
          select: { history: true },
        },
      },
    });
    res.json({ success: true, data: rules });
  } catch (error) {
    next(error);
  }
});

// Get single rule
router.get('/:id', async (req, res, next) => {
  try {
    const rule = await prisma.rule.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        mediaServer: true,
        arrApp: true,
        history: {
          take: 10,
          orderBy: { executedAt: 'desc' },
        },
      },
    });
    
    if (!rule) {
      throw createError('Rule not found', 404);
    }
    
    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
});

// Create rule
router.post('/', async (req, res, next) => {
  try {
    const {
      name,
      description,
      mediaServerId,
      arrAppId,
      mediaType,
      action,
      gracePeriodDays,
      showInCollection,
      collectionName,
      conditions,
      actions,
    } = req.body;
    
    const rule = await prisma.rule.create({
      data: {
        name,
        description,
        mediaServerId,
        arrAppId,
        mediaType: mediaType || 'movie',
        action: action || 'delete',
        gracePeriodDays: gracePeriodDays || 30,
        showInCollection: showInCollection ?? true,
        collectionName,
        conditions: JSON.stringify(conditions || []),
        actions: JSON.stringify(actions || []),
      },
    });
    
    logger.info(`Created rule: ${name}`, 'Rules');
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
});

// Update rule
router.put('/:id', async (req, res, next) => {
  try {
    const {
      name,
      description,
      isEnabled,
      isActive,
      mediaServerId,
      arrAppId,
      mediaType,
      action,
      gracePeriodDays,
      showInCollection,
      collectionName,
      conditions,
      actions,
    } = req.body;
    
    const rule = await prisma.rule.update({
      where: { id: parseInt(req.params.id) },
      data: {
        name,
        description,
        isEnabled,
        isActive,
        mediaServerId,
        arrAppId,
        mediaType,
        action,
        gracePeriodDays,
        showInCollection,
        collectionName,
        conditions: conditions ? JSON.stringify(conditions) : undefined,
        actions: actions ? JSON.stringify(actions) : undefined,
      },
    });
    
    logger.info(`Updated rule: ${rule.name}`, 'Rules');
    res.json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
});

// Delete rule
router.delete('/:id', async (req, res, next) => {
  try {
    const rule = await prisma.rule.delete({
      where: { id: parseInt(req.params.id) },
    });
    
    logger.info(`Deleted rule: ${rule.name}`, 'Rules');
    res.json({ success: true, message: 'Rule deleted' });
  } catch (error) {
    next(error);
  }
});

// Export rule as JSON
router.get('/:id/export', async (req, res, next) => {
  try {
    const rule = await prisma.rule.findUnique({
      where: { id: parseInt(req.params.id) },
    });
    
    if (!rule) {
      throw createError('Rule not found', 404);
    }

    // Export format (without IDs and timestamps)
    const exportData = {
      name: rule.name,
      description: rule.description,
      mediaType: rule.mediaType,
      action: rule.action,
      gracePeriodDays: rule.gracePeriodDays,
      showInCollection: rule.showInCollection,
      collectionName: rule.collectionName,
      conditions: JSON.parse(rule.conditions),
      actions: JSON.parse(rule.actions),
      exportedAt: new Date().toISOString(),
      sweeparrVersion: process.env.npm_package_version || '0.1.0',
    };
    
    res.json({ success: true, data: exportData });
  } catch (error) {
    next(error);
  }
});

// Import rule from JSON
router.post('/import', async (req, res, next) => {
  try {
    const {
      name,
      description,
      mediaType,
      action,
      gracePeriodDays,
      showInCollection,
      collectionName,
      conditions,
      actions,
      arrAppId,
    } = req.body;
    
    // Validate required fields
    if (!name || !conditions) {
      throw createError('Missing required fields for import', 400);
    }
    
    const rule = await prisma.rule.create({
      data: {
        name: `${name} (Imported)`,
        description,
        mediaType: mediaType || 'movie',
        action: action || 'delete',
        gracePeriodDays: gracePeriodDays || 30,
        showInCollection: showInCollection ?? true,
        collectionName,
        conditions: JSON.stringify(conditions),
        actions: JSON.stringify(actions || []),
        arrAppId,
      },
    });
    
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    next(error);
  }
});

// Run rule manually
router.post('/:id/run', async (req, res, next) => {
  try {
    const rule = await prisma.rule.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { arrApp: true },
    });
    
    if (!rule) {
      throw createError('Rule not found', 404);
    }

    // Get the global dry run setting
    const dryRunSetting = await prisma.settings.findUnique({
      where: { key: 'cleanup.schedule.dryRun' },
    });
    const dryRun = dryRunSetting?.value !== 'false';

    logger.info(`Running rule "${rule.name}" (dryRun: ${dryRun})`, 'Rules');

    // TODO: Implement actual rule execution
    // When implemented, this should:
    // 1. Evaluate conditions against media items
    // 2. If dryRun is false, actually delete/unmonitor items
    // 3. Log the results to rule history

    res.json({
      success: true,
      data: {
        executed: false,
        message: dryRun 
          ? 'Dry run completed - no files were deleted (rule execution not yet implemented)'
          : 'Rule execution not yet implemented',
        dryRun,
        ruleId: rule.id,
        ruleName: rule.name,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get rule history
router.get('/:id/history', async (req, res, next) => {
  try {
    const history = await prisma.ruleHistory.findMany({
      where: { ruleId: parseInt(req.params.id) },
      orderBy: { executedAt: 'desc' },
      take: 100,
    });
    
    res.json({ success: true, data: history });
  } catch (error) {
    next(error);
  }
});

// ============================================
// Rule Preview
// ============================================

interface RuleCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

interface PreviewItem {
  id: number;
  title: string;
  year: number;
  added: string;
  addedDaysAgo: number;
  size: number;
  sizeFormatted: string;
  hasFile: boolean;
  monitored: boolean;
  genres: string[];
  tags: number[];
  posterUrl: string | null;
  lastWatched?: string | null;
  lastWatchedDaysAgo?: number | null;
  matchedConditions: string[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function daysSince(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Extract poster URL from Radarr/Sonarr image data
 * Always returns null to force using the proxy endpoint
 * Direct TMDB URLs can be blocked or rate-limited
 */
function extractPosterUrl(images: { coverType: string; url: string; remoteUrl?: string }[] | undefined): string | null {
  // Always return null to use the proxy endpoint instead
  // Direct TMDB URLs often return 503 errors when accessed from containers
  return null;
}

function evaluateCondition(
  condition: RuleCondition,
  item: { addedDaysAgo: number; size: number; rating?: number; year: number; hasFile: boolean; monitored: boolean; genres: string[]; tags: number[]; lastWatchedDaysAgo?: number | null },
  tagMap: Map<number, string>
): { matches: boolean; description: string } {
  const { field, operator, value } = condition;
  
  let matches = false;
  let description = '';
  
  switch (field) {
    case 'lastWatched':
      if (item.lastWatchedDaysAgo === null || item.lastWatchedDaysAgo === undefined) {
        // Never watched - treat as infinite days ago for "greaterThan"
        matches = operator === 'greaterThan';
        description = `Last watched: Never`;
      } else {
        if (operator === 'greaterThan') {
          matches = item.lastWatchedDaysAgo > Number(value);
        } else if (operator === 'lessThan') {
          matches = item.lastWatchedDaysAgo < Number(value);
        }
        description = `Last watched: ${item.lastWatchedDaysAgo} days ago`;
      }
      break;
      
    case 'addedDate':
      if (operator === 'greaterThan') {
        matches = item.addedDaysAgo > Number(value);
      } else if (operator === 'lessThan') {
        matches = item.addedDaysAgo < Number(value);
      }
      description = `Added: ${item.addedDaysAgo} days ago`;
      break;
      
    case 'size':
      const sizeInGB = item.size / (1024 * 1024 * 1024);
      if (operator === 'greaterThan') {
        matches = sizeInGB > Number(value);
      } else if (operator === 'lessThan') {
        matches = sizeInGB < Number(value);
      }
      description = `Size: ${sizeInGB.toFixed(2)} GB`;
      break;
      
    case 'rating':
      const rating = item.rating || 0;
      if (operator === 'equals') {
        matches = rating === Number(value);
      } else if (operator === 'greaterThan') {
        matches = rating > Number(value);
      } else if (operator === 'lessThan') {
        matches = rating < Number(value);
      }
      description = `Rating: ${rating}`;
      break;
      
    case 'year':
      if (operator === 'equals') {
        matches = item.year === Number(value);
      } else if (operator === 'greaterThan') {
        matches = item.year > Number(value);
      } else if (operator === 'lessThan') {
        matches = item.year < Number(value);
      }
      description = `Year: ${item.year}`;
      break;
      
    case 'hasFile':
      matches = item.hasFile === (value === true || value === 'true');
      description = `Has file: ${item.hasFile ? 'Yes' : 'No'}`;
      break;
      
    case 'monitored':
      matches = item.monitored === (value === true || value === 'true');
      description = `Monitored: ${item.monitored ? 'Yes' : 'No'}`;
      break;
      
    case 'genre':
      const genreValue = String(value).toLowerCase();
      if (operator === 'contains') {
        matches = item.genres.some(g => g.toLowerCase().includes(genreValue));
      } else if (operator === 'notContains') {
        matches = !item.genres.some(g => g.toLowerCase().includes(genreValue));
      } else if (operator === 'equals') {
        matches = item.genres.some(g => g.toLowerCase() === genreValue);
      }
      description = `Genres: ${item.genres.join(', ')}`;
      break;
      
    case 'tag':
      const tagValue = String(value).toLowerCase();
      const itemTagNames = item.tags.map(t => tagMap.get(t)?.toLowerCase() || '');
      if (operator === 'contains') {
        matches = itemTagNames.some(t => t.includes(tagValue));
      } else if (operator === 'notContains') {
        matches = !itemTagNames.some(t => t.includes(tagValue));
      } else if (operator === 'equals') {
        matches = itemTagNames.some(t => t === tagValue);
      }
      description = `Tags: ${item.tags.map(t => tagMap.get(t) || t).join(', ') || 'None'}`;
      break;
  }
  
  return { matches, description };
}

// Preview rule matches
router.post('/preview', async (req, res, next) => {
  try {
    const {
      arrAppId,
      conditions,
      limit = 10,
    } = req.body;
    
    if (!arrAppId) {
      throw createError('arrAppId is required', 400);
    }
    
    if (!conditions || !Array.isArray(conditions) || conditions.length === 0) {
      return res.json({
        success: true,
        data: {
          items: [],
          totalMatches: 0,
          message: 'Add conditions to see matching items',
        },
      });
    }
    
    // Get the Arr app configuration
    const arrApp = await prisma.arrApp.findUnique({
      where: { id: arrAppId },
    });
    
    if (!arrApp) {
      throw createError('Arr app not found', 404);
    }
    
    // Check if we need Jellystat for lastWatched conditions
    const needsWatchHistory = conditions.some((c: RuleCondition) => c.field === 'lastWatched');
    let jellystatClient: JellystatClient | null = null;
    let watchHistory: Map<string, Date> = new Map();
    
    if (needsWatchHistory) {
      // Find a connected statistics service
      const statsService = await prisma.statisticsService.findFirst({
        where: { isEnabled: true, type: 'jellystat' },
      });
      
      if (statsService) {
        jellystatClient = new JellystatClient({
          url: statsService.url,
          apiKey: statsService.apiKey,
        });
      }
    }
    
    let previewItems: PreviewItem[] = [];
    let totalMatches = 0;
    
    if (arrApp.type === 'radarr') {
      // Fetch movies from Radarr
      const radarrClient = new RadarrClient({
        url: arrApp.url,
        apiKey: arrApp.apiKey,
      });
      
      const [movies, tags] = await Promise.all([
        radarrClient.getMovies(),
        radarrClient.getTags(),
      ]);
      
      const tagMap = new Map(tags.map(t => [t.id, t.label]));
      
      // Get watch history from Jellystat if available
      if (jellystatClient && movies.length > 0) {
        try {
          // Get TMDb IDs for batch lookup
          const tmdbIds = movies.map(m => String(m.tmdbId)).filter(Boolean);
          const lastPlayedData = await jellystatClient.batchGetLastPlayed(tmdbIds);
          lastPlayedData.forEach((data, itemId) => {
            if (data?.LastPlayed) {
              watchHistory.set(itemId, new Date(data.LastPlayed));
            }
          });
        } catch (err) {
          logger.warn('Failed to fetch watch history from Jellystat', 'Rules');
        }
      }
      
      // Evaluate each movie against conditions
      for (const movie of movies) {
        const addedDaysAgo = daysSince(movie.added);
        const lastWatchedDate = watchHistory.get(String(movie.tmdbId));
        const lastWatchedDaysAgo = lastWatchedDate ? daysSince(lastWatchedDate.toISOString()) : null;
        
        const itemData = {
          addedDaysAgo,
          size: movie.sizeOnDisk,
          rating: movie.ratings?.value,
          year: movie.year,
          hasFile: movie.hasFile,
          monitored: movie.monitored,
          genres: movie.genres || [],
          tags: movie.tags || [],
          lastWatchedDaysAgo,
        };
        
        const matchedConditions: string[] = [];
        let allMatch = true;
        
        for (const condition of conditions as RuleCondition[]) {
          const result = evaluateCondition(condition, itemData, tagMap);
          if (result.matches) {
            matchedConditions.push(result.description);
          } else {
            allMatch = false;
            break;
          }
        }
        
        if (allMatch) {
          totalMatches++;
          
          if (previewItems.length < limit) {
            // Extract poster URL - try remote URL first, then use proxy as fallback
            let posterUrl = extractPosterUrl(movie.images);
            
            // If no remote URL available, use our proxy endpoint
            if (!posterUrl) {
              posterUrl = `/api/v1/arr/${arrAppId}/poster/${movie.id}?type=movie`;
            }
            
            previewItems.push({
              id: movie.id,
              title: movie.title,
              year: movie.year,
              added: movie.added,
              addedDaysAgo,
              size: movie.sizeOnDisk,
              sizeFormatted: formatBytes(movie.sizeOnDisk),
              hasFile: movie.hasFile,
              monitored: movie.monitored,
              genres: movie.genres || [],
              tags: movie.tags || [],
              posterUrl,
              lastWatched: lastWatchedDate?.toISOString() || null,
              lastWatchedDaysAgo,
              matchedConditions,
            });
          }
        }
      }
    } else if (arrApp.type === 'sonarr') {
      // Fetch series from Sonarr
      const sonarrClient = new SonarrClient({
        url: arrApp.url,
        apiKey: arrApp.apiKey,
      });
      
      const [series, tags] = await Promise.all([
        sonarrClient.getSeries(),
        sonarrClient.getTags(),
      ]);
      
      const tagMap = new Map(tags.map(t => [t.id, t.label]));
      
      // Get watch history from Jellystat if available
      if (jellystatClient && series.length > 0) {
        try {
          const tvdbIds = series.map(s => String(s.tvdbId)).filter(Boolean);
          const lastPlayedData = await jellystatClient.batchGetLastPlayed(tvdbIds);
          lastPlayedData.forEach((data, itemId) => {
            if (data?.LastPlayed) {
              watchHistory.set(itemId, new Date(data.LastPlayed));
            }
          });
        } catch (err) {
          logger.warn('Failed to fetch watch history from Jellystat', 'Rules');
        }
      }
      
      // Evaluate each series against conditions
      for (const show of series) {
        const addedDaysAgo = daysSince(show.added);
        const lastWatchedDate = watchHistory.get(String(show.tvdbId));
        const lastWatchedDaysAgo = lastWatchedDate ? daysSince(lastWatchedDate.toISOString()) : null;
        
        const itemData = {
          addedDaysAgo,
          size: show.statistics?.sizeOnDisk || 0,
          rating: show.ratings?.value,
          year: show.year,
          hasFile: (show.statistics?.episodeFileCount || 0) > 0,
          monitored: show.monitored,
          genres: show.genres || [],
          tags: show.tags || [],
          lastWatchedDaysAgo,
        };
        
        const matchedConditions: string[] = [];
        let allMatch = true;
        
        for (const condition of conditions as RuleCondition[]) {
          const result = evaluateCondition(condition, itemData, tagMap);
          if (result.matches) {
            matchedConditions.push(result.description);
          } else {
            allMatch = false;
            break;
          }
        }
        
        if (allMatch) {
          totalMatches++;
          
          if (previewItems.length < limit) {
            // Extract poster URL - try remote URL first, then use proxy as fallback
            let posterUrl = extractPosterUrl(show.images);
            
            // If no remote URL available, use our proxy endpoint
            if (!posterUrl) {
              posterUrl = `/api/v1/arr/${arrAppId}/poster/${show.id}?type=series`;
            }
            
            previewItems.push({
              id: show.id,
              title: show.title,
              year: show.year,
              added: show.added,
              addedDaysAgo,
              size: show.statistics?.sizeOnDisk || 0,
              sizeFormatted: formatBytes(show.statistics?.sizeOnDisk || 0),
              hasFile: (show.statistics?.episodeFileCount || 0) > 0,
              monitored: show.monitored,
              genres: show.genres || [],
              tags: show.tags || [],
              posterUrl,
              lastWatched: lastWatchedDate?.toISOString() || null,
              lastWatchedDaysAgo,
              matchedConditions,
            });
          }
        }
      }
    }
    
    // Calculate total size
    const totalSize = previewItems.reduce((sum, item) => sum + item.size, 0);
    
    res.json({
      success: true,
      data: {
        items: previewItems,
        totalMatches,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        hasWatchHistory: watchHistory.size > 0,
        message: totalMatches === 0 
          ? 'No items match the current conditions' 
          : `${totalMatches} item${totalMatches === 1 ? '' : 's'} would be affected`,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
