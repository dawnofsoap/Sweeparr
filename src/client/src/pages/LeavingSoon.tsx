import { useState, useEffect, useCallback } from 'react';
import { leavingSoon, mediaServers, collections } from '../api';
import type {
  LeavingSoonSettings,
  LeavingSoonItem,
  LeavingSoonItemsResponse,
  LeavingSoonStatus,
  MediaServer,
  Collection,
} from '../api/types';
import { LoadingPage, LoadingSpinner } from '../components/LoadingSpinner';

// ============================================
// Helper Functions
// ============================================

function formatDaysUntil(days: number): { text: string; isUrgent: boolean } {
  let text: string;
  if (days <= 0) {
    text = 'Expired';
  } else if (days === 1) {
    text = 'Tomorrow';
  } else if (days <= 7) {
    text = `${days} days`;
  } else if (days <= 30) {
    text = `${Math.ceil(days / 7)} weeks`;
  } else {
    text = `${Math.ceil(days / 30)} months`;
  }

  return { text, isUrgent: days <= 7 };
}

// ============================================
// Main Component
// ============================================

function LeavingSoonPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [settings, setSettings] = useState<LeavingSoonSettings | null>(null);
  const [status, setStatus] = useState<LeavingSoonStatus | null>(null);
  const [items, setItems] = useState<LeavingSoonItemsResponse | null>(null);
  const [servers, setServers] = useState<MediaServer[]>([]);
  const [exclusionLists, setExclusionLists] = useState<Collection[]>([]);
  const [activeTab, setActiveTab] = useState<'movies' | 'series'>('movies');
  const [showSettings, setShowSettings] = useState(false);
  const [showCreateExclusionModal, setShowCreateExclusionModal] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [settingsRes, statusRes, itemsRes, serversRes, collectionsRes] = await Promise.all([
        leavingSoon.getSettings(),
        leavingSoon.getStatus(),
        leavingSoon.getItems(),
        mediaServers.list(),
        collections.list(),
      ]);

      setSettings(settingsRes.data);
      setStatus(statusRes.data);
      setItems(itemsRes.data);
      setServers(serversRes.data.filter(s => s.type === 'jellyfin' || s.type === 'emby'));
      // Filter to only exclusion lists
      setExclusionLists(collectionsRes.data.filter((c: Collection) => c.isExclusion));
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await leavingSoon.sync();
      setToastMessage(result.data.message);
      await fetchData();
    } catch (error) {
      console.error('Sync failed:', error);
      setToastMessage('Sync failed. Check logs for details.');
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleEnabled = async () => {
    if (!settings) return;
    
    try {
      const newValue = settings['leavingSoon.enabled'] === 'true' ? 'false' : 'true';
      await leavingSoon.updateSettings({ 'leavingSoon.enabled': newValue });
      await fetchData();
      setToastMessage(newValue === 'true' ? 'Leaving Soon enabled' : 'Leaving Soon disabled');
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  };

  const handleRefreshLibraries = async () => {
    try {
      const result = await leavingSoon.refreshAll();
      setToastMessage(result.data.message);
    } catch (error) {
      console.error('Failed to refresh libraries:', error);
      setToastMessage('Failed to trigger library refresh');
    }
  };

  const handleClearSymlinks = async () => {
    if (!confirm('Are you sure you want to remove all symlinks? This will clear the Leaving Soon folders.')) {
      return;
    }
    
    try {
      const result = await leavingSoon.clearSymlinks();
      setToastMessage(`Removed ${result.data.removed} symlinks`);
      await fetchData();
    } catch (error) {
      console.error('Failed to clear symlinks:', error);
      setToastMessage('Failed to clear symlinks');
    }
  };

  const handleCreateExclusionList = async (data: { name: string; description?: string }) => {
    try {
      await collections.create({
        name: data.name,
        description: data.description,
        isExclusion: true,
      });
      setShowCreateExclusionModal(false);
      setToastMessage('Exclusion list created');
      await fetchData();
    } catch (error) {
      console.error('Failed to create exclusion list:', error);
      setToastMessage('Failed to create exclusion list');
    }
  };

  const handleDeleteExclusionList = async (id: number) => {
    if (!confirm('Are you sure you want to delete this exclusion list? Items will not be deleted.')) {
      return;
    }
    
    try {
      await collections.delete(id);
      setToastMessage('Exclusion list deleted');
      await fetchData();
    } catch (error) {
      console.error('Failed to delete exclusion list:', error);
      setToastMessage('Failed to delete exclusion list');
    }
  };

  useEffect(() => {
    if (toastMessage) {
      const timeout = setTimeout(() => setToastMessage(null), 5000);
      return () => clearTimeout(timeout);
    }
  }, [toastMessage]);

  if (loading) {
    return <LoadingPage />;
  }

  const isEnabled = settings?.['leavingSoon.enabled'] === 'true';
  const currentItems = activeTab === 'movies' ? items?.movies : items?.series;

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-green-800 text-white px-4 py-2 rounded-lg shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Leaving Soon</h1>
          <p className="text-secondary mt-1">
            Media scheduled for cleanup - symlinked for easy browsing in your media server
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="btn btn-secondary"
          >
            ⚙️ Settings
          </button>
          <button
            onClick={handleSync}
            disabled={syncing || !isEnabled}
            className="btn btn-primary"
          >
            {syncing ? (
              <>
                <LoadingSpinner size="sm" /> Syncing...
              </>
            ) : (
              '🔄 Sync Now'
            )}
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && settings && (
        <SettingsPanel
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={async (newSettings) => {
            await leavingSoon.updateSettings(newSettings);
            await fetchData();
            setShowSettings(false);
            setToastMessage('Settings saved');
          }}
        />
      )}

      {/* Status Banner */}
      <div className={`card p-4 ${isEnabled ? 'border-green-500/50' : 'border-yellow-500/50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-yellow-500'}`} />
            <span className="font-medium">
              {isEnabled ? 'Symlinks are being managed' : 'Feature is paused'}
            </span>
            {status?.autoSyncEnabled && isEnabled && (
              <span className="text-sm text-muted">
                (auto-sync every {status.syncIntervalMinutes} min)
              </span>
            )}
          </div>
          <button
            onClick={handleToggleEnabled}
            className={`btn ${isEnabled ? 'btn-secondary' : 'btn-primary'}`}
          >
            {isEnabled ? 'Pause' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-orange-400">{items?.totalCount || 0}</p>
          <p className="text-sm text-muted mt-1">Total Items</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-blue-400">{items?.movieCount || 0}</p>
          <p className="text-sm text-muted mt-1">Movies</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-purple-400">{items?.seriesCount || 0}</p>
          <p className="text-sm text-muted mt-1">TV Shows</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-3xl font-bold text-red-400">
            {items?.expiringSoonCount || 0}
          </p>
          <p className="text-sm text-muted mt-1">Expiring This Week</p>
        </div>
      </div>

      {/* Symlink Status - Links to Settings */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Symlink Configuration</h2>
            <p className="text-sm text-muted mt-1">
              Symlink paths are configured in Settings → Path Mappings
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshLibraries}
              className="btn btn-secondary text-sm"
              disabled={servers.length === 0}
            >
              🔄 Refresh Libraries
            </button>
            <a href="/settings/path-mappings" className="btn btn-primary text-sm">
              ⚙️ Configure Paths
            </a>
          </div>
        </div>

        {servers.length === 0 ? (
          <div className="text-center py-6 text-muted bg-tertiary rounded-lg">
            <span className="text-3xl mb-2 block">📺</span>
            <p>No media servers configured</p>
            <p className="text-sm mt-1">
              Add a Jellyfin or Emby server in Settings to configure symlinks
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {servers.map(server => {
              const hasConfig = server.leavingSoonMoviesPath || server.leavingSoonTvPath;
              return (
                <div key={server.id} className="bg-tertiary rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
                        {server.type === 'jellyfin' ? '💙' : '💚'}
                      </div>
                      <div>
                        <h4 className="font-medium">{server.name}</h4>
                        <p className="text-sm text-muted capitalize">{server.type}</p>
                      </div>
                    </div>
                    {hasConfig ? (
                      <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded">Configured</span>
                    ) : (
                      <span className="px-2 py-1 bg-yellow-900 text-yellow-300 text-xs rounded">Not Configured</span>
                    )}
                  </div>
                  {hasConfig && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {server.leavingSoonMoviesPath && (
                        <div className="bg-black/20 rounded px-3 py-2">
                          <span className="text-xs">🎬 Movies: </span>
                          <code className="text-xs text-muted">{server.leavingSoonMoviesPath}</code>
                        </div>
                      )}
                      {server.leavingSoonTvPath && (
                        <div className="bg-black/20 rounded px-3 py-2">
                          <span className="text-xs">📺 TV: </span>
                          <code className="text-xs text-muted">{server.leavingSoonTvPath}</code>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <p className="text-sm">
            <strong>How it works:</strong> Sweeparr creates symlinks in the configured folders pointing to media scheduled for cleanup.
            Add these folders as libraries in your media server (type: Movies / TV Shows) to browse "Leaving Soon" content.
          </p>
        </div>
      </div>

      {/* Items List */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Items Leaving Soon</h2>
          <div className="flex bg-tertiary rounded-lg p-1">
            <button
              onClick={() => setActiveTab('movies')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === 'movies'
                  ? 'bg-orange-600 text-white'
                  : 'text-muted hover:text-white'
              }`}
            >
              Movies ({items?.movieCount || 0})
            </button>
            <button
              onClick={() => setActiveTab('series')}
              className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
                activeTab === 'series'
                  ? 'bg-orange-600 text-white'
                  : 'text-muted hover:text-white'
              }`}
            >
              TV Shows ({items?.seriesCount || 0})
            </button>
          </div>
        </div>

        {!currentItems || currentItems.length === 0 ? (
          <div className="text-center py-12 text-muted">
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
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-lg">No {activeTab === 'movies' ? 'movies' : 'TV shows'} scheduled for removal</p>
            <p className="text-sm mt-2">
              Items will appear here when rules match them during their grace period.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {currentItems.map(item => (
              <ItemCard key={`${item.mediaType}-${item.id}`} item={item} />
            ))}
          </div>
        )}
      </div>

      {/* Exclusion Lists */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Exclusion Lists</h2>
            <p className="text-sm text-muted mt-1">
              Protect specific media from being cleaned up by rules
            </p>
          </div>
          <button
            onClick={() => setShowCreateExclusionModal(true)}
            className="btn btn-primary"
          >
            + New Exclusion List
          </button>
        </div>

        {exclusionLists.length === 0 ? (
          <div className="text-center py-8 text-muted bg-tertiary rounded-lg">
            <span className="text-3xl mb-2 block">🛡️</span>
            <p>No exclusion lists yet</p>
            <p className="text-sm mt-1">
              Create exclusion lists to protect specific items from cleanup
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {exclusionLists.map(list => (
              <div
                key={list.id}
                className="flex items-center justify-between p-4 bg-tertiary rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">🛡️</span>
                  <div>
                    <h4 className="font-medium">{list.name}</h4>
                    <p className="text-sm text-muted">
                      {list._count?.items || 0} items protected
                      {list.description && ` • ${list.description}`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteExclusionList(list.id)}
                  className="btn btn-danger text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Exclusion List Modal */}
      {showCreateExclusionModal && (
        <CreateExclusionListModal
          onSave={handleCreateExclusionList}
          onClose={() => setShowCreateExclusionModal(false)}
        />
      )}
    </div>
  );
}

// ============================================
// Item Card Component
// ============================================

interface ItemCardProps {
  item: LeavingSoonItem;
}

function ItemCard({ item }: ItemCardProps) {
  const expiry = formatDaysUntil(item.daysUntilExpiry);
  const [showDetails, setShowDetails] = useState(false);

  // Check if path was mapped (arrPath and localPath are different)
  const pathWasMapped = item.arrPath !== item.localPath;

  return (
    <div 
      className="flex items-center justify-between p-4 bg-tertiary rounded-lg hover:bg-tertiary/80 transition-colors cursor-pointer"
      onClick={() => setShowDetails(!showDetails)}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center text-2xl shrink-0">
          {item.mediaType === 'movie' ? '🎬' : '📺'}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-medium truncate">
            {item.title} <span className="text-muted">({item.year})</span>
          </h4>
          <p className="text-sm text-muted truncate">
            Rule: {item.ruleName}
          </p>
          <div className="text-xs text-muted mt-0.5">
            <p className="truncate" title={item.localPath}>
              📁 {item.localPath}
            </p>
            {showDetails && pathWasMapped && (
              <div className="mt-1 pl-5 space-y-0.5">
                <p className="text-gray-500 truncate" title={item.arrPath}>
                  ← Arr: {item.arrPath}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-4">
        <p className={`font-medium ${expiry.isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
          {expiry.text}
        </p>
        <p className="text-xs text-muted">
          {new Date(item.expiresAt).toLocaleDateString()}
        </p>
        {pathWasMapped && (
          <p className="text-xs text-green-500 mt-1" title="Path mapping applied">
            ✓ Mapped
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================
// Settings Panel Component
// ============================================

interface SettingsPanelProps {
  settings: LeavingSoonSettings;
  onClose: () => void;
  onSave: (settings: Partial<LeavingSoonSettings>) => Promise<void>;
}

function SettingsPanel({ settings, onClose, onSave }: SettingsPanelProps) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(localSettings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Leaving Soon Settings</h2>
        <button onClick={onClose} className="text-muted hover:text-white">
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* Sync Settings */}
        <div>
          <h3 className="font-medium mb-3">Sync Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label block mb-1">Sync Interval (minutes)</label>
              <input
                type="number"
                min="5"
                max="1440"
                value={localSettings['leavingSoon.syncIntervalMinutes']}
                onChange={(e) =>
                  setLocalSettings({
                    ...localSettings,
                    'leavingSoon.syncIntervalMinutes': e.target.value,
                  })
                }
                className="input w-full"
              />
              <p className="text-xs text-muted mt-1">
                How often to check rules and update symlinks
              </p>
            </div>
            <div className="space-y-3 pt-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings['leavingSoon.autoSync'] === 'true'}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      'leavingSoon.autoSync': e.target.checked ? 'true' : 'false',
                    })
                  }
                  className="form-checkbox"
                />
                <span>Enable auto-sync</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings['leavingSoon.refreshLibraryAfterSync'] === 'true'}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      'leavingSoon.refreshLibraryAfterSync': e.target.checked ? 'true' : 'false',
                    })
                  }
                  className="form-checkbox"
                />
                <span>Refresh media server libraries after sync</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
          <p className="text-sm">
            <strong>Note:</strong> Symlink folder paths are configured in{' '}
            <a href="/settings/path-mappings" className="text-orange-400 hover:underline">Settings → Path Mappings</a>.
          </p>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Create Exclusion List Modal
// ============================================

interface CreateExclusionListModalProps {
  onSave: (data: { name: string; description?: string }) => void;
  onClose: () => void;
}

function CreateExclusionListModal({ onSave, onClose }: CreateExclusionListModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card rounded-lg shadow-xl w-full max-w-md p-6 m-4">
        <h2 className="text-xl font-semibold mb-4">Create Exclusion List</h2>
        
        <p className="text-sm text-muted mb-4">
          Exclusion lists protect specific media from being cleaned up by rules.
          Add items manually to keep them safe.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="form-label block mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input w-full"
              placeholder="e.g., Favorites, Kids Movies"
              autoFocus
            />
          </div>
          
          <div>
            <label className="form-label block mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input w-full"
              placeholder="Optional description"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={saving || !name.trim()} 
              className="btn btn-primary"
            >
              {saving ? 'Creating...' : 'Create List'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default LeavingSoonPage;
