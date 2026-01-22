import { useState, useEffect, useRef } from 'react';
import { health, system } from '../api';
import type { HealthStatus, ReadyStatus, ScheduledTask, CleanupResult, LogEntry } from '../api/types';
import { useToast } from '../contexts/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';

function System() {
  const toast = useToast();
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [readyStatus, setReadyStatus] = useState<ReadyStatus | null>(null);
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Action states
  const [runningCleanup, setRunningCleanup] = useState(false);
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  
  // Logs state
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [autoRefreshLogs, setAutoRefreshLogs] = useState(true);
  const [logFilter, setLogFilter] = useState<string>('');
  const logsContainerRef = useRef<HTMLDivElement>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthRes, readyRes, tasksRes] = await Promise.all([
        health.get(),
        health.ready(),
        system.getTasks(),
      ]);
      setHealthStatus(healthRes);
      setReadyStatus(readyRes);
      setTasks(tasksRes);
    } catch (err) {
      setError('Failed to fetch system status');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchLogs();
    
    // Refresh status every 30 seconds
    const statusInterval = setInterval(fetchStatus, 30000);
    
    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  // Auto-refresh logs every 3 seconds
  useEffect(() => {
    if (!autoRefreshLogs) return;
    
    const logsInterval = setInterval(fetchLogs, 3000);
    return () => clearInterval(logsInterval);
  }, [autoRefreshLogs]);

  const fetchLogs = async () => {
    try {
      const result = await system.getLogs(100, logFilter || undefined);
      setLogs(result.logs);
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  };

  const handleRunCleanup = async (dryRun: boolean) => {
    setRunningCleanup(true);
    setCleanupResult(null);
    const toastId = toast.progress('Running cleanup...', dryRun ? 'Dry run mode' : 'Executing rules');
    try {
      const result = await system.runCleanup(dryRun);
      setCleanupResult(result);
      toast.updateToast(toastId, {
        type: result.success ? 'success' : 'error',
        title: result.success ? 'Cleanup complete' : 'Cleanup failed',
        message: result.message,
        progress: false,
      });
    } catch (err: any) {
      const errorResult = {
        success: false,
        message: err?.message || 'Failed to run cleanup',
        dryRun,
        rulesProcessed: 0,
        results: [],
        timestamp: new Date().toISOString(),
      };
      setCleanupResult(errorResult);
      toast.updateToast(toastId, {
        type: 'error',
        title: 'Cleanup failed',
        message: err?.message || 'An error occurred',
        progress: false,
      });
    } finally {
      setRunningCleanup(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await system.clearCache();
      toast.success('Cache cleared', 'Application cache has been cleared');
    } catch (err) {
      console.error('Failed to clear cache:', err);
      toast.error('Failed to clear cache');
    } finally {
      setClearingCache(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">System</h1>
        <button
          onClick={fetchStatus}
          disabled={loading}
          className="btn btn-secondary"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Status */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Status</h2>
        {loading && !healthStatus ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-secondary">Health</p>
              <p className="text-lg font-medium flex items-center gap-2 mt-1">
                <span
                  className={`w-2 h-2 rounded-full ${
                    healthStatus?.status === 'healthy'
                      ? 'bg-green-500'
                      : 'bg-red-500'
                  }`}
                />
                {healthStatus?.status === 'healthy' ? 'Healthy' : 'Unhealthy'}
              </p>
            </div>
            <div>
              <p className="text-sm text-secondary">Version</p>
              <p className="text-lg font-medium mt-1">
                {healthStatus?.version || '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-secondary">Uptime</p>
              <p className="text-lg font-medium mt-1">
                {healthStatus?.uptime ? formatUptime(healthStatus.uptime) : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-secondary">Last Check</p>
              <p className="text-lg font-medium mt-1">
                {healthStatus?.timestamp
                  ? new Date(healthStatus.timestamp).toLocaleTimeString()
                  : '—'}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Service Checks */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Service Checks</h2>
        {loading && !readyStatus ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <CheckCard
              name="Database"
              status={readyStatus?.checks.database ?? false}
            />
            <CheckCard
              name="Media Server"
              status={readyStatus?.checks.mediaServer ?? false}
            />
            <CheckCard
              name="Arr Apps"
              status={readyStatus?.checks.arrApps ?? false}
            />
          </div>
        )}
      </section>

      {/* Scheduled Tasks */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Scheduled Tasks</h2>
        {loading && tasks.length === 0 ? (
          <div className="flex justify-center py-4">
            <LoadingSpinner size="sm" />
          </div>
        ) : tasks.length === 0 ? (
          <div className="text-secondary text-center py-4">
            No scheduled tasks configured. Enable automatic cleanup in{' '}
            <a href="/settings/cleanup" className="text-orange-400 hover:underline">
              Settings → Cleanup
            </a>.
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-4 list-item-bg rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      task.enabled ? 'bg-green-500' : 'bg-gray-500'
                    }`}
                  />
                  <div>
                    <p className="font-medium">{task.name}</p>
                    <p className="text-sm text-secondary">{task.description}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-secondary">Next Run</p>
                  <p className="font-medium">
                    {task.nextRun
                      ? new Date(task.nextRun).toLocaleString()
                      : 'Not scheduled'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="card p-6">
        <h2 className="text-lg font-semibold mb-4">Actions</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleClearCache}
            disabled={clearingCache}
            className="btn btn-secondary"
          >
            {clearingCache ? 'Clearing...' : 'Clear Cache'}
          </button>
          <button
            onClick={() => setShowCleanupModal(true)}
            disabled={runningCleanup}
            className="btn btn-primary"
          >
            {runningCleanup ? 'Running...' : 'Run Cleanup'}
          </button>
        </div>

        {/* Cleanup Result */}
        {cleanupResult && (
          <div
            className={`mt-4 p-4 rounded-lg ${
              cleanupResult.success
                ? 'bg-green-900/30 border border-green-700'
                : 'bg-red-900/30 border border-red-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium">
                {cleanupResult.success ? '✓' : '✗'} {cleanupResult.message}
              </span>
              <span className="text-sm text-secondary">
                {new Date(cleanupResult.timestamp).toLocaleString()}
              </span>
            </div>
            {cleanupResult.rulesProcessed > 0 && (
              <p className="text-sm text-secondary">
                Processed {cleanupResult.rulesProcessed} rule(s)
                {cleanupResult.dryRun && ' (Dry Run)'}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Logs */}
      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Logs</h2>
          <div className="flex items-center gap-4">
            <select
              value={logFilter}
              onChange={(e) => {
                setLogFilter(e.target.value);
                fetchLogs();
              }}
              className="input text-sm py-1"
            >
              <option value="">All Levels</option>
              <option value="error">Errors</option>
              <option value="warn">Warnings</option>
              <option value="info">Info</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                checked={autoRefreshLogs}
                onChange={(e) => setAutoRefreshLogs(e.target.checked)}
                className="rounded"
              />
              Auto-refresh
            </label>
          </div>
        </div>
        <div
          ref={logsContainerRef}
          className="log-container rounded-lg p-4 font-mono text-sm h-64 overflow-auto"
        >
          {logs.length === 0 ? (
            <div className="text-muted">No logs yet...</div>
          ) : (
            <div className="space-y-1">
              {logs.map((log, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <span className="text-muted shrink-0 text-xs">{log.timestamp}</span>
                  <span
                    className={`shrink-0 uppercase text-xs font-medium px-1.5 py-0.5 rounded text-center ${
                      log.level === 'error'
                        ? 'bg-red-900/50 text-red-300'
                        : log.level === 'warn'
                        ? 'bg-yellow-900/50 text-yellow-300'
                        : 'bg-blue-900/50 text-blue-300'
                    }`}
                  >
                    {log.level}
                  </span>
                  {log.category && (
                    <span className="shrink-0 text-orange-400 text-xs font-medium">
                      [{log.category}]
                    </span>
                  )}
                  <span className="text-secondary text-xs break-all">{log.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Run Cleanup Modal */}
      {showCleanupModal && (
        <CleanupModal
          onClose={() => setShowCleanupModal(false)}
          onRun={handleRunCleanup}
          running={runningCleanup}
        />
      )}
    </div>
  );
}

interface CheckCardProps {
  name: string;
  status: boolean;
}

function CheckCard({ name, status }: CheckCardProps) {
  return (
    <div className="flex items-center justify-between p-4 list-item-bg rounded-lg">
      <span className="font-medium">{name}</span>
      <span
        className={`flex items-center gap-2 text-sm ${
          status ? 'text-green-400' : 'text-secondary'
        }`}
      >
        <span
          className={`w-2 h-2 rounded-full ${
            status ? 'bg-green-500' : 'bg-gray-500'
          }`}
        />
        {status ? 'Connected' : 'Not Connected'}
      </span>
    </div>
  );
}

interface CleanupModalProps {
  onClose: () => void;
  onRun: (dryRun: boolean) => void;
  running: boolean;
}

function CleanupModal({ onClose, onRun, running }: CleanupModalProps) {
  const [dryRun, setDryRun] = useState(true);

  const handleRun = () => {
    onRun(dryRun);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card rounded-lg shadow-xl w-full max-w-md p-6 m-4">
        <h2 className="text-xl font-semibold mb-4">Run Cleanup</h2>
        
        <p className="text-secondary mb-4">
          This will run all active cleanup rules against your media libraries.
        </p>

        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <div>
              <span className="font-medium">Dry Run</span>
              <p className="text-sm text-secondary">
                Preview what would be deleted without making changes
              </p>
            </div>
          </label>
        </div>

        {!dryRun && (
          <div className="mb-4 p-3 bg-yellow-900/30 border border-yellow-700 rounded-lg">
            <p className="text-yellow-200 text-sm">
              ⚠️ This will permanently delete files matching your rules. This action cannot be undone.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleRun}
            disabled={running}
            className={dryRun ? 'btn btn-primary' : 'btn btn-danger'}
          >
            {running ? 'Running...' : dryRun ? 'Run Dry Run' : 'Run Cleanup'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default System;
