import { useState, useEffect } from 'react';
import { presets } from '../api';
import type { RulePreset, PresetCategory, PresetCondition } from '../api';
import { Portal } from './Portal';

interface PresetBrowserProps {
  onSelect: (preset: RulePreset) => void;
  onClose: () => void;
  mediaTypeFilter?: 'movie' | 'series';
}

export function PresetBrowser({ onSelect, onClose, mediaTypeFilter }: PresetBrowserProps) {
  const [presetList, setPresetList] = useState<RulePreset[]>([]);
  const [categories, setCategories] = useState<PresetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<RulePreset | null>(null);

  useEffect(() => {
    const fetchPresets = async () => {
      setLoading(true);
      setError(null);
      try {
        const params: { category?: string; mediaType?: string; search?: string } = {};
        if (selectedCategory) params.category = selectedCategory;
        if (mediaTypeFilter) params.mediaType = mediaTypeFilter;
        if (searchQuery) params.search = searchQuery;
        
        const response = await presets.list(params);
        setPresetList(response.data.presets);
        setCategories(response.data.categories);
      } catch (err) {
        console.error('Failed to fetch presets:', err);
        setError('Failed to load presets');
      } finally {
        setLoading(false);
      }
    };
    
    fetchPresets();
  }, [selectedCategory, mediaTypeFilter, searchQuery]);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-900/50 text-green-300';
      case 'intermediate': return 'bg-yellow-900/50 text-yellow-300';
      case 'advanced': return 'bg-red-900/50 text-red-300';
      default: return 'bg-tertiary text-secondary';
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'delete': return 'Delete';
      case 'unmonitor': return 'Unmonitor';
      case 'unmonitor_delete': return 'Unmonitor & Delete';
      case 'tag': return 'Add Tag';
      default: return action;
    }
  };

  const getMediaTypeLabel = (mediaType: string) => {
    switch (mediaType) {
      case 'movie': return 'Movies';
      case 'series': return 'TV Shows';
      case 'both': return 'Movies & TV';
      default: return mediaType;
    }
  };

  const formatCondition = (condition: PresetCondition) => {
    const fieldLabels: Record<string, string> = {
      lastWatched: 'Last Watched',
      addedDate: 'Date Added',
      size: 'Size',
      rating: 'Rating',
      year: 'Year',
      hasFile: 'Has File',
      monitored: 'Monitored',
      genre: 'Genre',
      tag: 'Tag',
    };
    
    const operatorLabels: Record<string, string> = {
      greaterThan: '>',
      lessThan: '<',
      equals: '=',
      contains: 'contains',
      notContains: 'not contains',
    };
    
    const field = fieldLabels[condition.field] || condition.field;
    const op = operatorLabels[condition.operator] || condition.operator;
    
    // Format value based on field type
    let value = String(condition.value);
    if (condition.field === 'lastWatched' || condition.field === 'addedDate') {
      value = `${condition.value} days`;
    } else if (condition.field === 'size') {
      value = `${condition.value} GB`;
    } else if (condition.field === 'hasFile' || condition.field === 'monitored') {
      value = condition.value ? 'Yes' : 'No';
    }
    
    return `${field} ${op} ${value}`;
  };

  const handlePresetClick = (preset: RulePreset) => {
    setSelectedPreset(selectedPreset?.id === preset.id ? null : preset);
  };

  const handleUsePreset = () => {
    if (selectedPreset) {
      onSelect(selectedPreset);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col m-4">
        {/* Header */}
        <div className="p-6 border-b border-color">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-semibold">Rule Presets</h2>
              <p className="text-sm text-muted mt-1">
                Choose a pre-configured rule to get started quickly
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-secondary hover:text-primary p-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search presets..."
              className="input w-full pl-10"
            />
            <svg 
              className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar - Categories */}
          <div className="w-48 border-r border-color p-4 overflow-y-auto">
            <h3 className="text-xs font-semibold text-muted uppercase mb-3">Categories</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                  selectedCategory === null
                    ? 'bg-orange-600/20 text-orange-400'
                    : 'text-secondary hover:bg-hover'
                }`}
              >
                <span className="mr-2">📋</span>
                All Presets
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                    selectedCategory === category.id
                      ? 'bg-orange-600/20 text-orange-400'
                      : 'text-secondary hover:bg-hover'
                  }`}
                >
                  <span className="mr-2">{category.icon}</span>
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Main content - Preset list */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted">Loading presets...</div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-red-400">{error}</div>
              </div>
            ) : presetList.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted">No presets found</div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {presetList.map((preset) => (
                  <div
                    key={preset.id}
                    onClick={() => handlePresetClick(preset)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedPreset?.id === preset.id
                        ? 'border-orange-500 bg-orange-600/10'
                        : 'border-color hover:border-orange-500/50 bg-tertiary'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">{preset.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{preset.name}</h4>
                          <span className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(preset.difficulty)}`}>
                            {preset.difficulty}
                          </span>
                        </div>
                        <p className="text-sm text-secondary line-clamp-2">{preset.description}</p>
                        
                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="px-2 py-0.5 bg-secondary rounded text-xs text-muted">
                            {getMediaTypeLabel(preset.mediaType)}
                          </span>
                          <span className="px-2 py-0.5 bg-secondary rounded text-xs text-muted">
                            {getActionLabel(preset.action)}
                          </span>
                          {preset.gracePeriodDays > 0 && (
                            <span className="px-2 py-0.5 bg-secondary rounded text-xs text-muted">
                              {preset.gracePeriodDays}d grace
                            </span>
                          )}
                        </div>
                        
                        {/* Show conditions when selected */}
                        {selectedPreset?.id === preset.id && (
                          <div className="mt-4 pt-3 border-t border-color">
                            <div className="text-xs text-muted mb-2">Conditions:</div>
                            <div className="flex flex-wrap gap-1">
                              {preset.conditions.map((condition, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 bg-hover rounded text-xs"
                                >
                                  {formatCondition(condition)}
                                </span>
                              ))}
                            </div>
                            
                            {preset.tags.length > 0 && (
                              <div className="mt-3">
                                <div className="text-xs text-muted mb-2">Tags:</div>
                                <div className="flex flex-wrap gap-1">
                                  {preset.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="px-2 py-0.5 bg-orange-900/30 text-orange-400 rounded text-xs"
                                    >
                                      #{tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Selection indicator */}
                      {selectedPreset?.id === preset.id && (
                        <div className="text-orange-500">
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-color flex justify-between items-center">
          <div className="text-sm text-muted">
            {selectedPreset ? (
              <span>
                Selected: <span className="text-orange-400">{selectedPreset.name}</span>
              </span>
            ) : (
              <span>Select a preset to continue</span>
            )}
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button
              onClick={handleUsePreset}
              disabled={!selectedPreset}
              className="btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Use This Preset
            </button>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  );
}

export default PresetBrowser;
