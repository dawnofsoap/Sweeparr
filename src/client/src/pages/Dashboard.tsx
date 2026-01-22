import { useEffect, useState } from 'react';
import { health, rules, collections, mediaServers, arrApps, storageSources } from '../api';
import type { HealthStatus, Rule, Collection, MediaServer, ArrApp, StorageSummary } from '../api/types';
import { LoadingPage } from '../components/LoadingSpinner';

function Dashboard() {
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null);
  const [rulesList, setRulesList] = useState<Rule[]>([]);
  const [collectionsList, setCollectionsList] = useState<Collection[]>([]);
  const [servers, setServers] = useState<MediaServer[]>([]);
  const [apps, setApps] = useState<ArrApp[]>([]);
  const [storageSummary, setStorageSummary] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [healthRes, rulesRes, collectionsRes, serversRes, appsRes, storageRes] = await Promise.all([
          health.get(),
          rules.list(),
          collections.list(),
          mediaServers.list(),
          arrApps.list(),
          storageSources.getSummary().catch(() => ({ data: null })),
        ]);

        setHealthStatus(healthRes);
        setRulesList(rulesRes.data);
        setCollectionsList(collectionsRes.data);
        setServers(serversRes.data);
        setApps(appsRes.data);
        setStorageSummary(storageRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const totalPendingItems = collectionsList.reduce(
    (acc, col) => acc + (col._count?.items || 0),
    0
  );

  const activeRules = rulesList.filter((r) => r.isEnabled && r.isActive).length;
  const connectedServers = servers.filter((s) => s.isEnabled).length;
  const connectedApps = apps.filter((a) => a.isEnabled).length;

  if (loading) {
    return <LoadingPage />;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Rules"
          value={activeRules.toString()}
          subtitle={`${rulesList.length} total rules`}
        />
        <StatCard
          title="Pending Cleanup"
          value={totalPendingItems.toString()}
          subtitle="Items in collections"
          color="yellow"
        />
        <StatCard
          title="Media Servers"
          value={connectedServers.toString()}
          subtitle={`${servers.length} configured`}
          color="green"
        />
        <StatCard
          title="Arr Apps"
          value={connectedApps.toString()}
          subtitle={`${apps.length} configured`}
          color="orange"
        />
      </div>

      {/* Storage Summary */}
      {storageSummary && storageSummary.totalSources > 0 && (
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Storage</h2>
            <a href="/storage" className="text-sm text-blue-400 hover:underline">
              View Details →
            </a>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">
                {storageSummary.totalUsedFormatted} used of {storageSummary.totalSizeFormatted}
              </span>
              <span className={`font-medium ${
                parseFloat(storageSummary.overallUsedPercent) >= 90 ? 'text-red-400' :
                parseFloat(storageSummary.overallUsedPercent) >= 75 ? 'text-orange-400' : ''
              }`}>
                {storageSummary.overallUsedPercent}% used
              </span>
            </div>
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  parseFloat(storageSummary.overallUsedPercent) >= 90
                    ? 'bg-red-500'
                    : parseFloat(storageSummary.overallUsedPercent) >= 75
                    ? 'bg-orange-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${storageSummary.overallUsedPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{storageSummary.totalFreeFormatted} free</span>
              <span>{storageSummary.totalSources} source{storageSummary.totalSources > 1 ? 's' : ''}</span>
            </div>
            {storageSummary.sourcesAboveThreshold > 0 && (
              <div className="p-2 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
                ⚠️ {storageSummary.sourcesAboveThreshold} source{storageSummary.sourcesAboveThreshold > 1 ? 's' : ''} above threshold
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connected Services */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Connected Services</h2>
          {servers.length === 0 && apps.length === 0 ? (
            <div className="text-secondary text-center py-4">
              No services configured. Go to Settings to add connections.
            </div>
          ) : (
            <div className="space-y-3">
              {servers.map((server) => (
                <ServiceStatus
                  key={`server-${server.id}`}
                  name={server.name}
                  type={server.type}
                  enabled={server.isEnabled}
                />
              ))}
              {apps.map((app) => (
                <ServiceStatus
                  key={`app-${app.id}`}
                  name={app.name}
                  type={app.type}
                  enabled={app.isEnabled}
                />
              ))}
            </div>
          )}
        </div>

        {/* Recent Rules */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">Rules</h2>
          {rulesList.length === 0 ? (
            <div className="text-secondary text-center py-4">
              No rules configured. Go to Rules to create one.
            </div>
          ) : (
            <div className="space-y-3">
              {rulesList.slice(0, 5).map((rule) => (
                <div
                  key={rule.id}
                  className="flex items-center justify-between p-3 list-item-bg rounded-lg"
                >
                  <div>
                    <p className="font-medium">{rule.name}</p>
                    <p className="text-sm text-secondary">
                      {rule.mediaType} • {rule.action}
                    </p>
                  </div>
                  <div
                    className={`px-2 py-1 rounded text-xs ${
                      rule.isEnabled
                        ? 'bg-green-900 text-green-300'
                        : 'badge-disabled'
                    }`}
                  >
                    {rule.isEnabled ? 'Active' : 'Disabled'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Info */}
      {healthStatus && (
        <div className="card p-6">
          <h2 className="text-lg font-semibold mb-4">System Info</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-secondary">Version</p>
              <p className="font-medium">{healthStatus.version}</p>
            </div>
            <div>
              <p className="text-secondary">Status</p>
              <p className="font-medium capitalize">{healthStatus.status}</p>
            </div>
            <div>
              <p className="text-secondary">Uptime</p>
              <p className="font-medium">{formatUptime(healthStatus.uptime)}</p>
            </div>
            <div>
              <p className="text-secondary">Last Updated</p>
              <p className="font-medium">
                {new Date(healthStatus.timestamp).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  color?: 'default' | 'yellow' | 'green' | 'orange';
}

function StatCard({ title, value, subtitle, color = 'default' }: StatCardProps) {
  const colorClasses = {
    default: 'stat-value-default',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    orange: 'text-orange-400',
  };

  return (
    <div className="card p-6">
      <p className="text-sm text-secondary">{title}</p>
      <p className={`text-3xl font-bold mt-1 ${colorClasses[color]}`}>{value}</p>
      <p className="text-xs text-muted mt-1">{subtitle}</p>
    </div>
  );
}

interface ServiceStatusProps {
  name: string;
  type: string;
  enabled: boolean;
}

function ServiceStatus({ name, type, enabled }: ServiceStatusProps) {
  return (
    <div className="flex items-center justify-between p-3 list-item-bg rounded-lg">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            enabled ? 'bg-green-500' : 'bg-gray-500'
          }`}
        />
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-secondary capitalize">{type}</p>
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

export default Dashboard;
