import { useState, useEffect, useCallback } from 'react';
import { rules, mediaServers, arrApps, settings } from '../api';
import type { Rule, MediaServer, ArrApp } from '../api/types';
import type { RulePreviewItem, RulePreviewResult, RulePreset } from '../api';
import { LoadingPage } from '../components/LoadingSpinner';
import { PresetBrowser } from '../components/PresetBrowser';
import { Portal } from '../components/Portal';

// Condition types for different fields
const CONDITION_FIELDS = [
  { value: 'lastWatched', label: 'Last Watched', type: 'days' },
  { value: 'addedDate', label: 'Date Added', type: 'days' },
  { value: 'size', label: 'File Size', type: 'size' },
  { value: 'rating', label: 'Rating', type: 'number' },
  { value: 'year', label: 'Release Year', type: 'number' },
  { value: 'hasFile', label: 'Has File', type: 'boolean' },
  { value: 'monitored', label: 'Is Monitored', type: 'boolean' },
  { value: 'genre', label: 'Genre', type: 'text' },
  { value: 'tag', label: 'Has Tag', type: 'text' },
];

const OPERATORS = {
  days: [
    { value: 'greaterThan', label: 'More than X days ago' },
    { value: 'lessThan', label: 'Less than X days ago' },
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'greaterThan', label: 'Greater than' },
    { value: 'lessThan', label: 'Less than' },
  ],
  size: [
    { value: 'greaterThan', label: 'Larger than' },
    { value: 'lessThan', label: 'Smaller than' },
  ],
  boolean: [
    { value: 'equals', label: 'Is' },
  ],
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'notContains', label: 'Does not contain' },
    { value: 'equals', label: 'Equals' },
  ],
};

interface RuleCondition {
  field: string;
  operator: string;
  value: string | number | boolean;
}

