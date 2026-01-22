/**
 * Preset Rules for Sweeparr
 * 
 * These are pre-configured rule templates that users can quickly apply.
 * Each preset includes conditions that are commonly used for media library cleanup.
 */

export interface PresetCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

export interface RulePreset {
  id: string;
  name: string;
  description: string;
  category: 'cleanup' | 'organization' | 'storage' | 'monitoring';
  mediaType: 'movie' | 'series' | 'both';
  action: 'delete' | 'unmonitor' | 'unmonitor_delete' | 'tag';
  gracePeriodDays: number;
  conditions: PresetCondition[];
  icon: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
}

export const RULE_PRESETS: RulePreset[] = [
  // ============================================
  // CLEANUP PRESETS - Movies
  // ============================================
  {
    id: 'old-watched-movies',
    name: 'Old Watched Movies',
    description: 'Remove movies that were watched over 90 days ago. Great for keeping your library fresh with content you haven\'t seen recently.',
    category: 'cleanup',
    mediaType: 'movie',
    action: 'delete',
    gracePeriodDays: 7,
    conditions: [
      { field: 'lastWatched', operator: 'greaterThan', value: 90 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '🎬',
    difficulty: 'beginner',
    tags: ['watched', 'old', 'space-saving'],
  },
  {
    id: 'never-watched-movies',
    name: 'Never Watched Movies',
    description: 'Find movies that have been in your library for over 180 days but have never been watched. Perfect for cleaning up movies you grabbed but never got around to.',
    category: 'cleanup',
    mediaType: 'movie',
    action: 'delete',
    gracePeriodDays: 14,
    conditions: [
      { field: 'addedDate', operator: 'greaterThan', value: 180 },
      { field: 'lastWatched', operator: 'greaterThan', value: 999 }, // Never watched treated as very old
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '👀',
    difficulty: 'beginner',
    tags: ['unwatched', 'old', 'forgotten'],
  },
  {
    id: 'large-old-movies',
    name: 'Large Old Movies',
    description: 'Target movies over 20GB that were watched more than 60 days ago. Great for reclaiming space from 4K remuxes you\'ve already seen.',
    category: 'storage',
    mediaType: 'movie',
    action: 'delete',
    gracePeriodDays: 7,
    conditions: [
      { field: 'size', operator: 'greaterThan', value: 20 },
      { field: 'lastWatched', operator: 'greaterThan', value: 60 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '💾',
    difficulty: 'intermediate',
    tags: ['large', '4k', 'space-saving', 'watched'],
  },
  {
    id: 'low-rated-unwatched',
    name: 'Low-Rated Unwatched Movies',
    description: 'Remove movies with a rating below 5.0 that haven\'t been watched in 90 days. Clean up content that probably isn\'t worth the disk space.',
    category: 'cleanup',
    mediaType: 'movie',
    action: 'delete',
    gracePeriodDays: 7,
    conditions: [
      { field: 'rating', operator: 'lessThan', value: 5 },
      { field: 'lastWatched', operator: 'greaterThan', value: 90 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '⭐',
    difficulty: 'intermediate',
    tags: ['low-rated', 'quality', 'unwatched'],
  },
  {
    id: 'old-movies-pre-2000',
    name: 'Old Unwatched Classics',
    description: 'Find movies released before 2000 that haven\'t been watched in over a year. Review and decide if these older films still belong in your library.',
    category: 'cleanup',
    mediaType: 'movie',
    action: 'unmonitor',
    gracePeriodDays: 30,
    conditions: [
      { field: 'year', operator: 'lessThan', value: 2000 },
      { field: 'lastWatched', operator: 'greaterThan', value: 365 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '📼',
    difficulty: 'intermediate',
    tags: ['classic', 'old', 'review'],
  },
  {
    id: 'unmonitored-with-files',
    name: 'Unmonitored with Files',
    description: 'Find movies you\'ve unmonitored but still have files for. Good for final cleanup of content you\'ve decided to stop tracking.',
    category: 'cleanup',
    mediaType: 'movie',
    action: 'delete',
    gracePeriodDays: 0,
    conditions: [
      { field: 'monitored', operator: 'equals', value: false },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '🚫',
    difficulty: 'beginner',
    tags: ['unmonitored', 'cleanup', 'files'],
  },

  // ============================================
  // CLEANUP PRESETS - TV Shows
  // ============================================
  {
    id: 'old-watched-series',
    name: 'Old Watched Shows',
    description: 'Remove TV shows that were last watched over 90 days ago. Keep your library focused on shows you\'re actively watching.',
    category: 'cleanup',
    mediaType: 'series',
    action: 'delete',
    gracePeriodDays: 7,
    conditions: [
      { field: 'lastWatched', operator: 'greaterThan', value: 90 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '📺',
    difficulty: 'beginner',
    tags: ['watched', 'tv', 'old'],
  },
  {
    id: 'never-watched-series',
    name: 'Never Watched Shows',
    description: 'Find TV shows added over 120 days ago that have never been watched. Perfect for shows you added but never started.',
    category: 'cleanup',
    mediaType: 'series',
    action: 'delete',
    gracePeriodDays: 14,
    conditions: [
      { field: 'addedDate', operator: 'greaterThan', value: 120 },
      { field: 'lastWatched', operator: 'greaterThan', value: 999 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '📋',
    difficulty: 'beginner',
    tags: ['unwatched', 'tv', 'abandoned'],
  },
  {
    id: 'large-completed-series',
    name: 'Large Completed Shows',
    description: 'Target TV shows over 50GB that haven\'t been watched in 60 days. Great for reclaiming space from finished series.',
    category: 'storage',
    mediaType: 'series',
    action: 'delete',
    gracePeriodDays: 14,
    conditions: [
      { field: 'size', operator: 'greaterThan', value: 50 },
      { field: 'lastWatched', operator: 'greaterThan', value: 60 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '📦',
    difficulty: 'intermediate',
    tags: ['large', 'tv', 'space-saving'],
  },
  {
    id: 'low-rated-series',
    name: 'Low-Rated Unwatched Shows',
    description: 'Remove TV shows with a rating below 6.0 that haven\'t been watched in 60 days. Focus on quality content.',
    category: 'cleanup',
    mediaType: 'series',
    action: 'delete',
    gracePeriodDays: 7,
    conditions: [
      { field: 'rating', operator: 'lessThan', value: 6 },
      { field: 'lastWatched', operator: 'greaterThan', value: 60 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '📉',
    difficulty: 'intermediate',
    tags: ['low-rated', 'tv', 'quality'],
  },

  // ============================================
  // STORAGE MANAGEMENT PRESETS
  // ============================================
  {
    id: 'massive-files',
    name: 'Massive Files',
    description: 'Find any media over 50GB. Good for identifying 4K remuxes and other large files that might need attention.',
    category: 'storage',
    mediaType: 'both',
    action: 'unmonitor',
    gracePeriodDays: 0,
    conditions: [
      { field: 'size', operator: 'greaterThan', value: 50 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '🗄️',
    difficulty: 'beginner',
    tags: ['large', '4k', 'review'],
  },
  {
    id: 'storage-emergency',
    name: 'Storage Emergency Cleanup',
    description: 'Aggressive cleanup: Remove any watched content over 30 days old. Use when you need to free up space fast.',
    category: 'storage',
    mediaType: 'both',
    action: 'delete',
    gracePeriodDays: 0,
    conditions: [
      { field: 'lastWatched', operator: 'greaterThan', value: 30 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '🚨',
    difficulty: 'advanced',
    tags: ['emergency', 'aggressive', 'space-saving'],
  },
  {
    id: 'medium-old-watched',
    name: 'Medium Files, Already Watched',
    description: 'Clean up media between 5-20GB that was watched over 45 days ago. Balance between space savings and quality retention.',
    category: 'storage',
    mediaType: 'both',
    action: 'delete',
    gracePeriodDays: 7,
    conditions: [
      { field: 'size', operator: 'greaterThan', value: 5 },
      { field: 'lastWatched', operator: 'greaterThan', value: 45 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '📊',
    difficulty: 'intermediate',
    tags: ['medium', 'watched', 'balanced'],
  },

  // ============================================
  // ORGANIZATION PRESETS
  // ============================================
  {
    id: 'stale-monitored',
    name: 'Stale Monitored Content',
    description: 'Find monitored content without files that hasn\'t changed in 90 days. Good for identifying items that failed to download.',
    category: 'organization',
    mediaType: 'both',
    action: 'unmonitor',
    gracePeriodDays: 0,
    conditions: [
      { field: 'monitored', operator: 'equals', value: true },
      { field: 'hasFile', operator: 'equals', value: false },
      { field: 'addedDate', operator: 'greaterThan', value: 90 },
    ],
    icon: '📌',
    difficulty: 'intermediate',
    tags: ['organization', 'stale', 'missing'],
  },
  {
    id: 'recently-added-no-file',
    name: 'Missing Recent Additions',
    description: 'Find content added in the last 30 days that doesn\'t have a file. Helps identify download issues quickly.',
    category: 'monitoring',
    mediaType: 'both',
    action: 'tag',
    gracePeriodDays: 0,
    conditions: [
      { field: 'addedDate', operator: 'lessThan', value: 30 },
      { field: 'hasFile', operator: 'equals', value: false },
      { field: 'monitored', operator: 'equals', value: true },
    ],
    icon: '🔍',
    difficulty: 'beginner',
    tags: ['monitoring', 'missing', 'recent'],
  },

  // ============================================
  // GENRE-BASED PRESETS
  // ============================================
  {
    id: 'old-documentary',
    name: 'Old Documentaries',
    description: 'Clean up documentaries watched over 60 days ago. Documentaries are often one-time watches.',
    category: 'cleanup',
    mediaType: 'both',
    action: 'delete',
    gracePeriodDays: 7,
    conditions: [
      { field: 'genre', operator: 'contains', value: 'documentary' },
      { field: 'lastWatched', operator: 'greaterThan', value: 60 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '🎥',
    difficulty: 'intermediate',
    tags: ['documentary', 'genre', 'watched'],
  },
  {
    id: 'old-reality',
    name: 'Old Reality TV',
    description: 'Remove reality TV shows watched over 30 days ago. Reality content quickly becomes dated.',
    category: 'cleanup',
    mediaType: 'series',
    action: 'delete',
    gracePeriodDays: 3,
    conditions: [
      { field: 'genre', operator: 'contains', value: 'reality' },
      { field: 'lastWatched', operator: 'greaterThan', value: 30 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '📹',
    difficulty: 'intermediate',
    tags: ['reality', 'tv', 'dated'],
  },
  {
    id: 'old-animation-kids',
    name: 'Old Kids Animation',
    description: 'Clean up animated kids content watched over 90 days ago. Perfect if kids have moved on to new favorites.',
    category: 'cleanup',
    mediaType: 'both',
    action: 'delete',
    gracePeriodDays: 14,
    conditions: [
      { field: 'genre', operator: 'contains', value: 'animation' },
      { field: 'lastWatched', operator: 'greaterThan', value: 90 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '🎨',
    difficulty: 'intermediate',
    tags: ['animation', 'kids', 'family'],
  },

  // ============================================
  // CONSERVATIVE/SAFE PRESETS
  // ============================================
  {
    id: 'very-old-watched',
    name: 'Very Old Watched Content',
    description: 'Conservative cleanup: Only remove content watched over 180 days ago. Safe for most libraries.',
    category: 'cleanup',
    mediaType: 'both',
    action: 'delete',
    gracePeriodDays: 30,
    conditions: [
      { field: 'lastWatched', operator: 'greaterThan', value: 180 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '🛡️',
    difficulty: 'beginner',
    tags: ['safe', 'conservative', 'old'],
  },
  {
    id: 'ancient-unwatched',
    name: 'Ancient Unwatched Content',
    description: 'Ultra-conservative: Only target content added over a year ago that was never watched.',
    category: 'cleanup',
    mediaType: 'both',
    action: 'unmonitor_delete',
    gracePeriodDays: 30,
    conditions: [
      { field: 'addedDate', operator: 'greaterThan', value: 365 },
      { field: 'lastWatched', operator: 'greaterThan', value: 999 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '🏛️',
    difficulty: 'beginner',
    tags: ['safe', 'conservative', 'ancient'],
  },

  // ============================================
  // AGGRESSIVE PRESETS
  // ============================================
  {
    id: 'aggressive-watched',
    name: 'Aggressive Watched Cleanup',
    description: 'Aggressive: Remove any content watched more than 14 days ago. For users who want a minimal library.',
    category: 'cleanup',
    mediaType: 'both',
    action: 'delete',
    gracePeriodDays: 3,
    conditions: [
      { field: 'lastWatched', operator: 'greaterThan', value: 14 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '⚡',
    difficulty: 'advanced',
    tags: ['aggressive', 'minimal', 'fast'],
  },
  {
    id: 'rapid-turnover',
    name: 'Rapid Turnover',
    description: 'Very aggressive: Content is removed just 7 days after watching. Only for those who never re-watch.',
    category: 'cleanup',
    mediaType: 'both',
    action: 'delete',
    gracePeriodDays: 0,
    conditions: [
      { field: 'lastWatched', operator: 'greaterThan', value: 7 },
      { field: 'hasFile', operator: 'equals', value: true },
    ],
    icon: '🔥',
    difficulty: 'advanced',
    tags: ['aggressive', 'rapid', 'turnover'],
  },
];

export const PRESET_CATEGORIES = [
  { id: 'cleanup', name: 'Cleanup', icon: '🧹', description: 'General cleanup rules for watched and old content' },
  { id: 'storage', name: 'Storage', icon: '💾', description: 'Rules focused on freeing up disk space' },
  { id: 'organization', name: 'Organization', icon: '📁', description: 'Rules for organizing and maintaining your library' },
  { id: 'monitoring', name: 'Monitoring', icon: '👁️', description: 'Rules for identifying issues and tracking content' },
];

export function getPresetsByCategory(category: string): RulePreset[] {
  return RULE_PRESETS.filter(preset => preset.category === category);
}

export function getPresetsByMediaType(mediaType: 'movie' | 'series'): RulePreset[] {
  return RULE_PRESETS.filter(preset => preset.mediaType === mediaType || preset.mediaType === 'both');
}

export function getPresetById(id: string): RulePreset | undefined {
  return RULE_PRESETS.find(preset => preset.id === id);
}

export function searchPresets(query: string): RulePreset[] {
  const lowerQuery = query.toLowerCase();
  return RULE_PRESETS.filter(preset => 
    preset.name.toLowerCase().includes(lowerQuery) ||
    preset.description.toLowerCase().includes(lowerQuery) ||
    preset.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
