import { useState, useEffect } from 'react';
import { storageSources } from '../api';
import type { StorageSource, StorageSourceType, ConnectionTestResult, StorageSummary, TrueNASPool, TrueNASDataset } from '../api/types';
import { ServiceLogo } from '../components/ServiceLogos';
import { useToast } from '../contexts/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useConfirm } from '../components/ConfirmModal';

function Storage() {
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<StorageSource | null>(null);
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const fetchData = async (isInitialLoad = false) => {
    // Only show full-page loading spinner on initial load
    // For refreshes, we keep the current UI visible
    try {
      const [sourcesRes, summaryRes] = await Promise.all([
        storageSources.list(),
        storageSources.getSummary(),
      ]);
      setSources(sourcesRes.data || []);
      setSummary(summaryRes.data || null);
    } catch (error) {
      console.error('Failed to fetch storage data:', error);
      // Only show error toast if not initial load (initial errors are more visible)
      if (!isInitialLoad) {
        toast.error('Failed to load storage data');
      }
    } finally {
      // Always clear loading state after initial load completes
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(true); // isInitialLoad = true
  }, []);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await storageSources.refreshAll();
      await fetchData(); // Don't show loading spinner on refresh
      toast.success('Storage stats refreshed');
    } catch (error) {
      console.error('Failed to refresh storage stats:', error);
      toast.error('Failed to refresh storage stats');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async (id: number) => {
    const confirmed = await confirm({
      title: 'Delete Storage Source',
      message: 'Are you sure you want to delete this storage source? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      confirmVariant: 'danger',
    });
    
    if (!confirmed) return;
    
    try {
      await storageSources.delete(id);
      toast.success('Storage source deleted');
      // Immediately update local state to remove the deleted source
      setSources(prev => prev.filter(s => s.id !== id));
      // Then refresh from server in background
      fetchData();
    } catch (error) {
      console.error('Failed to delete storage source:', error);
      toast.error('Failed to delete storage source');
    }
  };

  const handleSaved = async (sourceId?: number) => {
    setShowModal(false);
    setEditingSource(null);
    
    // First refresh the list to show the new/updated source
    await fetchData();
    
    // If we have a source ID, trigger a stats refresh for that source
    // This fetches fresh data from TrueNAS/storage
    if (sourceId) {
      try {
        await storageSources.refresh(sourceId);
        // Refresh again to show updated stats
        await fetchData();
      } catch (error) {
        console.error('Failed to refresh storage stats after save:', error);
        // Don't show error toast - the source was saved successfully
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            Storage
            {refreshing && <LoadingSpinner size="sm" />}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Monitor disk usage and configure storage thresholds for automatic cleanup.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRefreshAll}
            disabled={refreshing}
            className="btn btn-secondary"
          >
            {refreshing ? 'Refreshing...' : 'Refresh All'}
          </button>
          <button
            onClick={() => {
              setEditingSource(null);
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            + Add Source
          </button>
        </div>
      </div>

      {/* Summary Card - show if we have sources, even if summary data isn't loaded yet */}
      {sources.length > 0 && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Storage Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-gray-400">Total Capacity</p>
              <p className="text-2xl font-bold">{summary?.totalSizeFormatted || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Used</p>
              <p className="text-2xl font-bold text-orange-400">{summary?.totalUsedFormatted || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Free</p>
              <p className="text-2xl font-bold text-green-400">{summary?.totalFreeFormatted || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Overall Usage</p>
              <p className="text-2xl font-bold">{summary?.overallUsedPercent ?? '—'}%</p>
            </div>
          </div>
          
          {/* Overall progress bar */}
          <div className="mt-4">
            <div className="h-4 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  parseFloat(summary?.overallUsedPercent || '0') >= 90
                    ? 'bg-red-500'
                    : parseFloat(summary?.overallUsedPercent || '0') >= 75
                    ? 'bg-orange-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${summary?.overallUsedPercent || 0}%` }}
              />
            </div>
          </div>

          {summary && summary.sourcesAboveThreshold > 0 && (
            <div className="mt-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="text-red-300">
                ⚠️ {summary.sourcesAboveThreshold} storage source{summary.sourcesAboveThreshold > 1 ? 's are' : ' is'} above threshold
              </p>
            </div>
          )}
        </div>
      )}

      {/* Storage Sources List */}
      {sources.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">💾</div>
          <h3 className="text-lg font-medium mb-2">No Storage Sources</h3>
          <p className="text-gray-400 mb-4">
            Add storage sources to monitor disk usage and set up automatic cleanup thresholds.
          </p>
          <button
            onClick={() => {
              setEditingSource(null);
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            + Add Source
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => (
            <StorageCard
              key={source.id}
              source={source}
              onEdit={() => {
                setEditingSource(source);
                setShowModal(true);
              }}
              onDelete={() => handleDelete(source.id)}
              onRefresh={fetchData}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <StorageSourceModal
          source={editingSource}
          onClose={() => {
            setShowModal(false);
            setEditingSource(null);
          }}
          onSaved={handleSaved}
        />
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog />
    </div>
  );
}

interface StorageCardProps {
  source: StorageSource;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

function StorageCard({ source, onEdit, onDelete, onRefresh }: StorageCardProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const toast = useToast();

  const usedPercent = source.usedPercent ? parseFloat(source.usedPercent) : 0;
  const isAboveThreshold = source.isAboveThreshold || usedPercent >= source.thresholdPct;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await storageSources.refresh(source.id);
      toast.success(`Refreshed ${source.name}`);
      // Refresh the data in the parent - wrapped in try/catch to prevent crashes
      try {
        await onRefresh();
      } catch (fetchError) {
        console.error('Failed to refresh data after storage update:', fetchError);
      }
    } catch (error: any) {
      console.error('Failed to refresh storage:', error);
      toast.error(`Failed to refresh: ${error.message || 'Unknown error'}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await storageSources.test(source.id);
      setTestResult(result.data);
    } catch (error: any) {
      setTestResult({ connected: false, message: error.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const getTypeLabel = (type: StorageSourceType) => {
    switch (type) {
      case 'local': return 'Local Path';
      case 'smb': return 'SMB/CIFS';
      case 'nfs': return 'NFS';
      case 'truenas': return 'TrueNAS';
      default: return type;
    }
  };

  const getTypeIcon = (type: StorageSourceType) => {
    switch (type) {
      case 'local': return '📁';
      case 'smb': return '🪟';
      case 'nfs': return '🐧';
      case 'truenas': return '🐡';
      default: return '💾';
    }
  };

  return (
    <div className={`card p-4 ${isAboveThreshold ? 'border border-red-700' : ''}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center text-2xl">
            {source.type === 'truenas' ? (
              <ServiceLogo type="truenas" size={32} />
            ) : (
              getTypeIcon(source.type as StorageSourceType)
            )}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{source.name}</h3>
            <p className="text-sm text-gray-400">
              {getTypeLabel(source.type as StorageSourceType)}
              {source.path && ` • ${source.path}`}
              {source.host && ` • ${source.host}`}
              {source.pool && ` • Pool: ${source.pool}`}
              {source.dataset && ` • Dataset: ${source.dataset}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-2 py-1 rounded text-xs ${
              source.isEnabled
                ? 'bg-green-900 text-green-300'
                : 'bg-gray-700 text-gray-400'
            }`}
          >
            {source.isEnabled ? 'Enabled' : 'Disabled'}
          </span>
          {source.autoCleanup && (
            <span className="px-2 py-1 rounded text-xs bg-orange-900 text-orange-300">
              Auto-cleanup
            </span>
          )}
        </div>
      </div>

      {/* Usage Stats */}
      {source.lastSize && source.lastUsed ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">
              {source.lastUsedFormatted} used of {source.lastSizeFormatted}
            </span>
            <span className={`font-medium ${isAboveThreshold ? 'text-red-400' : ''}`}>
              {source.usedPercent}% used
            </span>
          </div>
          
          <div className="relative">
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  isAboveThreshold
                    ? 'bg-red-500'
                    : usedPercent >= 75
                    ? 'bg-orange-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
            {/* Threshold marker */}
            <div
              className="absolute top-0 h-3 border-r-2 border-yellow-400"
              style={{ left: `${source.thresholdPct}%` }}
              title={`Threshold: ${source.thresholdPct}%`}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{source.lastFreeFormatted} free</span>
            <span>Threshold: {source.thresholdPct}%</span>
          </div>

          {source.lastChecked && (
            <p className="text-xs text-gray-500">
              Last checked: {new Date(source.lastChecked).toLocaleString()}
            </p>
          )}
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400">
          <p>No data available</p>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-secondary text-sm mt-2"
          >
            {refreshing ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div
          className={`mt-4 p-3 rounded text-sm ${
            testResult.connected
              ? 'bg-green-900/50 text-green-300 border border-green-700'
              : 'bg-red-900/50 text-red-300 border border-red-700'
          }`}
        >
          {testResult.connected ? '✓ ' : '✗ '}
          {testResult.message}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-gray-700">
        <button
          onClick={handleTest}
          disabled={testing}
          className="btn btn-secondary text-sm"
        >
          {testing ? 'Testing...' : 'Test'}
        </button>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="btn btn-secondary text-sm"
        >
          {refreshing ? 'Refreshing...' : 'Refresh'}
        </button>
        <button onClick={onEdit} className="btn btn-secondary text-sm">
          Edit
        </button>
        <button onClick={onDelete} className="btn btn-danger text-sm">
          Delete
        </button>
      </div>
    </div>
  );
}

// Storage source type options
const storageTypeOptions: { value: StorageSourceType; label: string; description: string }[] = [
  { value: 'local', label: 'Local Path', description: 'Monitor a local directory or mounted volume' },
  { value: 'smb', label: 'SMB/CIFS', description: 'Monitor a mounted SMB/Windows network share' },
  { value: 'nfs', label: 'NFS', description: 'Monitor a mounted NFS network share' },
  { value: 'truenas', label: 'TrueNAS', description: 'Connect directly to TrueNAS via API for ZFS pool/dataset stats' },
];

interface StorageSourceModalProps {
  source: StorageSource | null;
  onClose: () => void;
  onSaved: (sourceId?: number) => void;
}

function StorageSourceModal({ source, onClose, onSaved }: StorageSourceModalProps) {
  const [form, setForm] = useState({
    name: source?.name || '',
    type: source?.type || 'local' as StorageSourceType,
    path: source?.path || '',
    host: source?.host || '',
    share: source?.share || '',
    export: source?.export || '',
    pool: source?.pool || '',
    dataset: source?.dataset || '',
    username: source?.username || '',
    password: '',
    apiKey: '',
    port: source?.port || 443,
    useSsl: source?.useSsl ?? true,
    isEnabled: source?.isEnabled ?? true,
    thresholdPct: source?.thresholdPct || 90,
    autoCleanup: source?.autoCleanup ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  // Track if user has successfully tested - editing existing sources starts as tested
  const [hasTested, setHasTested] = useState(!!source);
  
  // TrueNAS specific state
  const [pools, setPools] = useState<TrueNASPool[]>([]);
  const [datasets, setDatasets] = useState<TrueNASDataset[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  const toast = useToast();

  // Load pools/datasets when editing a TrueNAS source
  useEffect(() => {
    if (source?.type === 'truenas' && source.id) {
      loadTrueNASData(source.id);
    }
  }, [source]);

  const loadTrueNASData = async (sourceId: number) => {
    setLoadingPools(true);
    try {
      const poolsRes = await storageSources.getPools(sourceId);
      setPools(poolsRes.data);
      
      if (form.pool) {
        setLoadingDatasets(true);
        const datasetsRes = await storageSources.getDatasets(sourceId, form.pool);
        setDatasets(datasetsRes.data);
        setLoadingDatasets(false);
      }
    } catch (error) {
      console.error('Failed to load TrueNAS data:', error);
    } finally {
      setLoadingPools(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const testData: any = { type: form.type };
      
      if (form.type === 'truenas') {
        testData.host = form.host;
        testData.apiKey = form.apiKey || source?.apiKey;
        testData.useSsl = form.useSsl;
        testData.pool = form.pool;
        testData.dataset = form.dataset;
      } else {
        testData.path = form.path;
      }

      const result = await storageSources.testConnection(testData);
      setTestResult(result.data);
      
      // Mark as tested if successful
      if (result.data.connected) {
        setHasTested(true);
      }

      // If TrueNAS test succeeds, load pools
      if (form.type === 'truenas' && result.data.connected) {
        if (source?.id) {
          // For existing sources, use the saved source endpoint
          loadTrueNASData(source.id);
        } else {
          // For new sources, use the unsaved endpoint with credentials
          await loadTrueNASDataUnsaved();
        }
      }
    } catch (err: any) {
      setTestResult({ connected: false, message: err?.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  // Load pools/datasets for unsaved sources (using provided credentials)
  const loadTrueNASDataUnsaved = async () => {
    const apiKeyToUse = form.apiKey || source?.apiKey;
    if (!form.host || !apiKeyToUse) return;

    setLoadingPools(true);
    try {
      const poolsRes = await storageSources.fetchPools({
        host: form.host,
        apiKey: apiKeyToUse,
        useSsl: form.useSsl,
      });
      setPools(poolsRes.data);
      
      if (form.pool) {
        setLoadingDatasets(true);
        const datasetsRes = await storageSources.fetchDatasets({
          host: form.host,
          apiKey: apiKeyToUse,
          useSsl: form.useSsl,
          pool: form.pool,
        });
        setDatasets(datasetsRes.data);
        setLoadingDatasets(false);
      }
    } catch (error) {
      console.error('Failed to load TrueNAS data:', error);
    } finally {
      setLoadingPools(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        name: form.name,
        type: form.type,
        isEnabled: form.isEnabled,
        thresholdPct: form.thresholdPct,
        autoCleanup: form.autoCleanup,
      };

      if (form.type === 'truenas') {
        payload.host = form.host;
        payload.pool = form.pool || null;
        payload.dataset = form.dataset || null;
        payload.port = form.port;
        payload.useSsl = form.useSsl;
        if (form.apiKey) payload.apiKey = form.apiKey;
      } else {
        payload.path = form.path;
        if (form.type === 'smb') {
          payload.host = form.host;
          payload.share = form.share;
          if (form.username) payload.username = form.username;
          if (form.password) payload.password = form.password;
        } else if (form.type === 'nfs') {
          payload.host = form.host;
          payload.export = form.export;
        }
      }

      let savedSourceId: number | undefined;
      
      if (source) {
        await storageSources.update(source.id, payload);
        toast.success('Storage source updated');
        savedSourceId = source.id;
      } else {
        const response = await storageSources.create(payload);
        toast.success('Storage source created');
        savedSourceId = response.data?.id;
      }
      
      // Pass the source ID so the parent can trigger a refresh
      onSaved(savedSourceId);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderTypeSpecificFields = () => {
    switch (form.type) {
      case 'local':
        return (
          <div>
            <label className="block text-sm font-medium form-label mb-1">Path</label>
            <input
              type="text"
              value={form.path}
              onChange={(e) => setForm({ ...form, path: e.target.value })}
              className="input w-full"
              placeholder="/media/movies"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              The local path to monitor. This should be a path visible inside the container.
            </p>
          </div>
        );

      case 'smb':
        return (
          <>
            <div>
              <label className="block text-sm font-medium form-label mb-1">Mount Path</label>
              <input
                type="text"
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
                className="input w-full"
                placeholder="/mnt/media"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                The mount point where the SMB share is mounted inside the container.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium form-label mb-1">Host</label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  className="input w-full"
                  placeholder="192.168.1.100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium form-label mb-1">Share Name</label>
                <input
                  type="text"
                  value={form.share}
                  onChange={(e) => setForm({ ...form, share: e.target.value })}
                  className="input w-full"
                  placeholder="media"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium form-label mb-1">Username (optional)</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="input w-full"
                  placeholder="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium form-label mb-1">Password (optional)</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input w-full"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </>
        );

      case 'nfs':
        return (
          <>
            <div>
              <label className="block text-sm font-medium form-label mb-1">Mount Path</label>
              <input
                type="text"
                value={form.path}
                onChange={(e) => setForm({ ...form, path: e.target.value })}
                className="input w-full"
                placeholder="/mnt/media"
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                The mount point where the NFS share is mounted inside the container.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium form-label mb-1">Host</label>
                <input
                  type="text"
                  value={form.host}
                  onChange={(e) => setForm({ ...form, host: e.target.value })}
                  className="input w-full"
                  placeholder="192.168.1.100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium form-label mb-1">Export Path</label>
                <input
                  type="text"
                  value={form.export}
                  onChange={(e) => setForm({ ...form, export: e.target.value })}
                  className="input w-full"
                  placeholder="/mnt/tank/media"
                  required
                />
              </div>
            </div>
          </>
        );

      case 'truenas':
        return (
          <>
            <div>
              <label className="block text-sm font-medium form-label mb-1">TrueNAS URL</label>
              <div className="flex">
                <span className="inline-flex items-center px-3 bg-gray-700 border border-r-0 border-gray-600 rounded-l text-gray-400 text-sm">
                  https://
                </span>
                <input
                  type="text"
                  value={form.host.replace(/^https?:\/\//, '')}
                  onChange={(e) => {
                    // Strip any protocol the user might paste in
                    const cleanHost = e.target.value.replace(/^https?:\/\//, '');
                    setForm({ ...form, host: cleanHost });
                  }}
                  className="input w-full rounded-l-none"
                  placeholder="truenas.local or 192.168.1.100"
                  required
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                The hostname or IP of your TrueNAS server. HTTPS is required for API authentication.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium form-label mb-1">
                API Key {source && '(leave blank to keep current)'}
              </label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                className="input w-full"
                placeholder={source ? '••••••••' : 'Enter API key'}
                required={!source}
              />
              <p className="text-xs text-gray-500 mt-1">
                In TrueNAS SCALE: Credentials → Users → select user → Edit → enable "TrueNAS Access" (Readonly Admin is sufficient) → Save. Then click "Add API Key" in the user details.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium form-label mb-1">Pool (optional)</label>
                {loadingPools ? (
                  <div className="input w-full flex items-center text-gray-500">Loading pools...</div>
                ) : pools.length > 0 ? (
                  <select
                    value={form.pool}
                    onChange={async (e) => {
                      const newPool = e.target.value;
                      setForm({ ...form, pool: newPool, dataset: '' });
                      setDatasets([]);
                      
                      // Load datasets for the selected pool
                      if (newPool) {
                        setLoadingDatasets(true);
                        try {
                          const apiKeyToUse = form.apiKey || source?.apiKey;
                          if (source?.id) {
                            const datasetsRes = await storageSources.getDatasets(source.id, newPool);
                            setDatasets(datasetsRes.data);
                          } else if (apiKeyToUse) {
                            const datasetsRes = await storageSources.fetchDatasets({
                              host: form.host,
                              apiKey: apiKeyToUse,
                              useSsl: form.useSsl,
                              pool: newPool,
                            });
                            setDatasets(datasetsRes.data);
                          }
                        } catch (error) {
                          console.error('Failed to load datasets:', error);
                        } finally {
                          setLoadingDatasets(false);
                        }
                      }
                    }}
                    className="input w-full"
                  >
                    <option value="">Select a pool...</option>
                    {pools.map((pool) => (
                      <option key={pool.name} value={pool.name}>
                        {pool.name} ({pool.usedPercent}% used)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.pool}
                    onChange={(e) => setForm({ ...form, pool: e.target.value })}
                    className="input w-full"
                    placeholder="tank"
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium form-label mb-1">Dataset (optional)</label>
                {loadingDatasets ? (
                  <div className="input w-full flex items-center text-gray-500">Loading datasets...</div>
                ) : datasets.length > 0 ? (
                  <select
                    value={form.dataset}
                    onChange={(e) => setForm({ ...form, dataset: e.target.value })}
                    className="input w-full"
                  >
                    <option value="">Select a dataset...</option>
                    {datasets.map((ds) => (
                      <option key={ds.id} value={ds.name}>
                        {ds.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={form.dataset}
                    onChange={(e) => setForm({ ...form, dataset: e.target.value })}
                    className="input w-full"
                    placeholder="tank/media"
                  />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Leave pool/dataset empty to monitor the first pool found. Specify a dataset for more granular monitoring.
            </p>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card rounded-lg shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 m-4">
        <h2 className="text-xl font-semibold mb-4">
          {source ? 'Edit Storage Source' : 'Add Storage Source'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-200 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium form-label mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as StorageSourceType })}
              className="input w-full"
              disabled={!!source}
            >
              {storageTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {storageTypeOptions.find((o) => o.value === form.type)?.description}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium form-label mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              placeholder="Media Storage"
              required
            />
          </div>

          {renderTypeSpecificFields()}

          <div className="border-t border-gray-700 pt-4 mt-4">
            <h3 className="font-medium mb-3">Threshold Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium form-label mb-1">
                  Warning Threshold: {form.thresholdPct}%
                </label>
                <input
                  type="range"
                  min={50}
                  max={99}
                  value={form.thresholdPct}
                  onChange={(e) => setForm({ ...form, thresholdPct: parseInt(e.target.value) })}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Show warnings when disk usage exceeds this percentage.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="autoCleanup"
                  checked={form.autoCleanup}
                  onChange={(e) => setForm({ ...form, autoCleanup: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600"
                />
                <label htmlFor="autoCleanup" className="text-sm form-label">
                  Trigger automatic cleanup when threshold is exceeded
                </label>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isEnabled"
                  checked={form.isEnabled}
                  onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600"
                />
                <label htmlFor="isEnabled" className="text-sm form-label">
                  Enabled
                </label>
              </div>
            </div>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded text-sm ${
                testResult.connected
                  ? 'bg-green-900/50 text-green-300 border border-green-700'
                  : 'bg-red-900/50 text-red-300 border border-red-700'
              }`}
            >
              {testResult.connected ? '✓ ' : '✗ '}
              {testResult.message}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            {hasTested ? (
              // After successful test, show Test as secondary and Save as primary
              <>
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={testing}
                  className="btn btn-secondary"
                >
                  {testing ? 'Testing...' : 'Re-test'}
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
              // Before testing, only show Test as primary action
              <button
                type="button"
                onClick={handleTest}
                disabled={testing || !form.name || (form.type === 'truenas' ? (!form.host || (!form.apiKey && !source)) : !form.path)}
                className="btn btn-primary"
              >
                {testing ? 'Testing...' : 'Test Connection'}
              </button>
            )}
          </div>
          
          {!hasTested && !testResult && (
            <p className="text-xs text-gray-500 text-center">
              Test your connection to enable saving{form.type === 'truenas' ? ' and populate pool/dataset options' : ''}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}

export default Storage;