function Rules() {
  const [rulesList, setRulesList] = useState<Rule[]>([]);
  const [servers, setServers] = useState<MediaServer[]>([]);
  const [apps, setApps] = useState<ArrApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<RulePreset | null>(null);
  const [showPresetBrowser, setShowPresetBrowser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunMode, setDryRunMode] = useState(true);
  const [dryRunSaving, setDryRunSaving] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rulesRes, serversRes, appsRes, settingsRes] = await Promise.all([
        rules.list(),
        mediaServers.list(),
        arrApps.list(),
        settings.getGroup('cleanup'),
      ]);
      setRulesList(rulesRes.data);
      setServers(serversRes.data);
      setApps(appsRes.data);
      // Load dry run setting
      setDryRunMode(settingsRes.data['cleanup.schedule.dryRun'] !== 'false');
    } catch (err) {
      console.error('Failed to fetch data:', err);
      setError('Failed to load rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleDryRun = async () => {
    const newValue = !dryRunMode;
    setDryRunSaving(true);
    try {
      await settings.set('cleanup.schedule.dryRun', String(newValue));
      setDryRunMode(newValue);
    } catch (err) {
      console.error('Failed to save dry run setting:', err);
    } finally {
      setDryRunSaving(false);
    }
  };

  const handleCreateRule = () => {
    setEditingRule(null);
    setSelectedPreset(null);
    setShowModal(true);
  };

  const handleUsePreset = (preset: RulePreset) => {
    setSelectedPreset(preset);
    setShowPresetBrowser(false);
    setEditingRule(null);
    setShowModal(true);
  };

  const handleEditRule = (rule: Rule) => {
    setEditingRule(rule);
    setShowModal(true);
  };

  const handleToggleRule = async (rule: Rule) => {
    try {
      await rules.update(rule.id, { isEnabled: !rule.isEnabled });
      fetchData();
    } catch (err) {
      console.error('Failed to toggle rule:', err);
    }
  };

  const handleDeleteRule = async (id: number) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await rules.delete(id);
      fetchData();
    } catch (err) {
      console.error('Failed to delete rule:', err);
    }
  };

  const handleRunRule = async (id: number) => {
    try {
      const result = await rules.run(id);
      const data = result.data as { message: string; dryRun: boolean; ruleName?: string };
      if (data.dryRun) {
        alert(`${data.message}\n\nTo perform actual deletions, disable Dry Run mode.`);
      } else {
        alert(data.message);
      }
    } catch (err) {
      console.error('Failed to run rule:', err);
    }
  };

  const handleSaveRule = async (ruleData: Partial<Rule>) => {
    try {
      if (editingRule) {
        await rules.update(editingRule.id, ruleData);
      } else {
        await rules.create(ruleData);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      throw new Error(err.message || 'Failed to save rule');
    }
  };

  if (loading) {
    return <LoadingPage />;
  }

  // Check if we have the required services
  const hasArrApps = apps.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Rules</h1>
        <div className="flex items-center gap-4">
          {/* Dry Run Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleDryRun}
              disabled={dryRunSaving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                dryRunSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
              } ${dryRunMode ? 'bg-yellow-600' : 'bg-green-600'}`}
              title={dryRunMode ? 'Dry Run Mode: Rules will preview changes without deleting' : 'Live Mode: Rules will actually delete files'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  dryRunMode ? 'translate-x-1' : 'translate-x-6'
                }`}
              />
            </button>
            <span className={`text-sm font-medium w-16 ${dryRunMode ? 'text-yellow-400' : 'text-green-400'}`}>
              {dryRunMode ? 'Dry Run' : 'Live'}
            </span>
          </div>
          <button 
            onClick={() => setShowPresetBrowser(true)} 
            className="btn btn-secondary"
            disabled={!hasArrApps}
            title={!hasArrApps ? 'Add an Arr service first' : 'Choose from preset rules'}
          >
            📋 Use Preset
          </button>
          <button 
            onClick={handleCreateRule} 
            className="btn btn-primary"
            disabled={!hasArrApps}
            title={!hasArrApps ? 'Add an Arr service first' : ''}
          >
            + Add Rule
          </button>
        </div>
      </div>

      {!hasArrApps && (
        <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-4">
          <p className="text-yellow-200">
            You need to add at least one Arr service (Radarr/Sonarr) before creating rules.{' '}
            <a href="/settings/arr" className="text-orange-400 hover:underline">
              Add Arr Service →
            </a>
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {rulesList.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-secondary mb-4">
            <svg
              className="w-16 h-16 mx-auto mb-4 opacity-50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            <p className="text-lg">No rules configured yet</p>
            <p className="text-sm mt-2">
              Create a rule to start automatically cleaning up your media library.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button 
              onClick={() => setShowPresetBrowser(true)} 
              className="btn btn-secondary"
              disabled={!hasArrApps}
            >
              📋 Browse Presets
            </button>
            <button 
              onClick={handleCreateRule} 
              className="btn btn-primary"
              disabled={!hasArrApps}
            >
              Create Custom Rule
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {rulesList.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              arrApps={apps}
              onEdit={() => handleEditRule(rule)}
              onToggle={() => handleToggleRule(rule)}
              onDelete={() => handleDeleteRule(rule.id)}
              onRun={() => handleRunRule(rule.id)}
            />
          ))}
        </div>
      )}

      {showModal && (
        <RuleModal
          rule={editingRule}
          preset={selectedPreset}
          arrApps={apps}
          mediaServers={servers}
          onSave={handleSaveRule}
          onClose={() => {
            setShowModal(false);
            setSelectedPreset(null);
          }}
          onOpenPresets={() => {
            setShowModal(false);
            setShowPresetBrowser(true);
          }}
        />
      )}

      {showPresetBrowser && (
        <PresetBrowser
          onSelect={handleUsePreset}
          onClose={() => setShowPresetBrowser(false)}
        />
      )}
    </div>
  );
}

interface RuleCardProps {
  rule: Rule;
  arrApps: ArrApp[];
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onRun: () => void;
}

function RuleCard({ rule, arrApps, onEdit, onToggle, onDelete, onRun }: RuleCardProps) {
  const conditions: RuleCondition[] = JSON.parse(rule.conditions || '[]');
  const arrApp = arrApps.find(a => a.id === rule.arrAppId);

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'delete': return 'Delete files';
      case 'unmonitor': return 'Unmonitor';
      case 'unmonitor_delete': return 'Unmonitor & Delete';
      case 'tag': return 'Add tag';
      default: return action;
    }
  };

  const formatCondition = (condition: RuleCondition) => {
    const field = CONDITION_FIELDS.find(f => f.value === condition.field);
    const fieldLabel = field?.label || condition.field;
    
    if (field?.type === 'days') {
      return `${fieldLabel} ${condition.operator === 'greaterThan' ? '>' : '<'} ${condition.value} days`;
    }
    if (field?.type === 'size') {
      return `${fieldLabel} ${condition.operator === 'greaterThan' ? '>' : '<'} ${condition.value} GB`;
    }
    if (field?.type === 'boolean') {
      return `${fieldLabel} = ${condition.value ? 'Yes' : 'No'}`;
    }
    return `${fieldLabel} ${condition.operator} ${condition.value}`;
  };

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold">{rule.name}</h3>
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                rule.isEnabled
                  ? 'bg-green-900/50 text-green-300'
                  : 'badge-disabled'
              }`}
            >
              {rule.isEnabled ? 'Active' : 'Disabled'}
            </span>
          </div>
          {rule.description && (
            <p className="text-secondary mt-1">{rule.description}</p>
          )}

          <div className="flex flex-wrap gap-4 mt-4 text-sm">
            <div>
              <span className="text-muted">Service:</span>{' '}
              <span className="text-secondary">{arrApp?.name || 'Unknown'}</span>
            </div>
            <div>
              <span className="text-muted">Type:</span>{' '}
              <span className="text-secondary capitalize">{rule.mediaType}</span>
            </div>
            <div>
              <span className="text-muted">Action:</span>{' '}
              <span className="text-secondary">{getActionLabel(rule.action)}</span>
            </div>
            {rule.gracePeriodDays > 0 && (
              <div>
                <span className="text-muted">Grace Period:</span>{' '}
                <span className="text-secondary">{rule.gracePeriodDays} days</span>
              </div>
            )}
          </div>

          {conditions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-muted mb-2">Conditions:</p>
              <div className="flex flex-wrap gap-2">
                {conditions.map((condition, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-tertiary rounded text-xs text-secondary"
                  >
                    {formatCondition(condition)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {rule.lastRun && (
            <p className="text-xs text-muted mt-4">
              Last run: {new Date(rule.lastRun).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onRun}
            className="btn btn-secondary text-sm"
            title="Run now"
          >
            ▶ Run
          </button>
          <button
            onClick={onEdit}
            className="btn btn-secondary text-sm"
          >
            Edit
          </button>
          <button
            onClick={onToggle}
            className={`btn text-sm ${
              rule.isEnabled ? 'btn-secondary' : 'btn-primary'
            }`}
          >
            {rule.isEnabled ? 'Disable' : 'Enable'}
          </button>
          <button onClick={onDelete} className="btn btn-danger text-sm">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface RuleModalProps {
  rule: Rule | null;
  preset: RulePreset | null;
  arrApps: ArrApp[];
  mediaServers: MediaServer[];
  onSave: (data: Partial<Rule>) => Promise<void>;
  onClose: () => void;
  onOpenPresets: () => void;
}

function RuleModal({ rule, preset, arrApps, mediaServers, onSave, onClose, onOpenPresets }: RuleModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Determine the appropriate arr app based on preset media type
  const getInitialArrAppId = () => {
    if (rule?.arrAppId) return rule.arrAppId;
    
    // If preset specifies a media type, find a matching arr app
    if (preset?.mediaType === 'series') {
      const sonarrApp = arrApps.find(app => app.type === 'sonarr');
      if (sonarrApp) return sonarrApp.id;
    } else if (preset?.mediaType === 'movie') {
      const radarrApp = arrApps.find(app => app.type === 'radarr');
      if (radarrApp) return radarrApp.id;
    }
    
    // Default to first app
    return arrApps[0]?.id || 0;
  };

  // Determine initial values from rule or preset
  const getInitialMediaType = () => {
    if (rule?.mediaType) return rule.mediaType;
    if (preset?.mediaType === 'movie') return 'movie';
    if (preset?.mediaType === 'series') return 'series';
    // For 'both', we'll set it based on the selected arr app
    const initialAppId = getInitialArrAppId();
    const initialApp = arrApps.find(app => app.id === initialAppId);
    if (initialApp?.type === 'radarr') return 'movie';
    return 'series';
  };

  // Form state - initialize from rule first, then preset, then defaults
  const [name, setName] = useState(rule?.name || preset?.name || '');
  const [description, setDescription] = useState(rule?.description || preset?.description || '');
  const [arrAppId, setArrAppId] = useState<number>(getInitialArrAppId());
  const [mediaServerId, setMediaServerId] = useState<number | undefined>(rule?.mediaServerId || undefined);
  const [mediaType, setMediaType] = useState(getInitialMediaType());
  const [action, setAction] = useState(rule?.action || preset?.action || 'delete');
  const [gracePeriodDays, setGracePeriodDays] = useState(rule?.gracePeriodDays ?? preset?.gracePeriodDays ?? 0);
  const [showInCollection, setShowInCollection] = useState(rule?.showInCollection ?? true);
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule?.conditions ? JSON.parse(rule.conditions) : (preset?.conditions || [])
  );

  // Preview state
  const [previewExpanded, setPreviewExpanded] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<RulePreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Get the selected arr app type to determine media type options
  const selectedApp = arrApps.find(a => a.id === arrAppId);
  const isRadarr = selectedApp?.type === 'radarr';

  // Update media type when arr app changes
  useEffect(() => {
    if (isRadarr) {
      setMediaType('movie');
    } else {
      setMediaType('series');
    }
  }, [arrAppId, isRadarr]);

  // Debounced preview fetch
  const fetchPreview = useCallback(async () => {
    if (!arrAppId || conditions.length === 0) {
      setPreviewResult(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);

    try {
      const result = await rules.preview({
        arrAppId,
        conditions,
        limit: 5,
      });
      setPreviewResult(result.data);
    } catch (err: any) {
      setPreviewError(err.message || 'Failed to load preview');
      setPreviewResult(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [arrAppId, conditions]);

  // Auto-fetch preview when conditions change (debounced)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (conditions.length > 0 && arrAppId) {
        fetchPreview();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [conditions, arrAppId, fetchPreview]);

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      { field: 'lastWatched', operator: 'greaterThan', value: 30 },
    ]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (index: number, field: string, value: any) => {
    const newConditions = [...conditions];
    newConditions[index] = { ...newConditions[index], [field]: value };
    
    // Reset operator and value when field changes
    if (field === 'field') {
      const fieldDef = CONDITION_FIELDS.find(f => f.value === value);
      const operators = OPERATORS[fieldDef?.type as keyof typeof OPERATORS] || OPERATORS.text;
      newConditions[index].operator = operators[0].value;
      newConditions[index].value = fieldDef?.type === 'boolean' ? true : '';
    }
    
    setConditions(newConditions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    
    if (!arrAppId) {
      setError('Please select an Arr service');
      return;
    }

    if (conditions.length === 0) {
      setError('At least one condition is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
        arrAppId,
        mediaServerId: mediaServerId || undefined,
        mediaType,
        action,
        gracePeriodDays,
        showInCollection,
        conditions,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 m-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {rule ? 'Edit Rule' : 'Create Rule'}
          </h2>
          {!rule && (
            <button
              type="button"
              onClick={onOpenPresets}
              className="btn btn-secondary text-sm"
            >
              📋 Browse Presets
            </button>
          )}
        </div>

        {/* Show preset badge if using a preset */}
        {preset && !rule && (
          <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-3 mb-4 flex items-center gap-3">
            <span className="text-2xl">{preset.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-orange-300">Using preset:</span>
                <span>{preset.name}</span>
              </div>
              <p className="text-sm text-muted mt-1">{preset.description}</p>
            </div>
            <button
              type="button"
              onClick={onOpenPresets}
              className="text-orange-400 hover:text-orange-300 text-sm"
            >
              Change
            </button>
          </div>
        )}

        {/* Warning if preset requires a service type that isn't configured */}
        {preset && !rule && preset.mediaType !== 'both' && (() => {
          const requiredType = preset.mediaType === 'series' ? 'sonarr' : 'radarr';
          const hasRequiredService = arrApps.some(app => app.type === requiredType);
          if (!hasRequiredService) {
            return (
              <div className="bg-yellow-900/30 border border-yellow-700 rounded-lg p-3 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-yellow-200 text-sm">
                  This preset is designed for <strong>{preset.mediaType === 'series' ? 'TV Shows (Sonarr)' : 'Movies (Radarr)'}</strong>, 
                  but you don't have a {requiredType === 'sonarr' ? 'Sonarr' : 'Radarr'} service configured. 
                  <a href="/settings" className="text-orange-400 hover:underline ml-1">Add one in Settings</a>
                </span>
              </div>
            );
          }
          return null;
        })()}

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 mb-4 text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="form-label block mb-1">Rule Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input w-full"
                placeholder="e.g., Delete old watched movies"
              />
            </div>
            
            <div className="col-span-2">
              <label className="form-label block mb-1">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="input w-full"
                placeholder="Optional description"
              />
            </div>
          </div>

          {/* Service Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label block mb-1">Arr Service *</label>
              <select
                value={arrAppId}
                onChange={(e) => setArrAppId(parseInt(e.target.value))}
                className="input w-full"
              >
                {arrApps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name} ({app.type})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="form-label block mb-1">Media Server (Optional)</label>
              <select
                value={mediaServerId || ''}
                onChange={(e) => setMediaServerId(e.target.value ? parseInt(e.target.value) : undefined)}
                className="input w-full"
              >
                <option value="">Any / Not required</option>
                {mediaServers.map((server) => (
                  <option key={server.id} value={server.id}>
                    {server.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="form-label block mb-1">Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="input w-full"
              >
                <option value="delete">Delete files</option>
                <option value="unmonitor">Unmonitor only</option>
                <option value="unmonitor_delete">Unmonitor & Delete</option>
                <option value="tag">Add tag</option>
              </select>
            </div>
            
            <div>
              <label className="form-label block mb-1">Grace Period (days)</label>
              <input
                type="number"
                value={gracePeriodDays}
                onChange={(e) => setGracePeriodDays(parseInt(e.target.value) || 0)}
                className="input w-full"
                min={0}
                placeholder="0"
              />
              <p className="text-xs text-muted mt-1">
                Items will be shown in collection before action
              </p>
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="form-label">Conditions *</label>
              <button
                type="button"
                onClick={handleAddCondition}
                className="text-orange-400 hover:text-orange-300 text-sm"
              >
                + Add Condition
              </button>
            </div>
            
            {conditions.length === 0 ? (
              <div className="bg-tertiary rounded-lg p-4 text-center text-muted text-sm">
                No conditions yet. Add at least one condition.
              </div>
            ) : (
              <div className="space-y-2">
                {conditions.map((condition, index) => (
                  <ConditionRow
                    key={index}
                    condition={condition}
                    onChange={(field, value) => handleConditionChange(index, field, value)}
                    onRemove={() => handleRemoveCondition(index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Preview Section */}
          {conditions.length > 0 && (
            <div className="border border-color rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setPreviewExpanded(!previewExpanded)}
                className="w-full flex items-center justify-between p-3 bg-tertiary hover:bg-hover transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Preview</span>
                  {previewLoading && (
                    <span className="text-xs text-muted">(loading...)</span>
                  )}
                  {!previewLoading && previewResult && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      previewResult.totalMatches > 0 
                        ? 'bg-orange-900/50 text-orange-300' 
                        : 'bg-tertiary text-muted'
                    }`}>
                      {previewResult.totalMatches} item{previewResult.totalMatches !== 1 ? 's' : ''} match
                    </span>
                  )}
                  {previewResult?.totalSizeFormatted && previewResult.totalMatches > 0 && (
                    <span className="text-xs text-muted">
                      ({previewResult.totalSizeFormatted} total)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fetchPreview();
                    }}
                    className="text-xs text-orange-400 hover:text-orange-300 p-1"
                    title="Refresh preview"
                  >
                    <svg className={`w-4 h-4 ${previewLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                  <svg 
                    className={`w-5 h-5 transition-transform ${previewExpanded ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              
              {previewExpanded && (
                <div className="p-3 border-t border-color">
                  {previewError && (
                    <div className="text-red-400 text-sm mb-2">{previewError}</div>
                  )}
                  
                  {previewLoading && (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-muted text-sm">Loading preview...</div>
                    </div>
                  )}
                  
                  {!previewLoading && !previewResult && (
                    <div className="text-center py-4 text-muted text-sm">
                      Add conditions to see matching items
                    </div>
                  )}
                  
                  {!previewLoading && previewResult && previewResult.items.length === 0 && (
                    <div className="text-center py-4 text-muted text-sm">
                      No items match the current conditions
                    </div>
                  )}
                  
                  {!previewLoading && previewResult && previewResult.items.length > 0 && (
                    <div className="space-y-2">
                      {previewResult.items.map((item) => (
                        <PreviewItemRow key={item.id} item={item} />
                      ))}
                      
                      {previewResult.totalMatches > previewResult.items.length && (
                        <div className="text-center text-sm text-muted pt-2">
                          ...and {previewResult.totalMatches - previewResult.items.length} more item{previewResult.totalMatches - previewResult.items.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Options */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showInCollection}
                onChange={(e) => setShowInCollection(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Show matched items in collection before taking action</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-color">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? 'Saving...' : rule ? 'Save Changes' : 'Create Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}

// Preview item row component
function PreviewItemRow({ item }: { item: RulePreviewItem }) {
  const [showDetails, setShowDetails] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  return (
    <div className="bg-tertiary rounded-lg overflow-hidden">
      <div 
        className="flex items-center gap-3 p-2 cursor-pointer hover:bg-hover transition-colors"
        onClick={() => setShowDetails(!showDetails)}
      >
        {/* Poster */}
        <div className="w-10 h-14 bg-secondary rounded flex-shrink-0 overflow-hidden">
          {item.posterUrl && !imageError ? (
            <img 
              src={item.posterUrl} 
              alt={item.title}
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-xs">
              🎬
            </div>
          )}
        </div>
        
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate">{item.title}</div>
          <div className="text-xs text-muted">
            {item.year} • {item.sizeFormatted} • Added {item.addedDaysAgo}d ago
            {item.lastWatchedDaysAgo !== null && item.lastWatchedDaysAgo !== undefined && (
              <> • Watched {item.lastWatchedDaysAgo}d ago</>
            )}
            {item.lastWatchedDaysAgo === null && (
              <> • <span className="text-yellow-500">Never watched</span></>
            )}
          </div>
        </div>
        
        {/* Expand icon */}
        <svg 
          className={`w-4 h-4 text-muted transition-transform ${showDetails ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      
      {/* Details */}
      {showDetails && (
        <div className="px-3 pb-3 pt-1 border-t border-color">
          <div className="text-xs text-muted mb-1">Matched conditions:</div>
          <div className="flex flex-wrap gap-1">
            {item.matchedConditions.map((condition, idx) => (
              <span 
                key={idx}
                className="px-2 py-0.5 bg-green-900/30 text-green-400 rounded text-xs"
              >
                ✓ {condition}
              </span>
            ))}
          </div>
          {item.genres.length > 0 && (
            <div className="mt-2 text-xs text-muted">
              Genres: {item.genres.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ConditionRowProps {
  condition: RuleCondition;
  onChange: (field: string, value: any) => void;
  onRemove: () => void;
}

function ConditionRow({ condition, onChange, onRemove }: ConditionRowProps) {
  const fieldDef = CONDITION_FIELDS.find(f => f.value === condition.field);
  const operators = OPERATORS[fieldDef?.type as keyof typeof OPERATORS] || OPERATORS.text;

  return (
    <div className="flex items-center gap-2 bg-tertiary rounded-lg p-3">
      <select
        value={condition.field}
        onChange={(e) => onChange('field', e.target.value)}
        className="input flex-1"
      >
        {CONDITION_FIELDS.map((field) => (
          <option key={field.value} value={field.value}>
            {field.label}
          </option>
        ))}
      </select>
      
      <select
        value={condition.operator}
        onChange={(e) => onChange('operator', e.target.value)}
        className="input flex-1"
      >
        {operators.map((op) => (
          <option key={op.value} value={op.value}>
            {op.label}
          </option>
        ))}
      </select>
      
      {fieldDef?.type === 'boolean' ? (
        <select
          value={condition.value ? 'true' : 'false'}
          onChange={(e) => onChange('value', e.target.value === 'true')}
          className="input flex-1"
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : (
        <input
          type={fieldDef?.type === 'text' ? 'text' : 'number'}
          value={condition.value as string}
          onChange={(e) => onChange('value', fieldDef?.type === 'text' ? e.target.value : parseInt(e.target.value) || 0)}
          className="input flex-1"
          placeholder={fieldDef?.type === 'days' ? 'Days' : fieldDef?.type === 'size' ? 'GB' : 'Value'}
        />
      )}
      
      <button
        type="button"
        onClick={onRemove}
        className="text-red-400 hover:text-red-300 p-1"
        title="Remove condition"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default Rules;
