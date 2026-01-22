import { Router } from 'express';
import { 
  RULE_PRESETS, 
  PRESET_CATEGORIES, 
  getPresetsByCategory, 
  getPresetsByMediaType,
  getPresetById,
  searchPresets,
} from '../lib/presets.js';

const router = Router();

// Get all presets
router.get('/', async (req, res) => {
  const { category, mediaType, search } = req.query;
  
  let presets = RULE_PRESETS;
  
  if (search && typeof search === 'string') {
    presets = searchPresets(search);
  } else {
    if (category && typeof category === 'string') {
      presets = getPresetsByCategory(category);
    }
    
    if (mediaType && (mediaType === 'movie' || mediaType === 'series')) {
      presets = presets.filter(p => p.mediaType === mediaType || p.mediaType === 'both');
    }
  }
  
  res.json({ 
    success: true, 
    data: {
      presets,
      categories: PRESET_CATEGORIES,
      total: presets.length,
    }
  });
});

// Get preset categories
router.get('/categories', async (req, res) => {
  res.json({ 
    success: true, 
    data: PRESET_CATEGORIES,
  });
});

// Get single preset
router.get('/:id', async (req, res) => {
  const preset = getPresetById(req.params.id);
  
  if (!preset) {
    return res.status(404).json({ 
      success: false, 
      error: 'Preset not found' 
    });
  }
  
  res.json({ success: true, data: preset });
});

export default router;
