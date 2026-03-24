import { useState, useEffect, useRef } from 'react';
import { mediaServers, arrApps, settings, notifications, statisticsServices, storageSources } from '../api';
import type { MediaServer, ArrApp, ConnectionTestResult, NotificationService, NotificationServiceType, StatisticsService, StatisticsServiceType, StorageSource, StorageSourceType, StorageSummary, TrueNASPool, TrueNASDataset } from '../api/types';
import { ServiceLogo } from '../components/ServiceLogos';
import { useUI } from '../contexts/UIContext';
import { useToast } from '../contexts/ToastContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useConfirm } from '../components/ConfirmModal';
import { FileBrowser } from '../components/FileBrowser';
import Portal from '../components/Portal';

interface SettingsProps {
  section?: string;
}

function Settings({ section = 'general' }: SettingsProps) {
  const activeSection = section;
  const [servers, setServers] = useState<MediaServer[]>([]);
  const [apps, setApps] = useState<ArrApp[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [serversRes, appsRes] = await Promise.all([
        mediaServers.list(),
        arrApps.list(),
      ]);
      setServers(serversRes.data);
      setApps(appsRes.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const loadData = () => fetchData();

  const renderSectionContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      );
    }

    switch (activeSection) {
      case 'connections':
        return (
          <ConnectionsSection
            servers={servers}
            apps={apps}
            onRefresh={loadData}
          />
        );
      case 'storage':
        return <StorageSection />;
      case 'path-mappings':
        return <PathMappingsSection />;
      case 'notifications':
        return <NotificationsSection />;
      case 'general':
        return <GeneralSection />;
      case 'ui':
        return <UISection />;
      default:
        return <div className="text-gray-400">Select a section</div>;
    }
  };

  return (
    <div className="h-full">
      {/* Settings Content */}
      {renderSectionContent()}
    </div>
  );
}

// ============================================================================
// Section Components
// ============================================================================

// Combined Connections Section with all service types in one page
interface ConnectionsSectionProps {
  servers: MediaServer[];
  apps: ArrApp[];
  onRefresh: () => void;
}

function ConnectionsSection({ servers, apps, onRefresh }: ConnectionsSectionProps) {
  const [statServices, setStatServices] = useState<StatisticsService[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [pathMappingCounts, setPathMappingCounts] = useState<Record<string, number>>({});
  const addMenuRef = useRef<HTMLDivElement>(null);
  
  // Unified modal state
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<any>(null);
  const [newServiceType, setNewServiceType] = useState<ConnectionServiceType | null>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch statistics services
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { statisticsServices: statsApi } = await import('../api');
        const response = await statsApi.list();
        setStatServices(response.data);
      } catch (error) {
        console.error('Failed to fetch statistics services:', error);
      } finally {
        setStatsLoading(false);
      }
    };
    fetchStats();
  }, []);

  // Fetch path mapping counts for all services
  useEffect(() => {
    const fetchPathMappingCounts = async () => {
      try {
        const { get } = await import('../api/client');
        const counts: Record<string, number> = {};
        
        // Fetch for arr apps
        for (const app of apps) {
          try {
            const response = await get<{ success: boolean; data: Array<any> }>(`/path-mappings/arr/${app.id}`);
            counts[`arr-${app.id}`] = response.data?.length || 0;
          } catch {
            counts[`arr-${app.id}`] = 0;
          }
        }
        
        // Fetch for media servers
        for (const server of servers) {
          try {
            const response = await get<{ success: boolean; data: Array<any> }>(`/path-mappings/media-server/${server.id}`);
            counts[`server-${server.id}`] = response.data?.length || 0;
          } catch {
            counts[`server-${server.id}`] = 0;
          }
        }
        
        setPathMappingCounts(counts);
      } catch (error) {
        console.error('Failed to fetch path mapping counts:', error);
      }
    };
    
    if (apps.length > 0 || servers.length > 0) {
      fetchPathMappingCounts();
    }
  }, [apps, servers]);

  const handleDelete = async (id: number, category: string) => {
    try {
      if (category === 'server') {
        await mediaServers.delete(id);
      } else if (category === 'arr') {
        await arrApps.delete(id);
      } else {
        await statisticsServices.delete(id);
        setStatServices(statServices.filter(s => s.id !== id));
      }
      onRefresh();
    } catch (error) {
      console.error('Failed to delete service:', error);
    }
  };

  const handleSaved = async () => {
    setShowModal(false);
    setEditingService(null);
    setNewServiceType(null);
    // Refresh stats services
    try {
      const { statisticsServices: statsApi } = await import('../api');
      const response = await statsApi.list();
      setStatServices(response.data);
    } catch (error) {
      console.error('Failed to refresh statistics services:', error);
    }
    onRefresh();
  };

  const openAddModal = (type: ConnectionServiceType) => {
    setShowAddMenu(false);
    setEditingService(null);
    setNewServiceType(type);
    setShowModal(true);
  };

  const openEditModal = (service: any, category: string) => {
    setEditingService({ ...service, _category: category });
    setNewServiceType(null);
    setShowModal(true);
  };

  // Combine all services into a unified list
  const allServices = [
    ...servers.map(s => ({ ...s, serviceCategory: 'server' as const, serviceId: s.id })),
    ...apps.map(a => ({ ...a, serviceCategory: 'arr' as const, serviceId: a.id })),
    ...statServices.map(s => ({ ...s, serviceCategory: 'stats' as const, serviceId: s.id })),
  ];

  const handleAddClick = (type: string) => {
    openAddModal(type as ConnectionServiceType);
  };

  const isEmpty = allServices.length === 0 && !statsLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Connections</h2>
          <p className="text-sm text-gray-400 mt-1">
            Manage your media servers, Arr apps, and statistics services.
          </p>
        </div>
        
        {/* Add Service Dropdown */}
        <div className="relative" ref={addMenuRef}>
          <button
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="btn btn-primary flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Service
            <svg className={`w-4 h-4 transition-transform ${showAddMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showAddMenu && (
            <div className="absolute right-0 mt-2 w-48 rounded-lg shadow-lg border border-gray-700 py-1 z-50" style={{ backgroundColor: '#1a1a1a' }}>
              <div className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wide">Media Servers</div>
              <button
                onClick={() => handleAddClick('jellyfin')}
                className="w-full px-3 py-2 text-left hover:bg-gray-800 flex items-center gap-2"
              >
                <ServiceLogo type="jellyfin" size={20} />
                Jellyfin
              </button>
              <button
                onClick={() => handleAddClick('emby')}
                className="w-full px-3 py-2 text-left hover:bg-gray-800 flex items-center gap-2"
              >
                <ServiceLogo type="emby" size={20} />
                Emby
              </button>
              
              <div className="border-t border-gray-700 my-1"></div>
              <div className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wide">Arr Apps</div>
              <button
                onClick={() => handleAddClick('radarr')}
                className="w-full px-3 py-2 text-left hover:bg-gray-800 flex items-center gap-2"
              >
                <ServiceLogo type="radarr" size={20} />
                Radarr
              </button>
              <button
                onClick={() => handleAddClick('sonarr')}
                className="w-full px-3 py-2 text-left hover:bg-gray-800 flex items-center gap-2"
              >
                <ServiceLogo type="sonarr" size={20} />
                Sonarr
              </button>
              
              <div className="border-t border-gray-700 my-1"></div>
              <div className="px-3 py-1 text-xs text-gray-500 uppercase tracking-wide">Statistics</div>
              <button
                onClick={() => handleAddClick('jellystat')}
                className="w-full px-3 py-2 text-left hover:bg-gray-800 flex items-center gap-2"
              >
                <ServiceLogo type="jellystat" size={20} />
                Jellystat
              </button>
              <div
                className="w-full px-3 py-2 text-left flex items-center gap-2 opacity-50 cursor-not-allowed"
                title="Coming soon"
              >
                <ServiceLogo type="tautulli" size={20} />
                <span>Tautulli</span>
                <span className="text-xs text-gray-500 ml-auto">Soon</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Empty State */}
      {isEmpty && (
        <div className="card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
            </svg>
          </div>
          <h3 className="text-lg font-medium mb-1">No services configured</h3>
          <p className="text-gray-400 text-sm mb-4">
            Add your first service to get started with Sweeparr.
          </p>
        </div>
      )}

      {/* Loading State */}
      {statsLoading && allServices.length === 0 && (
        <div className="card p-8 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      {/* Unified Service List */}
      {allServices.length > 0 && (
        <div className="card divide-y divide-gray-700">
          {allServices.map((service) => {
            const pathCount = service.serviceCategory === 'arr' 
              ? pathMappingCounts[`arr-${service.serviceId}`] 
              : service.serviceCategory === 'server'
                ? pathMappingCounts[`server-${service.serviceId}`]
                : 0;
            
            return (
              <UnifiedConnectionRow
                key={`${service.serviceCategory}-${service.serviceId}`}
                name={service.name}
                type={service.type}
                url={service.url}
                pathMappingCount={pathCount}
                linkedServerName={service.serviceCategory === 'arr' ? (service as any).mediaServer?.name : undefined}
                onEdit={() => openEditModal(service, service.serviceCategory)}
              />
            );
          })}
        </div>
      )}

      {/* Unified Connection Modal */}
      {showModal && (
        <ConnectionModal
          service={editingService}
          serviceType={newServiceType || undefined}
          servers={servers}
          onClose={() => {
            setShowModal(false);
            setEditingService(null);
            setNewServiceType(null);
          }}
          onSaved={handleSaved}
          onDelete={(id) => {
            const category = editingService?._category || 
              (newServiceType && getConnectionServiceCategory(newServiceType));
            handleDelete(id, category || 'stats');
            setShowModal(false);
            setEditingService(null);
          }}
        />
      )}
    </div>
  );
}

// Unified Connection Row Component
interface UnifiedConnectionRowProps {
  name: string;
  type: string;
  url: string;
  pathMappingCount?: number;
  linkedServerName?: string;
  onEdit: () => void;
}

function UnifiedConnectionRow({ name, type, url, pathMappingCount, linkedServerName, onEdit }: UnifiedConnectionRowProps) {
  // Truncate URL for display
  const displayUrl = url.replace(/^https?:\/\//, '').substring(0, 30) + (url.length > 40 ? '...' : '');
  
  const getTypeLabel = () => {
    switch (type) {
      case 'jellyfin': return 'Jellyfin';
      case 'emby': return 'Emby';
      case 'radarr': return 'Radarr';
      case 'sonarr': return 'Sonarr';
      case 'jellystat': return 'Jellystat';
      case 'tautulli': return 'Tautulli';
      default: return type;
    }
  };

  const showPathMappings = ['jellyfin', 'emby', 'radarr', 'sonarr'].includes(type);

  return (
    <div 
      className="flex items-center justify-between p-4 hover:bg-hover transition-colors cursor-pointer group"
      onClick={onEdit}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
        <ServiceLogo type={type} size={32} />
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{name}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
              {getTypeLabel()}
            </span>
          </div>
          <p className="text-sm text-gray-500 truncate">{displayUrl}</p>
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        {linkedServerName && (
          <span className="text-xs text-gray-400" title="Linked media server">
            → {linkedServerName}
          </span>
        )}
        {showPathMappings && pathMappingCount !== undefined && pathMappingCount > 0 && (
          <span className="text-xs text-gray-400">
            {pathMappingCount} path{pathMappingCount !== 1 ? 's' : ''}
          </span>
        )}
        
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="btn btn-secondary text-sm opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Edit
        </button>
        
        <svg 
          className="w-5 h-5 text-gray-500 group-hover:text-gray-300 transition-colors" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

interface MediaServersSectionProps {
  servers: MediaServer[];
  onAdd: () => void;
  onEdit: (server: MediaServer) => void;
  onDelete: (id: number) => void;
  onTest: (id: number) => Promise<{ data: ConnectionTestResult }>;
}

function MediaServersSection({ servers, onAdd, onEdit, onDelete, onTest }: MediaServersSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Media Servers</h2>
          <p className="text-sm text-gray-400 mt-1">
            Connect your Jellyfin or Emby server to track watch history and manage media.
          </p>
        </div>
        <button onClick={onAdd} className="btn btn-primary">
          + Add Server
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">📺</div>
          <h3 className="text-lg font-medium mb-2">No Media Servers</h3>
          <p className="text-gray-400 mb-4">
            Add Jellyfin or Emby to get started with media tracking.
          </p>
          <button onClick={onAdd} className="btn btn-primary">
            + Add Server
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {servers.map((server) => (
            <ConnectionCard
              key={server.id}
              name={server.name}
              type={server.type}
              url={server.url}
              enabled={server.isEnabled}
              onEdit={() => onEdit(server)}
              onDelete={() => onDelete(server.id)}
              onTest={() => onTest(server.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ArrServicesSectionProps {
  apps: ArrApp[];
  onAdd: () => void;
  onEdit: (app: ArrApp) => void;
  onDelete: (id: number) => void;
  onTest: (id: number) => Promise<{ data: ConnectionTestResult }>;
}

function ArrServicesSection({ apps, onAdd, onEdit, onDelete, onTest }: ArrServicesSectionProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Arr Services</h2>
          <p className="text-sm text-gray-400 mt-1">
            Connect Radarr and Sonarr to manage your movie and TV libraries.
          </p>
        </div>
        <button onClick={onAdd} className="btn btn-primary">
          + Add Service
        </button>
      </div>

      {apps.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">🎬</div>
          <h3 className="text-lg font-medium mb-2">No Arr Services</h3>
          <p className="text-gray-400 mb-4">
            Add Radarr or Sonarr to enable media management.
          </p>
          <button onClick={onAdd} className="btn btn-primary">
            + Add Service
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <ConnectionCard
              key={app.id}
              name={app.name}
              type={app.type}
              url={app.url}
              enabled={app.isEnabled}
              onEdit={() => onEdit(app)}
              onDelete={() => onDelete(app.id)}
              onTest={() => onTest(app.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Storage Section - Full storage management
function StorageSection() {
  const [sources, setSources] = useState<StorageSource[]>([]);
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingSource, setEditingSource] = useState<StorageSource | null>(null);
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();

  const fetchData = async (isInitialLoad = false) => {
    try {
      const [sourcesRes, summaryRes] = await Promise.all([
        storageSources.list(),
        storageSources.getSummary(),
      ]);
      setSources(sourcesRes.data || []);
      setSummary(summaryRes.data || null);
    } catch (error) {
      console.error('Failed to fetch storage data:', error);
      if (!isInitialLoad) {
        toast.error('Failed to load storage data');
      }
    } finally {
      if (isInitialLoad) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchData(true);
  }, []);

  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await storageSources.refreshAll();
      await fetchData();
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
      setSources(prev => prev.filter(s => s.id !== id));
      fetchData();
    } catch (error) {
      console.error('Failed to delete storage source:', error);
      toast.error('Failed to delete storage source');
    }
  };

  const handleSaved = async (sourceId?: number) => {
    setShowModal(false);
    setEditingSource(null);
    await fetchData();
    
    if (sourceId) {
      try {
        await storageSources.refresh(sourceId);
        await fetchData();
      } catch (error) {
        console.error('Failed to refresh storage stats after save:', error);
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

  const hasMultipleSources = sources.length > 1;
  const overallPercent = parseFloat(summary?.overallUsedPercent || '0');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            Storage
            {refreshing && <LoadingSpinner size="sm" />}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            Monitor disk usage and configure storage thresholds for automatic cleanup.
          </p>
        </div>
        <div className="flex gap-2">
          {sources.length > 0 && (
            <button
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="btn btn-secondary"
            >
              {refreshing ? 'Refreshing...' : 'Refresh All'}
            </button>
          )}
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

      {/* Summary - only show when multiple sources */}
      {hasMultipleSources && summary && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div>
                <span className="text-sm text-gray-400">Total: </span>
                <span className="font-semibold">{summary.totalSizeFormatted}</span>
              </div>
              <div>
                <span className="text-sm text-gray-400">Used: </span>
                <span className="font-semibold text-orange-400">{summary.totalUsedFormatted}</span>
              </div>
              <div>
                <span className="text-sm text-gray-400">Free: </span>
                <span className="font-semibold text-green-400">{summary.totalFreeFormatted}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    overallPercent >= 90 ? 'bg-red-500' : overallPercent >= 75 ? 'bg-orange-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${overallPercent}%` }}
                />
              </div>
              <span className="text-sm font-medium w-12">{summary.overallUsedPercent}%</span>
            </div>
          </div>
          {summary.sourcesAboveThreshold > 0 && (
            <p className="text-sm text-red-400 mt-2">
              ⚠️ {summary.sourcesAboveThreshold} source{summary.sourcesAboveThreshold > 1 ? 's' : ''} above threshold
            </p>
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
        <div className="space-y-3">
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

// Storage Card Component
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
      await onRefresh();
    } catch (error: any) {
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
      setTimeout(() => setTestResult(null), 5000);
    } catch (error: any) {
      setTestResult({ connected: false, message: error.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const getSubtitle = () => {
    const parts: string[] = [];
    if (source.type === 'truenas') parts.push('TrueNAS');
    else if (source.type === 'local') parts.push('Local');
    else if (source.type === 'smb') parts.push('SMB');
    else if (source.type === 'nfs') parts.push('NFS');
    
    if (source.host) parts.push(source.host);
    if (source.pool) parts.push(`Pool: ${source.pool}`);
    return parts.join(' \u2022 ');
  };

  return (
    <div 
      className={`card p-4 hover:bg-hover transition-colors cursor-pointer group ${isAboveThreshold ? 'border border-red-700' : ''}`}
      onClick={onEdit}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center flex-shrink-0">
          {source.type === 'truenas' ? (
            <ServiceLogo type="truenas" size={24} />
          ) : (
            <span className="text-xl">{source.type === 'local' ? '\ud83d\udcc1' : source.type === 'smb' ? '\ud83e\ude9f' : '\ud83d\udcbe'}</span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{source.name}</span>
            {!source.isEnabled && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Disabled</span>
            )}
          </div>
          <p className="text-sm text-gray-500 truncate">{getSubtitle()}</p>
        </div>

        {/* Usage bar and stats */}
        {source.lastSize && source.lastUsed ? (
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="text-right text-sm">
              <span className="text-gray-400">{source.lastUsedFormatted}</span>
              <span className="text-gray-600"> / </span>
              <span className="text-gray-300">{source.lastSizeFormatted}</span>
            </div>
            <div className="w-24 relative">
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${isAboveThreshold ? 'bg-red-500' : usedPercent >= 75 ? 'bg-orange-500' : 'bg-green-500'}`}
                  style={{ width: `${usedPercent}%` }}
                />
              </div>
              {/* Threshold marker */}
              <div
                className="absolute top-0 h-2 border-r border-gray-400"
                style={{ left: `${source.thresholdPct}%` }}
              />
            </div>
            <span className={`text-sm font-medium w-12 text-right ${isAboveThreshold ? 'text-red-400' : ''}`}>
              {source.usedPercent}%
            </span>
          </div>
        ) : (
          <span className="text-sm text-gray-500">No data</span>
        )}

        {/* Actions - show on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); handleTest(); }}
            disabled={testing}
            className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Test connection"
          >
            {testing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); handleRefresh(); }}
            disabled={refreshing}
            className="p-2 hover:bg-gray-700 rounded text-gray-400 hover:text-white"
            title="Refresh stats"
          >
            {refreshing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 hover:bg-red-900/50 rounded text-gray-400 hover:text-red-400"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Chevron */}
        <svg className="w-5 h-5 text-gray-500 group-hover:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>

      {/* Test Result - inline */}
      {testResult && (
        <div className={`mt-3 text-sm ${testResult.connected ? 'text-green-400' : 'text-red-400'}`}>
          {testResult.connected ? '\u2713 ' : '\u2717 '}{testResult.message}
        </div>
      )}
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

// Storage Source Modal
interface StorageSourceModalProps {
  source: StorageSource | null;
  onClose: () => void;
  onSaved: (sourceId?: number) => void;
}

function StorageSourceModal({ source, onClose, onSaved }: StorageSourceModalProps) {
  const [form, setForm] = useState({
    name: source?.name || '',
    type: source?.type || 'truenas' as StorageSourceType,
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
  const [hasTested, setHasTested] = useState(!!source);
  const [showApiHelp, setShowApiHelp] = useState(false);
  
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
      
      if (result.data.connected) {
        setHasTested(true);
      }

      // If TrueNAS test succeeds, load pools
      if (form.type === 'truenas' && result.data.connected) {
        if (source?.id) {
          loadTrueNASData(source.id);
        } else {
          await loadTrueNASDataUnsaved();
        }
      }
    } catch (err: any) {
      setTestResult({ connected: false, message: err?.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

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

  const handlePoolChange = async (newPool: string) => {
    setForm({ ...form, pool: newPool, dataset: '' });
    setDatasets([]);
    
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
      
      onSaved(savedSourceId);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderTrueNASFields = () => (
    <>
      {/* URL */}
      <div>
        <label className="block text-sm font-medium form-label mb-1">URL</label>
        <input
          type="text"
          value={form.host.startsWith('https://') ? form.host : `https://${form.host}`}
          onChange={(e) => {
            let val = e.target.value;
            // Ensure https:// prefix
            if (!val.startsWith('https://')) {
              val = val.replace(/^http:\/\//, '');
              if (!val.startsWith('https://')) val = 'https://' + val.replace(/^\/+/, '');
            }
            setForm({ ...form, host: val.replace(/^https:\/\//, '') });
          }}
          className="input w-full"
          placeholder="https://192.168.1.100"
          required
        />
      </div>

      {/* API Key */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium form-label">
            API Key {source && <span className="text-gray-500 font-normal">(leave blank to keep current)</span>}
          </label>
          <button
            type="button"
            onClick={() => setShowApiHelp(!showApiHelp)}
            className="text-xs text-primary hover:underline"
          >
            {showApiHelp ? 'Hide help' : 'How to get API key?'}
          </button>
        </div>
        <input
          type="password"
          value={form.apiKey}
          onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
          className="input w-full"
          placeholder={source ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : 'Enter API key'}
          required={!source}
        />
        {showApiHelp && (
          <div className="mt-2 p-2 bg-gray-800 rounded text-xs text-gray-400">
            In TrueNAS SCALE: <strong>Credentials → Users</strong> → select user → Edit → enable <strong>"TrueNAS Access"</strong> (Readonly Admin is sufficient) → Save. Then click <strong>"Add API Key"</strong>.
          </div>
        )}
      </div>

      {/* Pool & Dataset */}
      {(pools.length > 0 || form.pool) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium form-label mb-1">Pool</label>
            {loadingPools ? (
              <div className="input w-full flex items-center text-gray-500 text-sm">Loading...</div>
            ) : pools.length > 0 ? (
              <select
                value={form.pool}
                onChange={(e) => handlePoolChange(e.target.value)}
                className="input w-full"
              >
                <option value="">Auto (first pool)</option>
                {pools.map((pool) => (
                  <option key={pool.name} value={pool.name}>
                    {pool.name} ({pool.usedPercent}%)
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.pool}
                onChange={(e) => setForm({ ...form, pool: e.target.value })}
                className="input w-full"
                placeholder="Auto"
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium form-label mb-1">Dataset</label>
            {loadingDatasets ? (
              <div className="input w-full flex items-center text-gray-500 text-sm">Loading...</div>
            ) : datasets.length > 0 ? (
              <select
                value={form.dataset}
                onChange={(e) => setForm({ ...form, dataset: e.target.value })}
                className="input w-full"
              >
                <option value="">None (pool root)</option>
                {datasets.map((ds) => (
                  <option key={ds.id} value={ds.name}>{ds.name}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={form.dataset}
                onChange={(e) => setForm({ ...form, dataset: e.target.value })}
                className="input w-full"
                placeholder="None"
              />
            )}
          </div>
        </div>
      )}
    </>
  );

  const renderLocalFields = () => (
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
      <p className="text-xs text-gray-500 mt-1">Path visible inside the container</p>
    </div>
  );

  const renderSMBFields = () => (
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
      </div>
      <div className="grid grid-cols-2 gap-3">
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
          <label className="block text-sm font-medium form-label mb-1">Share</label>
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
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium form-label mb-1">Username</label>
          <input
            type="text"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            className="input w-full"
            placeholder="optional"
          />
        </div>
        <div>
          <label className="block text-sm font-medium form-label mb-1">Password</label>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="input w-full"
            placeholder="optional"
          />
        </div>
      </div>
    </>
  );

  const renderNFSFields = () => (
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
      </div>
      <div className="grid grid-cols-2 gap-3">
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

  return (
    <Portal>
      <div className="fixed inset-0 z-[100] flex items-center justify-center">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative card rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 m-4">
        <h2 className="text-lg font-semibold mb-4">
          {source ? 'Edit Storage Source' : 'Add Storage Source'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/50 border border-red-700 rounded p-2 text-red-200 text-sm">
              {error}
            </div>
          )}

          {/* Type selector - only for new sources */}
          {!source && (
            <div className="grid grid-cols-4 gap-2">
              {storageTypeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setForm({ ...form, type: option.value })}
                  className={`p-2 rounded border text-center text-sm transition-colors ${
                    form.type === option.value
                      ? 'border-primary bg-primary/20 text-white'
                      : 'border-gray-700 hover:border-gray-600 text-gray-400'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium form-label mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input w-full"
              placeholder={`My ${form.type === 'truenas' ? 'TrueNAS' : form.type.toUpperCase()} Storage`}
              required
            />
          </div>

          {/* Type-specific fields */}
          {form.type === 'truenas' && renderTrueNASFields()}
          {form.type === 'local' && renderLocalFields()}
          {form.type === 'smb' && renderSMBFields()}
          {form.type === 'nfs' && renderNFSFields()}

          {/* Settings row */}
          <div className="pt-3 border-t border-gray-700">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-400 flex items-center gap-1">
                Warning Threshold
                <span className="text-gray-600 cursor-help" title="Show warnings when disk usage exceeds this percentage">ⓘ</span>
              </span>
              <span className="font-medium">{form.thresholdPct}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={99}
              value={form.thresholdPct}
              onChange={(e) => setForm({ ...form, thresholdPct: parseInt(e.target.value) })}
              className="w-full h-1"
            />
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`p-2 rounded text-sm ${testResult.connected ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
              {testResult.connected ? '\u2713 ' : '\u2717 '}{testResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            {hasTested ? (
              <>
                <button type="button" onClick={handleTest} disabled={testing} className="btn btn-secondary">
                  {testing ? 'Testing...' : 'Re-test'}
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </>
            ) : (
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
        </form>
        </div>
      </div>
    </Portal>
  );
}

// Path Mappings Section - Simplified unified view
function PathMappingsSection() {
  const [servers, setServers] = useState<MediaServer[]>([]);
  const [apps, setApps] = useState<ArrApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const toast = useToast();

  const fetchData = async () => {
    try {
      const [serversRes, appsRes] = await Promise.all([
        mediaServers.list(),
        arrApps.list(),
      ]);
      setServers(serversRes.data.filter(s => s.type === 'jellyfin' || s.type === 'emby'));
      setApps(appsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const hasNoServices = apps.length === 0 && servers.length === 0;

  return (
    <div className="space-y-4">
      {/* Header with collapsible help */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">Path Mappings</h2>
          <p className="text-sm text-gray-400 mt-1">
            Tell Sweeparr how paths translate between your services.
          </p>
        </div>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {showHelp ? 'Hide help' : 'How does this work?'}
        </button>
      </div>

      {/* Collapsible help section */}
      {showHelp && (
        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4 text-sm">
          <p className="text-gray-300 mb-2">
            When services run in containers, they often see files at different paths.
          </p>
          <div className="text-gray-400 space-y-1">
            <p><strong className="text-gray-300">Example:</strong> Same files, different paths:</p>
            <p>• Radarr: <code className="bg-black/30 px-1 rounded">/movies</code></p>
            <p>• Sweeparr: <code className="bg-black/30 px-1 rounded">/data/media/movies</code></p>
            <p>• Jellyfin: <code className="bg-black/30 px-1 rounded">/media/movies</code></p>
          </div>
          <p className="text-gray-400 mt-2">
            Most setups use the same paths everywhere. Only configure mappings if your paths differ.
          </p>
        </div>
      )}

      {/* Empty state */}
      {hasNoServices && (
        <div className="card p-8 text-center">
          <p className="text-gray-400">No services configured yet.</p>
          <p className="text-sm text-gray-500 mt-1">
            Add Radarr, Sonarr, Jellyfin, or Emby in <a href="/settings/connections" className="text-orange-400 hover:underline">Connections</a> first.
          </p>
        </div>
      )}

      {/* Unified service list */}
      {!hasNoServices && (
        <div className="space-y-3">
          {/* Arr Apps */}
          {apps.map(app => (
            <UnifiedPathMappingCard
              key={`arr-${app.id}`}
              id={app.id}
              name={app.name}
              type={app.type}
              serviceType="arr"
              onSaved={fetchData}
            />
          ))}
          
          {/* Media Servers */}
          {servers.map(server => (
            <UnifiedPathMappingCard
              key={`server-${server.id}`}
              id={server.id}
              name={server.name}
              type={server.type}
              serviceType="mediaServer"
              onSaved={fetchData}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Unified Path Mapping Card - Works for both Arr apps and Media Servers
interface UnifiedPathMappingCardProps {
  id: number;
  name: string;
  type: string;
  serviceType: 'arr' | 'mediaServer';
  onSaved: () => void;
}

function UnifiedPathMappingCard({ id, name, type, serviceType, onSaved }: UnifiedPathMappingCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [mappings, setMappings] = useState<Array<{ localPath: string; remotePath: string; customPath?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [browsingIndex, setBrowsingIndex] = useState<number | null>(null);
  const toast = useToast();

  // Determine the remote path field name based on service type
  const remotePathKey = serviceType === 'arr' ? 'arrPath' : 'mediaServerPath';
  const endpoint = serviceType === 'arr' ? `/path-mappings/arr/${id}` : `/path-mappings/media-server/${id}`;

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        const { get } = await import('../api/client');
        const response = await get<{ success: boolean; data: Array<any> }>(endpoint);
        // Normalize the data structure
        const normalized = (response.data || []).map((m: any) => ({
          localPath: m.localPath || '',
          remotePath: m[remotePathKey] || m.localPath || '',
          customPath: m.localPath !== (m[remotePathKey] || m.localPath),
        }));
        setMappings(normalized);
      } catch (error) {
        console.error('Failed to fetch mappings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMappings();
  }, [id, endpoint, remotePathKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { put } = await import('../api/client');
      // Convert back to the expected format
      const payload = mappings.map(m => ({
        localPath: m.localPath,
        [remotePathKey]: m.customPath ? m.remotePath : m.localPath,
      }));
      await put(endpoint, { mappings: payload });
      toast.success('Path mappings saved');
      setHasChanges(false);
      onSaved();
    } catch (error) {
      console.error('Failed to save mappings:', error);
      toast.error('Failed to save mappings');
    } finally {
      setSaving(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { localPath: '', remotePath: '', customPath: false }]);
    setHasChanges(true);
    setExpanded(true);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const updateMapping = (index: number, field: 'localPath' | 'remotePath' | 'customPath', value: string | boolean) => {
    const updated = [...mappings];
    if (field === 'customPath') {
      updated[index].customPath = value as boolean;
      if (!value) {
        updated[index].remotePath = updated[index].localPath;
      }
    } else if (field === 'localPath') {
      updated[index].localPath = value as string;
      if (!updated[index].customPath) {
        updated[index].remotePath = value as string;
      }
    } else {
      updated[index].remotePath = value as string;
    }
    setMappings(updated);
    setHasChanges(true);
  };

  const getServiceLabel = () => {
    switch (type) {
      case 'radarr': return 'Radarr';
      case 'sonarr': return 'Sonarr';
      case 'jellyfin': return 'Jellyfin';
      case 'emby': return 'Emby';
      default: return name;
    }
  };

  const mappingCount = mappings.length;
  const allPathsSame = mappings.every(m => m.localPath === m.remotePath);

  return (
    <div className="card">
      {/* Header - always visible */}
      <div 
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <ServiceLogo type={type} size={28} />
          <div>
            <span className="font-medium">{name}</span>
            <span className="text-sm text-gray-500 ml-2">({getServiceLabel()})</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {loading ? (
            <LoadingSpinner size="sm" />
          ) : mappingCount > 0 ? (
            <span className="text-sm text-gray-400">
              {mappingCount} path{mappingCount !== 1 ? 's' : ''}
              {allPathsSame && <span className="text-green-500 ml-1">✓ same</span>}
            </span>
          ) : (
            <span className="text-sm text-gray-500">No mappings</span>
          )}
          
          <svg 
            className={`w-5 h-5 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-gray-700 p-4 space-y-3">
          {mappings.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-2">
              No path mappings configured. Paths are assumed to be the same.
            </p>
          ) : (
            mappings.map((mapping, index) => (
              <div key={index} className="bg-tertiary rounded-lg p-3 space-y-2">
                {/* Sweeparr Path */}
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Sweeparr Path</label>
                  <div className="flex gap-1">
                    <input
                      type="text"
                      value={mapping.localPath}
                      onChange={(e) => updateMapping(index, 'localPath', e.target.value)}
                      className="input flex-1 text-sm"
                      placeholder="/data/media/movies"
                    />
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setBrowsingIndex(index); }}
                      className="btn btn-secondary text-sm px-2"
                      title="Browse"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => removeMapping(index)}
                      className="btn btn-danger text-sm px-2"
                      title="Remove"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Custom path toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateMapping(index, 'customPath', !mapping.customPath)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        mapping.customPath ? 'bg-orange-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          mapping.customPath ? 'translate-x-[18px]' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-gray-400">
                      {getServiceLabel()} uses a different path
                    </span>
                  </div>
                  {!mapping.customPath && mapping.localPath && (
                    <span className="text-xs text-gray-500">
                      {getServiceLabel()}: <code className="bg-black/30 px-1 rounded">{mapping.localPath}</code>
                    </span>
                  )}
                </div>

                {/* Custom path input */}
                {mapping.customPath && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{getServiceLabel()} Path</label>
                    <input
                      type="text"
                      value={mapping.remotePath}
                      onChange={(e) => updateMapping(index, 'remotePath', e.target.value)}
                      className="input w-full text-sm"
                      placeholder={`/${type === 'radarr' ? 'movies' : type === 'sonarr' ? 'tv' : 'media'}`}
                    />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button onClick={addMapping} className="btn btn-secondary text-sm">
              + Add Path
            </button>
            
            {hasChanges && (
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="btn btn-primary text-sm"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* File Browser Modal */}
      <FileBrowser
        isOpen={browsingIndex !== null}
        onClose={() => setBrowsingIndex(null)}
        onSelect={(path) => {
          if (browsingIndex !== null) {
            updateMapping(browsingIndex, 'localPath', path);
          }
        }}
        initialPath={browsingIndex !== null ? mappings[browsingIndex]?.localPath || '/' : '/'}
        title="Select Sweeparr Path"
      />
    </div>
  );
}

// Arr App Path Mapping Card
interface ArrPathMappingCardProps {
  app: ArrApp;
  onSaved: () => void;
}

function ArrPathMappingCard({ app, onSaved }: ArrPathMappingCardProps) {
  const [editing, setEditing] = useState(false);
  const [mappings, setMappings] = useState<Array<{ arrPath: string; localPath: string; customPath?: boolean }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testResults, setTestResults] = useState<Array<{ mapping: { arrPath: string; localPath: string }; localPathExists: boolean; message: string }> | null>(null);
  const [browsingIndex, setBrowsingIndex] = useState<number | null>(null);
  const toast = useToast();

  useEffect(() => {
    const fetchMappingsAndTest = async () => {
      try {
        const { get, post } = await import('../api/client');
        const response = await get<{ success: boolean; data: Array<{ arrPath: string; localPath: string }> }>(`/path-mappings/arr/${app.id}`);
        setMappings(response.data || []);
        
        // Auto-test if mappings exist
        if (response.data && response.data.length > 0) {
          try {
            const testResponse = await post<{ success: boolean; data: { results: Array<{ mapping: { arrPath: string; localPath: string }; localPathExists: boolean; message: string }> } }>(`/path-mappings/arr/${app.id}/test`);
            setTestResults(testResponse.data.results);
          } catch (testError) {
            console.error('Failed to test mappings:', testError);
          }
        }
      } catch (error) {
        console.error('Failed to fetch mappings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMappingsAndTest();
  }, [app.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { put } = await import('../api/client');
      await put(`/path-mappings/arr/${app.id}`, { mappings });
      toast.success('Path mappings saved');
      setEditing(false);
      setTestResults(null);
      onSaved();
    } catch (error) {
      console.error('Failed to save mappings:', error);
      toast.error('Failed to save mappings');
    } finally {
      setSaving(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { arrPath: '', localPath: '', customPath: false }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: 'arrPath' | 'localPath' | 'customPath', value: string | boolean) => {
    const updated = [...mappings];
    if (field === 'customPath') {
      updated[index].customPath = value as boolean;
      // When disabling custom path, sync arrPath to localPath
      if (!value) {
        updated[index].arrPath = updated[index].localPath;
      }
    } else {
      (updated[index] as any)[field] = value;
      // Auto-sync arrPath when localPath changes and customPath is off
      if (field === 'localPath' && !updated[index].customPath) {
        updated[index].arrPath = value as string;
      }
    }
    setMappings(updated);
  };

  if (loading) {
    return (
      <div className="bg-tertiary rounded-lg p-4">
        <div className="flex items-center gap-3">
          <ServiceLogo type={app.type} size={28} />
          <span className="font-medium">{app.name}</span>
          <LoadingSpinner size="sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-tertiary rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <ServiceLogo type={app.type} size={28} />
          <div>
            <span className="font-medium">{app.name}</span>
            <span className="text-sm text-gray-400 ml-2 capitalize">({app.type})</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mappings.length > 0 && !editing && (
            <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded">
              {mappings.length} mapping{mappings.length > 1 ? 's' : ''}
            </span>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn btn-secondary text-sm">
              Edit
            </button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          {mappings.length === 0 ? (
            <p className="text-sm text-gray-400">No mappings configured. Click "Add Mapping" to start.</p>
          ) : (
            mappings.map((mapping, index) => (
              <div key={index} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-gray-400 mb-1 block">Sweeparr Path</label>
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={mapping.localPath}
                        onChange={(e) => updateMapping(index, 'localPath', e.target.value)}
                        className="input flex-1 text-sm"
                        placeholder="/data/media/movies"
                      />
                      <button
                        type="button"
                        onClick={() => setBrowsingIndex(index)}
                        className="btn btn-secondary text-sm px-2"
                        title="Browse"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeMapping(index)}
                    className="btn btn-danger text-sm mt-5"
                  >
                    ✕
                  </button>
                </div>
                
                {/* Custom path toggle */}
                <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateMapping(index, 'customPath', !mapping.customPath)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                        mapping.customPath ? 'bg-orange-600' : 'bg-gray-600'
                      }`}
                    >
                      <span
                        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                          mapping.customPath ? 'translate-x-[18px]' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <span className="text-sm text-gray-400">
                      {app.type === 'radarr' ? 'Radarr' : 'Sonarr'} uses a different path
                    </span>
                  </div>
                  {!mapping.customPath && mapping.localPath && (
                    <span className="text-xs text-gray-500">
                      {app.type === 'radarr' ? 'Radarr' : 'Sonarr'} path: <code className="bg-black/30 px-1 rounded">{mapping.localPath}</code>
                    </span>
                  )}
                </div>
                
                {/* Custom path input - only shown when toggle is on */}
                {mapping.customPath && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">{app.type === 'radarr' ? 'Radarr' : 'Sonarr'} Path</label>
                    <input
                      type="text"
                      value={mapping.arrPath}
                      onChange={(e) => updateMapping(index, 'arrPath', e.target.value)}
                      className="input w-full text-sm"
                      placeholder="/movies"
                    />
                  </div>
                )}
              </div>
            ))
          )}
          <button onClick={addMapping} className="btn btn-secondary text-sm">
            + Add Mapping
          </button>
        </div>
      ) : mappings.length > 0 ? (
        <div className="space-y-1">
          {mappings.map((mapping, index) => {
            const testResult = testResults?.find(r => r.mapping.localPath === mapping.localPath);
            const pathsDiffer = mapping.localPath !== mapping.arrPath;
            return (
              <div key={index} className="flex items-center gap-2 text-sm text-gray-400">
                {testResult && (
                  <span 
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${testResult.localPathExists ? 'bg-green-500' : 'bg-red-500'}`} 
                    title={testResult.message}
                  />
                )}
                <code className="bg-black/30 px-1 rounded">{mapping.localPath}</code>
                {pathsDiffer && (
                  <>
                    <span>→</span>
                    <code className="bg-black/30 px-1 rounded">{mapping.arrPath}</code>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No path mappings configured</p>
      )}

      {/* File Browser Modal */}
      <FileBrowser
        isOpen={browsingIndex !== null}
        onClose={() => setBrowsingIndex(null)}
        onSelect={(path) => {
          if (browsingIndex !== null) {
            updateMapping(browsingIndex, 'localPath', path);
          }
        }}
        initialPath={browsingIndex !== null ? mappings[browsingIndex]?.localPath || '/' : '/'}
        title="Select Sweeparr Path"
      />
    </div>
  );
}

// Media Server Path Mapping Card
interface MediaServerPathMappingCardProps {
  server: MediaServer;
  onSaved: () => void;
}

function MediaServerPathMappingCard({ server, onSaved }: MediaServerPathMappingCardProps) {
  const [editing, setEditing] = useState(false);
  const [mappings, setMappings] = useState<Array<{ localPath: string; mediaServerPath: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    const fetchMappings = async () => {
      try {
        const { get } = await import('../api/client');
        const response = await get<{ success: boolean; data: Array<{ localPath: string; mediaServerPath: string }> }>(`/path-mappings/media-server/${server.id}`);
        setMappings(response.data || []);
      } catch (error) {
        console.error('Failed to fetch mappings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMappings();
  }, [server.id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { put } = await import('../api/client');
      await put(`/path-mappings/media-server/${server.id}`, { mappings });
      toast.success('Path mappings saved');
      setEditing(false);
      onSaved();
    } catch (error) {
      console.error('Failed to save mappings:', error);
      toast.error('Failed to save mappings');
    } finally {
      setSaving(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { localPath: '', mediaServerPath: '' }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: 'localPath' | 'mediaServerPath', value: string) => {
    const updated = [...mappings];
    updated[index][field] = value;
    setMappings(updated);
  };

  if (loading) {
    return (
      <div className="bg-tertiary rounded-lg p-4">
        <div className="flex items-center gap-3">
          <ServiceLogo type={server.type} size={28} />
          <span className="font-medium">{server.name}</span>
          <LoadingSpinner size="sm" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-tertiary rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <ServiceLogo type={server.type} size={28} />
          <div>
            <span className="font-medium">{server.name}</span>
            <span className="text-sm text-gray-400 ml-2 capitalize">({server.type})</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {mappings.length > 0 && !editing && (
            <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded">
              {mappings.length} mapping{mappings.length > 1 ? 's' : ''}
            </span>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn btn-secondary text-sm">
              {mappings.length > 0 ? 'Edit' : 'Configure'}
            </button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          {mappings.length === 0 ? (
            <p className="text-sm text-gray-400">No mappings configured. Click "Add Mapping" to start.</p>
          ) : (
            mappings.map((mapping, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">Sweeparr Path</label>
                  <input
                    type="text"
                    value={mapping.localPath}
                    onChange={(e) => updateMapping(index, 'localPath', e.target.value)}
                    className="input w-full text-sm"
                    placeholder="/data/media/movies"
                  />
                </div>
                <span className="text-gray-500 mt-5">→</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-400 mb-1 block">{server.name} Path</label>
                  <input
                    type="text"
                    value={mapping.mediaServerPath}
                    onChange={(e) => updateMapping(index, 'mediaServerPath', e.target.value)}
                    className="input w-full text-sm"
                    placeholder="/media/movies"
                  />
                </div>
                <button
                  onClick={() => removeMapping(index)}
                  className="btn btn-danger text-sm mt-5"
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <button onClick={addMapping} className="btn btn-secondary text-sm">
            + Add Mapping
          </button>
        </div>
      ) : mappings.length > 0 ? (
        <div className="space-y-1">
          {mappings.map((mapping, index) => (
            <div key={index} className="text-sm text-gray-400">
              <code className="bg-black/30 px-1 rounded">{mapping.localPath}</code>
              <span className="mx-2">→</span>
              <code className="bg-black/30 px-1 rounded">{mapping.mediaServerPath}</code>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No path mappings configured</p>
      )}
    </div>
  );
}

// Combined Media Server Configuration Card (Path Mappings + Leaving Soon) - Stacked Layout
interface MediaServerConfigCardProps {
  server: MediaServer;
  onSaved: () => void;
}

function MediaServerConfigCard({ server, onSaved }: MediaServerConfigCardProps) {
  const [mappingsEditing, setMappingsEditing] = useState(false);
  const [leavingSoonEditing, setLeavingSoonEditing] = useState(false);
  const [mappings, setMappings] = useState<Array<{ localPath: string; mediaServerPath: string; customPath?: boolean }>>([]);
  const [mappingsLoading, setMappingsLoading] = useState(true);
  const [mappingsSaving, setMappingsSaving] = useState(false);
  const [mappingsTestResults, setMappingsTestResults] = useState<Array<{ mapping: { localPath: string; mediaServerPath: string }; localPathExists: boolean; message: string }> | null>(null);
  const [leavingSoonPaths, setLeavingSoonPaths] = useState({
    moviesLocalPath: server.leavingSoonMoviesPath || '',
    tvLocalPath: server.leavingSoonTvPath || '',
  });
  const [leavingSoonSaving, setLeavingSoonSaving] = useState(false);
  const [leavingSoonTestResults, setLeavingSoonTestResults] = useState<{ movies?: { exists: boolean; message: string }; tv?: { exists: boolean; message: string } } | null>(null);
  const [browsingMappingIndex, setBrowsingMappingIndex] = useState<number | null>(null);
  const [browsingLeavingSoon, setBrowsingLeavingSoon] = useState<'movies' | 'tv' | null>(null);
  const toast = useToast();

  // Fetch path mappings and auto-test
  useEffect(() => {
    const fetchMappingsAndTest = async () => {
      try {
        const { get, post } = await import('../api/client');
        const response = await get<{ success: boolean; data: Array<{ localPath: string; mediaServerPath: string }> }>(`/path-mappings/media-server/${server.id}`);
        setMappings(response.data || []);
        
        // Auto-test mappings if they exist
        if (response.data && response.data.length > 0) {
          try {
            const testResponse = await post<{ success: boolean; data: { results: Array<{ mapping: { localPath: string; mediaServerPath: string }; localPathExists: boolean; message: string }> } }>(`/path-mappings/media-server/${server.id}/test`);
            setMappingsTestResults(testResponse.data.results);
          } catch (testError) {
            console.error('Failed to test mappings:', testError);
          }
        }
      } catch (error) {
        console.error('Failed to fetch mappings:', error);
      } finally {
        setMappingsLoading(false);
      }
    };
    fetchMappingsAndTest();
  }, [server.id]);

  // Update leaving soon paths when server prop changes and auto-test
  useEffect(() => {
    setLeavingSoonPaths({
      moviesLocalPath: server.leavingSoonMoviesPath || '',
      tvLocalPath: server.leavingSoonTvPath || '',
    });
    
    // Auto-test leaving soon paths
    const testLeavingSoonPaths = async () => {
      if (!server.leavingSoonMoviesPath && !server.leavingSoonTvPath) return;
      
      try {
        const { post } = await import('../api/client');
        const results: { movies?: { exists: boolean; message: string }; tv?: { exists: boolean; message: string } } = {};
        
        if (server.leavingSoonMoviesPath) {
          const response = await post<{ success: boolean; data: { exists: boolean; isDirectory: boolean; message: string } }>('/path-mappings/test-path', { path: server.leavingSoonMoviesPath });
          results.movies = { exists: response.data.exists && response.data.isDirectory, message: response.data.message };
        }
        
        if (server.leavingSoonTvPath) {
          const response = await post<{ success: boolean; data: { exists: boolean; isDirectory: boolean; message: string } }>('/path-mappings/test-path', { path: server.leavingSoonTvPath });
          results.tv = { exists: response.data.exists && response.data.isDirectory, message: response.data.message };
        }
        
        setLeavingSoonTestResults(results);
      } catch (error) {
        console.error('Failed to test leaving soon paths:', error);
      }
    };
    testLeavingSoonPaths();
  }, [server.leavingSoonMoviesPath, server.leavingSoonTvPath]);

  const handleSaveMappings = async () => {
    setMappingsSaving(true);
    try {
      const { put } = await import('../api/client');
      await put(`/path-mappings/media-server/${server.id}`, { mappings });
      toast.success('Path mappings saved');
      setMappingsEditing(false);
      setMappingsTestResults(null);
      onSaved();
    } catch (error) {
      console.error('Failed to save mappings:', error);
      toast.error('Failed to save mappings');
    } finally {
      setMappingsSaving(false);
    }
  };

  const handleSaveLeavingSoon = async () => {
    setLeavingSoonSaving(true);
    try {
      await mediaServers.update(server.id, {
        leavingSoonMoviesPath: leavingSoonPaths.moviesLocalPath || null,
        leavingSoonTvPath: leavingSoonPaths.tvLocalPath || null,
      } as any);
      toast.success('Leaving Soon paths saved');
      setLeavingSoonEditing(false);
      setLeavingSoonTestResults(null);
      onSaved();
    } catch (error) {
      console.error('Failed to save paths:', error);
      toast.error('Failed to save paths');
    } finally {
      setLeavingSoonSaving(false);
    }
  };

  const addMapping = () => {
    setMappings([...mappings, { localPath: '', mediaServerPath: '', customPath: false }]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const updateMapping = (index: number, field: 'localPath' | 'mediaServerPath' | 'customPath', value: string | boolean) => {
    const updated = [...mappings];
    if (field === 'customPath') {
      updated[index].customPath = value as boolean;
      // When disabling custom path, sync mediaServerPath to localPath
      if (!value) {
        updated[index].mediaServerPath = updated[index].localPath;
      }
    } else {
      (updated[index] as any)[field] = value;
      // Auto-sync mediaServerPath when localPath changes and customPath is off
      if (field === 'localPath' && !updated[index].customPath) {
        updated[index].mediaServerPath = value as string;
      }
    }
    setMappings(updated);
  };

  const hasLeavingSoonConfig = server.leavingSoonMoviesPath || server.leavingSoonTvPath;

  // Calculate status badges
  const mappingsConfigured = mappings.length > 0;
  const leavingSoonConfigured = hasLeavingSoonConfig;

  return (
    <div className="bg-tertiary rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ServiceLogo type={server.type} size={32} />
            <div>
              <span className="font-medium text-lg">{server.name}</span>
              <span className="text-sm text-gray-400 ml-2 capitalize">({server.type})</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {mappingsConfigured && (
              <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded">
                {mappings.length} mapping{mappings.length > 1 ? 's' : ''}
              </span>
            )}
            {leavingSoonConfigured && (
              <span className="px-2 py-1 bg-orange-900 text-orange-300 text-xs rounded">
                Leaving Soon
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Path Mappings Section */}
      <div className="p-4 border-b border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-medium text-sm">Path Mappings</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Map paths from Sweeparr to how {server.name} sees them
            </p>
          </div>
          {!mappingsEditing ? (
            <button onClick={() => setMappingsEditing(true)} className="btn btn-secondary text-sm">
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setMappingsEditing(false)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={handleSaveMappings} disabled={mappingsSaving} className="btn btn-primary text-sm">
                {mappingsSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {mappingsLoading ? (
          <div className="flex items-center gap-2 text-gray-400">
            <LoadingSpinner size="sm" />
            <span>Loading...</span>
          </div>
        ) : mappingsEditing ? (
          <div className="space-y-3">
            {mappings.length === 0 ? (
              <p className="text-sm text-gray-400">No mappings configured. Click "Add Mapping" to start.</p>
            ) : (
              mappings.map((mapping, index) => (
                <div key={index} className="bg-secondary/30 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400 mb-1 block">Sweeparr Path</label>
                      <div className="flex gap-1">
                        <input
                          type="text"
                          value={mapping.localPath}
                          onChange={(e) => updateMapping(index, 'localPath', e.target.value)}
                          className="input flex-1 text-sm"
                          placeholder="/data/media/movies"
                        />
                        <button
                          type="button"
                          onClick={() => setBrowsingMappingIndex(index)}
                          className="btn btn-secondary text-sm px-2"
                          title="Browse"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeMapping(index)}
                      className="btn btn-danger text-sm mt-5"
                    >
                      ✕
                    </button>
                  </div>
                  
                  {/* Custom path toggle */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-700">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateMapping(index, 'customPath', !mapping.customPath)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          mapping.customPath ? 'bg-orange-600' : 'bg-gray-600'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            mapping.customPath ? 'translate-x-[18px]' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="text-sm text-gray-400">
                        {server.name} uses a different path
                      </span>
                    </div>
                    {!mapping.customPath && mapping.localPath && (
                      <span className="text-xs text-gray-500">
                        {server.name} path: <code className="bg-black/30 px-1 rounded">{mapping.localPath}</code>
                      </span>
                    )}
                  </div>
                  
                  {/* Custom path input - only shown when toggle is on */}
                  {mapping.customPath && (
                    <div>
                      <label className="text-xs text-gray-400 mb-1 block">{server.name} Path</label>
                      <input
                        type="text"
                        value={mapping.mediaServerPath}
                        onChange={(e) => updateMapping(index, 'mediaServerPath', e.target.value)}
                        className="input w-full text-sm"
                        placeholder="/media/movies"
                      />
                    </div>
                  )}
                </div>
              ))
            )}
            <button onClick={addMapping} className="btn btn-secondary text-sm">
              + Add Mapping
            </button>
          </div>
        ) : mappingsConfigured ? (
          <div className="space-y-1">
            {mappings.map((mapping, index) => {
              const testResult = mappingsTestResults?.find(r => r.mapping.localPath === mapping.localPath);
              const pathsDiffer = mapping.localPath !== mapping.mediaServerPath;
              return (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-400">
                  {testResult && (
                    <span 
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${testResult.localPathExists ? 'bg-green-500' : 'bg-red-500'}`} 
                      title={testResult.message}
                    />
                  )}
                  <code className="bg-black/30 px-1 rounded">{mapping.localPath}</code>
                  {pathsDiffer && (
                    <>
                      <span>→</span>
                      <code className="bg-black/30 px-1 rounded">{mapping.mediaServerPath}</code>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No path mappings configured</p>
        )}
      </div>

      {/* Leaving Soon Section */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h4 className="font-medium text-sm">Leaving Soon Libraries</h4>
            <p className="text-xs text-gray-400 mt-0.5">
              Configure where symlinks are created for media scheduled for cleanup
            </p>
          </div>
          {!leavingSoonEditing ? (
            <button onClick={() => setLeavingSoonEditing(true)} className="btn btn-secondary text-sm">
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => setLeavingSoonEditing(false)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={handleSaveLeavingSoon} disabled={leavingSoonSaving} className="btn btn-primary text-sm">
                {leavingSoonSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {leavingSoonEditing ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-400 mb-2">
              Specify where Sweeparr should create symlinks. These paths must be accessible by both Sweeparr and {server.name}.
            </p>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Movies Symlink Path</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={leavingSoonPaths.moviesLocalPath}
                  onChange={(e) => setLeavingSoonPaths({ ...leavingSoonPaths, moviesLocalPath: e.target.value })}
                  className="input flex-1 text-sm"
                  placeholder="/mnt/media-library/leaving-soon/movies"
                />
                <button
                  type="button"
                  onClick={() => setBrowsingLeavingSoon('movies')}
                  className="btn btn-secondary text-sm px-2"
                  title="Browse"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </button>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">TV Shows Symlink Path</label>
              <div className="flex gap-1">
                <input
                  type="text"
                  value={leavingSoonPaths.tvLocalPath}
                  onChange={(e) => setLeavingSoonPaths({ ...leavingSoonPaths, tvLocalPath: e.target.value })}
                  className="input flex-1 text-sm"
                  placeholder="/mnt/media-library/leaving-soon/tv"
                />
                <button
                  type="button"
                  onClick={() => setBrowsingLeavingSoon('tv')}
                  className="btn btn-secondary text-sm px-2"
                  title="Browse"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ) : leavingSoonConfigured ? (
          <div className="space-y-2">
            {server.leavingSoonMoviesPath && (
              <div className="flex items-center gap-2 text-sm">
                {leavingSoonTestResults?.movies && (
                  <span 
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${leavingSoonTestResults.movies.exists ? 'bg-green-500' : 'bg-red-500'}`} 
                    title={leavingSoonTestResults.movies.message}
                  />
                )}
                <span className="text-gray-400">Movies:</span>
                <code className="bg-black/30 px-1 rounded">{server.leavingSoonMoviesPath}</code>
              </div>
            )}
            {server.leavingSoonTvPath && (
              <div className="flex items-center gap-2 text-sm">
                {leavingSoonTestResults?.tv && (
                  <span 
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${leavingSoonTestResults.tv.exists ? 'bg-green-500' : 'bg-red-500'}`} 
                    title={leavingSoonTestResults.tv.message}
                  />
                )}
                <span className="text-gray-400">TV Shows:</span>
                <code className="bg-black/30 px-1 rounded">{server.leavingSoonTvPath}</code>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No symlink paths configured</p>
        )}
      </div>

      {/* File Browser Modals */}
      <FileBrowser
        isOpen={browsingMappingIndex !== null}
        onClose={() => setBrowsingMappingIndex(null)}
        onSelect={(path) => {
          if (browsingMappingIndex !== null) {
            updateMapping(browsingMappingIndex, 'localPath', path);
          }
        }}
        initialPath={browsingMappingIndex !== null ? mappings[browsingMappingIndex]?.localPath || '/' : '/'}
        title="Select Sweeparr Path"
      />

      <FileBrowser
        isOpen={browsingLeavingSoon !== null}
        onClose={() => setBrowsingLeavingSoon(null)}
        onSelect={(path) => {
          if (browsingLeavingSoon === 'movies') {
            setLeavingSoonPaths({ ...leavingSoonPaths, moviesLocalPath: path });
          } else if (browsingLeavingSoon === 'tv') {
            setLeavingSoonPaths({ ...leavingSoonPaths, tvLocalPath: path });
          }
        }}
        initialPath={
          browsingLeavingSoon === 'movies' 
            ? leavingSoonPaths.moviesLocalPath || '/' 
            : browsingLeavingSoon === 'tv' 
              ? leavingSoonPaths.tvLocalPath || '/'
              : '/'
        }
        title={browsingLeavingSoon === 'movies' ? 'Select Movies Symlink Path' : 'Select TV Shows Symlink Path'}
      />
    </div>
  );
}

// Leaving Soon Path Card (kept for backwards compatibility)
interface LeavingSoonPathCardProps {
  server: MediaServer;
  onSaved: () => void;
}

function LeavingSoonPathCard({ server, onSaved }: LeavingSoonPathCardProps) {
  const [editing, setEditing] = useState(false);
  const [paths, setPaths] = useState({
    moviesLocalPath: server.leavingSoonMoviesPath || '',
    tvLocalPath: server.leavingSoonTvPath || '',
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const hasConfig = server.leavingSoonMoviesPath || server.leavingSoonTvPath;

  const handleSave = async () => {
    setSaving(true);
    try {
      await mediaServers.update(server.id, {
        leavingSoonMoviesPath: paths.moviesLocalPath || null,
        leavingSoonTvPath: paths.tvLocalPath || null,
      } as any);
      toast.success('Leaving Soon paths saved');
      setEditing(false);
      onSaved();
    } catch (error) {
      console.error('Failed to save paths:', error);
      toast.error('Failed to save paths');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-tertiary rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <ServiceLogo type={server.type} size={28} />
          <div>
            <span className="font-medium">{server.name}</span>
            <span className="text-sm text-gray-400 ml-2 capitalize">({server.type})</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasConfig && !editing && (
            <span className="px-2 py-1 bg-green-900 text-green-300 text-xs rounded">Configured</span>
          )}
          {!editing ? (
            <button onClick={() => setEditing(true)} className="btn btn-secondary text-sm">
              {hasConfig ? 'Edit' : 'Configure'}
            </button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} className="btn btn-secondary text-sm">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary text-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-400 mb-2">
            Specify where Sweeparr should create symlinks. These paths must be accessible by both Sweeparr and {server.name}.
          </p>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Movies Symlink Path</label>
            <input
              type="text"
              value={paths.moviesLocalPath}
              onChange={(e) => setPaths({ ...paths, moviesLocalPath: e.target.value })}
              className="input w-full text-sm"
              placeholder="/mnt/media-library/leaving-soon/movies"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">TV Shows Symlink Path</label>
            <input
              type="text"
              value={paths.tvLocalPath}
              onChange={(e) => setPaths({ ...paths, tvLocalPath: e.target.value })}
              className="input w-full text-sm"
              placeholder="/mnt/media-library/leaving-soon/tv"
            />
          </div>
        </div>
      ) : hasConfig ? (
        <div className="space-y-2">
          {server.leavingSoonMoviesPath && (
            <div className="text-sm">
              <span className="text-gray-400">Movies:</span>
              <code className="bg-black/30 px-1 rounded ml-2">{server.leavingSoonMoviesPath}</code>
            </div>
          )}
          {server.leavingSoonTvPath && (
            <div className="text-sm">
              <span className="text-gray-400">TV Shows:</span>
              <code className="bg-black/30 px-1 rounded ml-2">{server.leavingSoonTvPath}</code>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">No symlink paths configured</p>
      )}
    </div>
  );
}

// Statistics service type options
const statisticsServiceOptions: { value: StatisticsServiceType; label: string }[] = [
  { value: 'jellystat', label: 'Jellystat' },
  { value: 'tautulli', label: 'Tautulli' },
];

function StatisticsServicesSection() {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<StatisticsService[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<StatisticsService | null>(null);

  const fetchServices = async () => {
    try {
      const response = await statisticsServices.list();
      setServices(response.data);
    } catch (error) {
      console.error('Failed to fetch statistics services:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServices();
  }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this statistics service?')) return;
    try {
      await statisticsServices.delete(id);
      setServices(services.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete statistics service:', error);
    }
  };

  const handleTest = async (id: number) => {
    try {
      const result = await statisticsServices.test(id);
      return { data: result.data };
    } catch (error: any) {
      return { data: { connected: false, message: error?.message || 'Test failed' } };
    }
  };

  const handleSaved = () => {
    setShowModal(false);
    setEditingService(null);
    fetchServices();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Statistics Services</h2>
          <p className="text-sm text-gray-400 mt-1">
            Connect Jellystat or Tautulli to track playback history for cleanup rules.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingService(null);
            setShowModal(true);
          }}
          className="btn btn-primary"
        >
          + Add Service
        </button>
      </div>

      {services.length === 0 ? (
        <div className="card p-8 text-center">
          <div className="text-4xl mb-3">📊</div>
          <h3 className="text-lg font-medium mb-2">No Statistics Services</h3>
          <p className="text-gray-400 mb-4">
            Add Jellystat to track when media was last watched and enable watch-based cleanup rules.
          </p>
          <button
            onClick={() => {
              setEditingService(null);
              setShowModal(true);
            }}
            className="btn btn-primary"
          >
            + Add Service
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {services.map((service) => (
            <ConnectionCard
              key={service.id}
              name={service.name}
              type={service.type}
              url={service.url}
              enabled={service.isEnabled}
              onEdit={() => {
                setEditingService(service);
                setShowModal(true);
              }}
              onDelete={() => handleDelete(service.id)}
              onTest={() => handleTest(service.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <StatisticsServiceModal
          service={editingService}
          onClose={() => {
            setShowModal(false);
            setEditingService(null);
          }}
          onSaved={handleSaved}
          onDelete={(id) => {
            handleDelete(id);
            setShowModal(false);
            setEditingService(null);
          }}
        />
      )}
    </div>
  );
}

interface StatisticsServiceModalProps {
  service: StatisticsService | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: number) => void;
}

function StatisticsServiceModal({ service, onClose, onSaved, onDelete }: StatisticsServiceModalProps) {
  const [form, setForm] = useState({
    name: service?.name || '',
    type: service?.type || 'jellystat' as StatisticsServiceType,
    url: service?.url || '',
    apiKey: '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [connectionVerified, setConnectionVerified] = useState(!!service);

  // Reset verification when connection details change
  useEffect(() => {
    if (!service) {
      setConnectionVerified(false);
      setTestResult(null);
    }
  }, [form.url, form.apiKey, form.type]);

  const handleTest = async () => {
    if (!form.url || !form.apiKey) {
      setError('URL and API Key are required to test');
      return;
    }

    setTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await statisticsServices.testConnection({
        type: form.type,
        url: form.url,
        apiKey: form.apiKey,
      });
      setTestResult(result.data);
      setConnectionVerified(result.data.connected);
    } catch (err: any) {
      setTestResult({ connected: false, message: err?.message || 'Test failed' });
      setConnectionVerified(false);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connectionVerified && !service) {
      setError('Please test the connection before saving');
      return;
    }
    
    setSaving(true);
    setError(null);

    try {
      const payload: any = {
        name: form.name,
        type: form.type,
        url: form.url,
      };
      if (form.apiKey) {
        payload.apiKey = form.apiKey;
      }

      if (service) {
        await statisticsServices.update(service.id, payload);
      } else {
        await statisticsServices.create(payload);
      }
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const canSave = service ? true : connectionVerified;

  return (
    <Modal onClose={onClose} title={service ? 'Edit Statistics Service' : 'Add Statistics Service'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium form-label mb-1">Type</label>
          <IconSelect
            options={statisticsServiceOptions}
            value={form.type}
            onChange={(value) => {
              setForm({ ...form, type: value as StatisticsServiceType });
              setConnectionVerified(false);
            }}
            disabled={!!service}
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input w-full"
            placeholder={`My ${statisticsServiceOptions.find(o => o.value === form.type)?.label}`}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => {
              setForm({ ...form, url: e.target.value });
              setConnectionVerified(false);
            }}
            className="input w-full"
            placeholder={form.type === 'jellystat' ? 'http://localhost:3000' : 'http://localhost:8181'}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">
            API Key {service && '(leave blank to keep current)'}
          </label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => {
              setForm({ ...form, apiKey: e.target.value });
              setConnectionVerified(false);
            }}
            className="input w-full"
            placeholder={service ? '••••••••' : 'Enter API key'}
            required={!service}
          />
          {form.type === 'jellystat' && (
            <p className="text-xs text-gray-500 mt-1">
              Find your API key in Jellystat Settings → Security → API Keys
            </p>
          )}
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

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
          {service && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Are you sure you want to delete this service?')) {
                  onDelete(service.id);
                  onClose();
                }
              }}
              className="btn btn-danger mr-auto"
            >
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          {!service && !connectionVerified ? (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !form.url || !form.apiKey}
              className="btn btn-primary"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          ) : (
            <button 
              type="submit" 
              disabled={saving} 
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}


// Reusable setting row component
interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <label className="font-medium">{label}</label>
        <p className="text-sm text-gray-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

// Toggle switch component
interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'toggle-switch-accent' : 'bg-gray-600'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// Custom select component with icons
interface IconSelectOption {
  value: string;
  label: string;
}

interface IconSelectProps {
  options: IconSelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

function IconSelect({ options, value, onChange, disabled }: IconSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`input w-full flex items-center gap-2 text-left ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
      >
        <ServiceLogo type={value} size={20} />
        <span className="flex-1">{selectedOption?.label || value}</span>
        <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute z-20 w-full mt-1 card border rounded-lg shadow-lg max-h-60 overflow-auto">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-tertiary transition-colors ${
                  option.value === value ? 'bg-tertiary' : ''
                }`}
              >
                <ServiceLogo type={option.value} size={20} />
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const notificationServiceOptions: { value: NotificationServiceType; label: string }[] = [
  { value: 'discord', label: 'Discord' },
  { value: 'email', label: 'Email (SMTP)' },
  { value: 'slack', label: 'Slack' },
  { value: 'telegram', label: 'Telegram' },
  { value: 'pushover', label: 'Pushover' },
  { value: 'gotify', label: 'Gotify' },
];

function NotificationsSection() {
  const [loading, setLoading] = useState(true);

  // Trigger settings state
  const [triggerSettings, setTriggerSettings] = useState({
    onCleanupComplete: true,
    onError: true,
    onItemDeleted: false,
    weeklySummary: false,
    testNotifications: true,
  });
  const [triggerOriginal, setTriggerOriginal] = useState(triggerSettings);
  const [triggerSaving, setTriggerSaving] = useState(false);

  // Notification services state
  const [services, setServices] = useState<NotificationService[]>([]);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingService, setEditingService] = useState<NotificationService | null>(null);

  // Load data on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load trigger settings
        const settingsResponse = await settings.getGroup('notifications');
        const data = settingsResponse.data;
        const triggers = {
          onCleanupComplete: data['notifications.triggers.onCleanupComplete'] !== 'false',
          onError: data['notifications.triggers.onError'] !== 'false',
          onItemDeleted: data['notifications.triggers.onItemDeleted'] === 'true',
          weeklySummary: data['notifications.triggers.weeklySummary'] === 'true',
          testNotifications: data['notifications.triggers.testNotifications'] !== 'false',
        };
        setTriggerSettings(triggers);
        setTriggerOriginal(triggers);

        // Load notification services
        const servicesResponse = await notifications.list();
        setServices(servicesResponse.data);
      } catch (error) {
        console.error('Failed to load notification settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Check for unsaved changes
  const triggerHasChanges = JSON.stringify(triggerSettings) !== JSON.stringify(triggerOriginal);

  const saveTriggerSettings = async () => {
    setTriggerSaving(true);
    try {
      await settings.setBulk({
        'notifications.triggers.onCleanupComplete': String(triggerSettings.onCleanupComplete),
        'notifications.triggers.onError': String(triggerSettings.onError),
        'notifications.triggers.onItemDeleted': String(triggerSettings.onItemDeleted),
        'notifications.triggers.weeklySummary': String(triggerSettings.weeklySummary),
        'notifications.triggers.testNotifications': String(triggerSettings.testNotifications),
      });
      setTriggerOriginal(triggerSettings);
    } catch (error) {
      console.error('Failed to save trigger settings:', error);
    } finally {
      setTriggerSaving(false);
    }
  };

  const handleDeleteService = async (id: number) => {
    if (!confirm('Are you sure you want to delete this notification service?')) return;
    try {
      await notifications.delete(id);
      setServices(services.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete notification service:', error);
    }
  };

  const handleTestService = async (id: number) => {
    try {
      const result = await notifications.test(id);
      if (result.data.success) {
        alert('Test notification sent successfully!');
      } else {
        alert(`Test failed: ${result.data.message}`);
      }
    } catch (error: any) {
      alert(`Test failed: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleServiceSaved = async (service: NotificationService) => {
    // Refresh the services list
    try {
      const response = await notifications.list();
      setServices(response.data);
    } catch (error) {
      console.error('Failed to refresh services:', error);
    }
    setShowServiceModal(false);
    setEditingService(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Notifications</h2>
        <p className="text-sm text-gray-400 mt-1">
          Configure how and when you receive notifications.
        </p>
      </div>

      {/* Notification Triggers */}
      <div className="card">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-medium">Notification Triggers</h3>
          {triggerHasChanges && (
            <span className="text-xs text-yellow-400">Unsaved changes</span>
          )}
        </div>
        <div className="p-4 space-y-4">
          <SettingRow
            label="On Cleanup Complete"
            description="Notify when a cleanup task finishes successfully"
          >
            <ToggleSwitch
              checked={triggerSettings.onCleanupComplete}
              onChange={(checked) => setTriggerSettings({ ...triggerSettings, onCleanupComplete: checked })}
            />
          </SettingRow>

          <SettingRow
            label="On Error"
            description="Notify when a cleanup task fails or encounters errors"
          >
            <ToggleSwitch
              checked={triggerSettings.onError}
              onChange={(checked) => setTriggerSettings({ ...triggerSettings, onError: checked })}
            />
          </SettingRow>

          <SettingRow
            label="On Item Deleted"
            description="Notify for each individual item that gets deleted"
          >
            <ToggleSwitch
              checked={triggerSettings.onItemDeleted}
              onChange={(checked) => setTriggerSettings({ ...triggerSettings, onItemDeleted: checked })}
            />
          </SettingRow>

          <SettingRow
            label="Weekly Summary"
            description="Send a weekly summary of cleanup activities"
          >
            <ToggleSwitch
              checked={triggerSettings.weeklySummary}
              onChange={(checked) => setTriggerSettings({ ...triggerSettings, weeklySummary: checked })}
            />
          </SettingRow>

          <SettingRow
            label="Include Test Notifications"
            description="Send notifications when testing connections"
          >
            <ToggleSwitch
              checked={triggerSettings.testNotifications}
              onChange={(checked) => setTriggerSettings({ ...triggerSettings, testNotifications: checked })}
            />
          </SettingRow>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={saveTriggerSettings}
            disabled={!triggerHasChanges || triggerSaving}
            className="btn btn-primary"
          >
            {triggerSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Notification Services */}
      <div className="card">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-medium">Notification Services</h3>
          <button
            onClick={() => {
              setEditingService(null);
              setShowServiceModal(true);
            }}
            className="btn btn-primary text-sm"
          >
            + Add Connection
          </button>
        </div>

        {services.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">🔔</div>
            <h3 className="text-lg font-medium mb-2">No Notification Services</h3>
            <p className="text-gray-400 mb-4">
              Add Discord, Email, Slack, or other notification services.
            </p>
            <button
              onClick={() => {
                setEditingService(null);
                setShowServiceModal(true);
              }}
              className="btn btn-primary"
            >
              + Add Connection
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {services.map((service) => (
              <NotificationServiceCard
                key={service.id}
                service={service}
                onEdit={() => {
                  setEditingService(service);
                  setShowServiceModal(true);
                }}
                onDelete={() => handleDeleteService(service.id)}
                onTest={() => handleTestService(service.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Service Modal */}
      {showServiceModal && (
        <NotificationServiceModal
          service={editingService}
          onClose={() => {
            setShowServiceModal(false);
            setEditingService(null);
          }}
          onSaved={handleServiceSaved}
        />
      )}
    </div>
  );
}

interface NotificationServiceCardProps {
  service: NotificationService;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}

function NotificationServiceCard({ service, onEdit, onDelete, onTest }: NotificationServiceCardProps) {
  const [testing, setTesting] = useState(false);
  const serviceOption = notificationServiceOptions.find(o => o.value === service.type);

  const handleTest = async () => {
    setTesting(true);
    try {
      await onTest();
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-4 bg-gray-750 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-700 rounded-lg flex items-center justify-center">
            <ServiceLogo type={service.type} size={28} />
          </div>
          <div>
            <h4 className="font-medium">{service.name}</h4>
            <p className="text-sm text-gray-400">{serviceOption?.label || service.type}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="btn btn-secondary text-sm"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button onClick={onEdit} className="btn btn-secondary text-sm">
            Edit
          </button>
          <button onClick={onDelete} className="btn btn-danger text-sm">
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

interface NotificationServiceModalProps {
  service: NotificationService | null;
  onClose: () => void;
  onSaved: (service: NotificationService) => void;
}

function NotificationServiceModal({ service, onClose, onSaved }: NotificationServiceModalProps) {
  const [form, setForm] = useState({
    name: service?.name || '',
    type: service?.type || 'discord' as NotificationServiceType,
    enabled: service?.isEnabled ?? true,
    webhookUrl: service?.config?.webhookUrl || '',
    // Email fields
    smtpHost: service?.config?.smtpHost || '',
    smtpPort: service?.config?.smtpPort || '587',
    smtpUser: service?.config?.smtpUser || '',
    smtpPassword: service?.config?.smtpPassword || '',
    fromAddress: service?.config?.fromAddress || '',
    toAddress: service?.config?.toAddress || '',
    // Telegram fields
    botToken: service?.config?.botToken || '',
    chatId: service?.config?.chatId || '',
    // Gotify fields
    serverUrl: service?.config?.serverUrl || '',
    appToken: service?.config?.appToken || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      // Build config based on type
      let config: Record<string, string> = {};
      switch (form.type) {
        case 'discord':
        case 'slack':
          config = { webhookUrl: form.webhookUrl };
          break;
        case 'email':
          config = {
            smtpHost: form.smtpHost,
            smtpPort: form.smtpPort,
            smtpUser: form.smtpUser,
            smtpPassword: form.smtpPassword,
            fromAddress: form.fromAddress,
            toAddress: form.toAddress,
          };
          break;
        case 'telegram':
          config = { botToken: form.botToken, chatId: form.chatId };
          break;
        case 'gotify':
        case 'pushover':
          config = { serverUrl: form.serverUrl, appToken: form.appToken };
          break;
      }

      let savedService: NotificationService;
      if (service) {
        // Update existing
        const response = await notifications.update(service.id, {
          name: form.name,
          type: form.type,
          isEnabled: form.enabled,
          config,
        });
        savedService = response.data;
      } else {
        // Create new
        const response = await notifications.create({
          name: form.name,
          type: form.type,
          isEnabled: form.enabled,
          config,
        });
        savedService = response.data;
      }
      onSaved(savedService);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const renderTypeSpecificFields = () => {
    switch (form.type) {
      case 'discord':
      case 'slack':
        return (
          <div>
            <label className="block text-sm font-medium form-label mb-1">Webhook URL</label>
            <input
              type="url"
              value={form.webhookUrl}
              onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
              className="input w-full"
              placeholder={form.type === 'discord' ? 'https://discord.com/api/webhooks/...' : 'https://hooks.slack.com/...'}
              required
            />
          </div>
        );
      case 'email':
        return (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium form-label mb-1">SMTP Host</label>
                <input
                  type="text"
                  value={form.smtpHost}
                  onChange={(e) => setForm({ ...form, smtpHost: e.target.value })}
                  className="input w-full"
                  placeholder="smtp.gmail.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium form-label mb-1">SMTP Port</label>
                <input
                  type="text"
                  value={form.smtpPort}
                  onChange={(e) => setForm({ ...form, smtpPort: e.target.value })}
                  className="input w-full"
                  placeholder="587"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium form-label mb-1">Username</label>
                <input
                  type="text"
                  value={form.smtpUser}
                  onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
                  className="input w-full"
                  placeholder="user@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium form-label mb-1">Password</label>
                <input
                  type="password"
                  value={form.smtpPassword}
                  onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                  className="input w-full"
                  placeholder="••••••••"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium form-label mb-1">From Address</label>
                <input
                  type="email"
                  value={form.fromAddress}
                  onChange={(e) => setForm({ ...form, fromAddress: e.target.value })}
                  className="input w-full"
                  placeholder="sweeparr@example.com"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium form-label mb-1">To Address</label>
                <input
                  type="email"
                  value={form.toAddress}
                  onChange={(e) => setForm({ ...form, toAddress: e.target.value })}
                  className="input w-full"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
          </>
        );
      case 'telegram':
        return (
          <>
            <div>
              <label className="block text-sm font-medium form-label mb-1">Bot Token</label>
              <input
                type="password"
                value={form.botToken}
                onChange={(e) => setForm({ ...form, botToken: e.target.value })}
                className="input w-full"
                placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium form-label mb-1">Chat ID</label>
              <input
                type="text"
                value={form.chatId}
                onChange={(e) => setForm({ ...form, chatId: e.target.value })}
                className="input w-full"
                placeholder="-1001234567890"
                required
              />
            </div>
          </>
        );
      case 'gotify':
      case 'pushover':
        return (
          <>
            <div>
              <label className="block text-sm font-medium form-label mb-1">Server URL</label>
              <input
                type="url"
                value={form.serverUrl}
                onChange={(e) => setForm({ ...form, serverUrl: e.target.value })}
                className="input w-full"
                placeholder={form.type === 'gotify' ? 'https://gotify.example.com' : 'https://api.pushover.net'}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium form-label mb-1">App Token</label>
              <input
                type="password"
                value={form.appToken}
                onChange={(e) => setForm({ ...form, appToken: e.target.value })}
                className="input w-full"
                placeholder="Enter app token"
                required
              />
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Modal onClose={onClose} title={service ? 'Edit Notification Service' : 'Add Notification Service'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium form-label mb-1">Type</label>
          <IconSelect
            options={notificationServiceOptions}
            value={form.type}
            onChange={(value) => setForm({ ...form, type: value as NotificationServiceType })}
            disabled={!!service}
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input w-full"
            placeholder={`My ${notificationServiceOptions.find(o => o.value === form.type)?.label}`}
            required
          />
        </div>

        {renderTypeSpecificFields()}

        <div className="flex items-center gap-2">
          <ToggleSwitch
            checked={form.enabled}
            onChange={(checked) => setForm({ ...form, enabled: checked })}
          />
          <label className="text-sm form-label">Enabled</label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn btn-primary">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function GeneralSection() {
  const [loading, setLoading] = useState(true);
  const [appSaving, setAppSaving] = useState(false);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [backupSaving, setBackupSaving] = useState(false);
  const [regeneratingKey, setRegeneratingKey] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  
  // Media paths state
  const [mediaPathsLoading, setMediaPathsLoading] = useState(true);
  const [mediaPaths, setMediaPaths] = useState<Array<{ id: number; path: string; label: string | null; mediaType: string | null }>>([]);
  const [newPath, setNewPath] = useState('');
  const [addingPath, setAddingPath] = useState(false);
  const [showFileBrowser, setShowFileBrowser] = useState(false);

  // Application settings
  const [appSettings, setAppSettings] = useState({
    instanceName: 'Sweeparr',
    urlBase: '',
    logLevel: 'info',
  });
  const [appOriginal, setAppOriginal] = useState(appSettings);

  // Security settings
  const [securitySettings, setSecuritySettings] = useState({
    authentication: 'none',
    username: '',
    password: '',
    apiKey: '',
  });
  const [securityOriginal, setSecurityOriginal] = useState(securitySettings);

  // Backup settings
  const [backupSettings, setBackupSettings] = useState({
    folder: 'Backups',
    interval: 7,
    retention: 28,
  });
  const [backupOriginal, setBackupOriginal] = useState(backupSettings);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settings.getGroup('general');
        const data = response.data;

        const app = {
          instanceName: data['general.instanceName'] || 'Sweeparr',
          urlBase: data['general.urlBase'] || '',
          logLevel: data['general.logLevel'] || 'info',
        };
        setAppSettings(app);
        setAppOriginal(app);

        const security = {
          authentication: data['general.authentication'] || 'none',
          username: data['general.username'] || '',
          password: '', // Don't load password for security
          apiKey: data['general.apiKey'] || '',
        };
        setSecuritySettings(security);
        setSecurityOriginal({ ...security, password: '' });

        // If no API key exists, generate one and save it
        if (!security.apiKey) {
          const newKey = generateApiKey();
          await settings.set('general.apiKey', newKey);
          security.apiKey = newKey;
          setSecuritySettings(security);
          setSecurityOriginal({ ...security, password: '' });
        }

        const backup = {
          folder: data['general.backup.folder'] || 'Backups',
          interval: parseInt(data['general.backup.interval']) || 7,
          retention: parseInt(data['general.backup.retention']) || 28,
        };
        setBackupSettings(backup);
        setBackupOriginal(backup);
      } catch (error) {
        console.error('Failed to load general settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Load media paths
  useEffect(() => {
    const loadMediaPaths = async () => {
      try {
        const { mediaPaths: mediaPathsApi } = await import('../api');
        const response = await mediaPathsApi.list();
        setMediaPaths(response.data || []);
      } catch (error) {
        console.error('Failed to load media paths:', error);
      } finally {
        setMediaPathsLoading(false);
      }
    };
    loadMediaPaths();
  }, []);

  // Media paths handlers
  const addMediaPath = async () => {
    if (!newPath.trim()) return;
    setAddingPath(true);
    try {
      const { mediaPaths: mediaPathsApi } = await import('../api');
      const response = await mediaPathsApi.create({ path: newPath.trim() });
      setMediaPaths([...mediaPaths, response.data]);
      setNewPath('');
    } catch (error: any) {
      console.error('Failed to add media path:', error);
      alert(error?.message || 'Failed to add path');
    } finally {
      setAddingPath(false);
    }
  };

  const removeMediaPath = async (id: number) => {
    if (!confirm('Are you sure you want to remove this path?')) return;
    try {
      const { mediaPaths: mediaPathsApi } = await import('../api');
      await mediaPathsApi.delete(id);
      setMediaPaths(mediaPaths.filter(p => p.id !== id));
    } catch (error) {
      console.error('Failed to remove media path:', error);
    }
  };

  // Generate random API key
  function generateApiKey() {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  }

  // Check for unsaved changes
  const appHasChanges = JSON.stringify(appSettings) !== JSON.stringify(appOriginal);
  const securityHasChanges = 
    securitySettings.authentication !== securityOriginal.authentication ||
    securitySettings.username !== securityOriginal.username ||
    securitySettings.password !== '';
  const backupHasChanges = JSON.stringify(backupSettings) !== JSON.stringify(backupOriginal);

  // Save handlers
  const saveAppSettings = async () => {
    setAppSaving(true);
    try {
      await settings.setBulk({
        'general.instanceName': appSettings.instanceName,
        'general.urlBase': appSettings.urlBase,
        'general.logLevel': appSettings.logLevel,
      });
      setAppOriginal(appSettings);
    } catch (error) {
      console.error('Failed to save app settings:', error);
    } finally {
      setAppSaving(false);
    }
  };

  const saveSecuritySettings = async () => {
    setSecuritySaving(true);
    try {
      const toSave: Record<string, string> = {
        'general.authentication': securitySettings.authentication,
        'general.username': securitySettings.username,
      };
      if (securitySettings.password) {
        toSave['general.password'] = securitySettings.password;
      }
      await settings.setBulk(toSave);
      setSecurityOriginal({ ...securitySettings, password: '' });
      setSecuritySettings({ ...securitySettings, password: '' });
    } catch (error) {
      console.error('Failed to save security settings:', error);
    } finally {
      setSecuritySaving(false);
    }
  };

  const saveBackupSettings = async () => {
    setBackupSaving(true);
    try {
      await settings.setBulk({
        'general.backup.folder': backupSettings.folder,
        'general.backup.interval': String(backupSettings.interval),
        'general.backup.retention': String(backupSettings.retention),
      });
      setBackupOriginal(backupSettings);
    } catch (error) {
      console.error('Failed to save backup settings:', error);
    } finally {
      setBackupSaving(false);
    }
  };

  const regenerateApiKey = async () => {
    if (!confirm('Are you sure you want to regenerate the API key? Any existing integrations will stop working.')) {
      return;
    }
    setRegeneratingKey(true);
    try {
      const newKey = generateApiKey();
      await settings.set('general.apiKey', newKey);
      setSecuritySettings({ ...securitySettings, apiKey: newKey });
      setSecurityOriginal({ ...securityOriginal, apiKey: newKey });
    } catch (error) {
      console.error('Failed to regenerate API key:', error);
    } finally {
      setRegeneratingKey(false);
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(securitySettings.apiKey);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">General</h2>
        <p className="text-sm text-gray-400 mt-1">
          General application settings.
        </p>
      </div>

      {/* Application Settings */}
      <div className="card">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-medium">Application</h3>
          {appHasChanges && (
            <span className="text-xs text-yellow-400">Unsaved changes</span>
          )}
        </div>
        <div className="p-4 space-y-4">
          <SettingRow
            label="Instance Name"
            description="Name shown in the UI and notifications"
          >
            <input
              type="text"
              className="input w-48"
              value={appSettings.instanceName}
              onChange={(e) => setAppSettings({ ...appSettings, instanceName: e.target.value })}
              placeholder="Sweeparr"
            />
          </SettingRow>

          <SettingRow
            label="URL Base"
            description="For reverse proxy support, default is empty"
          >
            <input
              type="text"
              className="input w-48"
              value={appSettings.urlBase}
              onChange={(e) => setAppSettings({ ...appSettings, urlBase: e.target.value })}
              placeholder="/sweeparr"
            />
          </SettingRow>

          <SettingRow
            label="Log Level"
            description="Amount of logging detail"
          >
            <select
              className="input w-48"
              value={appSettings.logLevel}
              onChange={(e) => setAppSettings({ ...appSettings, logLevel: e.target.value })}
            >
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info">Info</option>
              <option value="debug">Debug</option>
              <option value="trace">Trace</option>
            </select>
          </SettingRow>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={saveAppSettings}
            disabled={!appHasChanges || appSaving}
            className="btn btn-primary"
          >
            {appSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Media Paths */}
      <div className="card">
        <div className="p-4 border-b border-gray-700">
          <h3 className="font-medium">Media Paths</h3>
          <p className="text-sm text-gray-400 mt-1">
            Paths where Sweeparr can access your media files.
          </p>
        </div>
        <div className="p-4">
          {mediaPathsLoading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <LoadingSpinner size="sm" /> Loading...
            </div>
          ) : (
            <div className="space-y-3">
              {mediaPaths.length === 0 ? (
                <p className="text-gray-500 text-sm">No media paths configured.</p>
              ) : (
                mediaPaths.map((mp) => (
                  <div
                    key={mp.id}
                    className="flex items-center justify-between p-3 bg-tertiary rounded-lg"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span className="font-mono text-sm truncate">{mp.path}</span>
                    </div>
                    <button
                      onClick={() => removeMediaPath(mp.id)}
                      className="btn btn-danger text-sm px-2 py-1 flex-shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))
              )}
              
              <div className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  placeholder="/mnt/media-library/movies"
                  className="input flex-1 font-mono text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addMediaPath();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowFileBrowser(true)}
                  className="btn btn-secondary px-3"
                  title="Browse"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                </button>
                <button
                  onClick={addMediaPath}
                  disabled={!newPath.trim() || addingPath}
                  className="btn btn-primary"
                >
                  {addingPath ? 'Adding...' : 'Add'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* File Browser for Media Paths */}
      <FileBrowser
        isOpen={showFileBrowser}
        onClose={() => setShowFileBrowser(false)}
        onSelect={(path) => {
          setNewPath(path);
          setShowFileBrowser(false);
        }}
        initialPath={newPath || '/mnt'}
        title="Select Media Path"
      />

      {/* Security Settings */}
      <div className="card">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-medium">Security</h3>
          {securityHasChanges && (
            <span className="text-xs text-yellow-400">Unsaved changes</span>
          )}
        </div>
        <div className="p-4 space-y-4">
          <SettingRow
            label="Authentication"
            description="Require login to access Sweeparr"
          >
            <select
              className="input w-48"
              value={securitySettings.authentication}
              onChange={(e) => setSecuritySettings({ ...securitySettings, authentication: e.target.value })}
            >
              <option value="forms">Forms (Web Native)</option>
              <option value="basic">Basic (Browser)</option>
              <option value="none">None</option>
            </select>
          </SettingRow>

          {securitySettings.authentication !== 'none' && (
            <>
              <SettingRow
                label="Username"
                description="Username for authentication"
              >
                <input
                  type="text"
                  className="input w-48"
                  value={securitySettings.username}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, username: e.target.value })}
                  placeholder="admin"
                />
              </SettingRow>

              <SettingRow
                label="Password"
                description="Password for authentication"
              >
                <input
                  type="password"
                  className="input w-48"
                  value={securitySettings.password}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, password: e.target.value })}
                  placeholder="••••••••"
                />
              </SettingRow>
            </>
          )}

          <SettingRow
            label="API Key"
            description="Key for external API access"
          >
            <div className="flex gap-2">
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  className="input w-64 pr-10 font-mono text-sm"
                  value={securitySettings.apiKey}
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showApiKey ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <button
                onClick={copyApiKey}
                className="btn btn-secondary text-sm"
                title="Copy to clipboard"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={regenerateApiKey}
                disabled={regeneratingKey}
                className="btn btn-secondary text-sm"
                title="Regenerate API key"
              >
                <svg className={`w-4 h-4 ${regeneratingKey ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </SettingRow>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={saveSecuritySettings}
            disabled={!securityHasChanges || securitySaving}
            className="btn btn-primary"
          >
            {securitySaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Backup Settings */}
      <div className="card">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-medium">Backups</h3>
          {backupHasChanges && (
            <span className="text-xs text-yellow-400">Unsaved changes</span>
          )}
        </div>
        <div className="p-4 space-y-4">
          <SettingRow
            label="Folder"
            description="Backup folder path relative to config directory"
          >
            <input
              type="text"
              className="input w-48"
              value={backupSettings.folder}
              onChange={(e) => setBackupSettings({ ...backupSettings, folder: e.target.value })}
              placeholder="Backups"
            />
          </SettingRow>

          <SettingRow
            label="Interval"
            description="Days between automatic backups"
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input w-20"
                value={backupSettings.interval}
                onChange={(e) => setBackupSettings({ ...backupSettings, interval: parseInt(e.target.value) || 1 })}
                min={1}
                max={30}
              />
              <span className="text-gray-400">days</span>
            </div>
          </SettingRow>

          <SettingRow
            label="Retention"
            description="Days to keep automatic backups"
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="input w-20"
                value={backupSettings.retention}
                onChange={(e) => setBackupSettings({ ...backupSettings, retention: parseInt(e.target.value) || 1 })}
                min={1}
                max={365}
              />
              <span className="text-gray-400">days</span>
            </div>
          </SettingRow>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={saveBackupSettings}
            disabled={!backupHasChanges || backupSaving}
            className="btn btn-primary"
          >
            {backupSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UISection() {
  const { updateSettings, refreshSettings } = useUI();
  const [loading, setLoading] = useState(true);
  const [appearanceSaving, setAppearanceSaving] = useState(false);
  const [dateTimeSaving, setDateTimeSaving] = useState(false);
  const [tableSaving, setTableSaving] = useState(false);

  // Appearance settings
  const [appearanceSettings, setAppearanceSettings] = useState({
    theme: 'auto',
    enableAnimations: true,
  });
  const [appearanceOriginal, setAppearanceOriginal] = useState(appearanceSettings);

  // Date & Time settings
  const [dateTimeSettings, setDateTimeSettings] = useState({
    dateFormat: 'MM/DD/YYYY',
    timeFormat: '12h',
    timezone: 'auto',
  });
  const [dateTimeOriginal, setDateTimeOriginal] = useState(dateTimeSettings);

  // Table settings
  const [tableSettings, setTableSettings] = useState({
    pageSize: 25,
    showPosters: true,
    expandedByDefault: false,
  });
  const [tableOriginal, setTableOriginal] = useState(tableSettings);

  // Load settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await settings.getGroup('ui');
        const data = response.data;

        const appearance = {
          theme: data['ui.theme'] || 'auto',
          enableAnimations: data['ui.enableAnimations'] !== 'false',
        };
        setAppearanceSettings(appearance);
        setAppearanceOriginal(appearance);

        const dateTime = {
          dateFormat: data['ui.dateFormat'] || 'MM/DD/YYYY',
          timeFormat: data['ui.timeFormat'] || '12h',
          timezone: data['ui.timezone'] || 'auto',
        };
        setDateTimeSettings(dateTime);
        setDateTimeOriginal(dateTime);

        const table = {
          pageSize: parseInt(data['ui.pageSize']) || 25,
          showPosters: data['ui.showPosters'] !== 'false',
          expandedByDefault: data['ui.expandedByDefault'] === 'true',
        };
        setTableSettings(table);
        setTableOriginal(table);
      } catch (error) {
        console.error('Failed to load UI settings:', error);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Check for unsaved changes
  const appearanceHasChanges = JSON.stringify(appearanceSettings) !== JSON.stringify(appearanceOriginal);
  const dateTimeHasChanges = JSON.stringify(dateTimeSettings) !== JSON.stringify(dateTimeOriginal);
  const tableHasChanges = JSON.stringify(tableSettings) !== JSON.stringify(tableOriginal);

  // Save handlers
  const saveAppearanceSettings = async () => {
    setAppearanceSaving(true);
    try {
      await settings.setBulk({
        'ui.theme': appearanceSettings.theme,
        'ui.enableAnimations': String(appearanceSettings.enableAnimations),
      });
      setAppearanceOriginal(appearanceSettings);
      // Update context to apply theme changes immediately
      updateSettings({
        theme: appearanceSettings.theme as 'dark' | 'light' | 'auto',
        enableAnimations: appearanceSettings.enableAnimations,
      });
    } catch (error) {
      console.error('Failed to save appearance settings:', error);
    } finally {
      setAppearanceSaving(false);
    }
  };

  const saveDateTimeSettings = async () => {
    setDateTimeSaving(true);
    try {
      await settings.setBulk({
        'ui.dateFormat': dateTimeSettings.dateFormat,
        'ui.timeFormat': dateTimeSettings.timeFormat,
        'ui.timezone': dateTimeSettings.timezone,
      });
      setDateTimeOriginal(dateTimeSettings);
      // Update context
      updateSettings({
        dateFormat: dateTimeSettings.dateFormat,
        timeFormat: dateTimeSettings.timeFormat as '12h' | '24h',
        timezone: dateTimeSettings.timezone,
      });
    } catch (error) {
      console.error('Failed to save date/time settings:', error);
    } finally {
      setDateTimeSaving(false);
    }
  };

  const saveTableSettings = async () => {
    setTableSaving(true);
    try {
      await settings.setBulk({
        'ui.pageSize': String(tableSettings.pageSize),
        'ui.showPosters': String(tableSettings.showPosters),
        'ui.expandedByDefault': String(tableSettings.expandedByDefault),
      });
      setTableOriginal(tableSettings);
      // Update context
      updateSettings({
        pageSize: tableSettings.pageSize,
        showPosters: tableSettings.showPosters,
        expandedByDefault: tableSettings.expandedByDefault,
      });
    } catch (error) {
      console.error('Failed to save table settings:', error);
    } finally {
      setTableSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">UI</h2>
        <p className="text-sm text-gray-400 mt-1">
          Customize the user interface appearance.
        </p>
      </div>

      {/* Appearance Settings */}
      <div className="card">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-medium">Appearance</h3>
          {appearanceHasChanges && (
            <span className="text-xs text-yellow-400">Unsaved changes</span>
          )}
        </div>
        <div className="p-4 space-y-4">
          <SettingRow
            label="Theme"
            description="Color scheme for the interface"
          >
            <select
              className="input w-48"
              value={appearanceSettings.theme}
              onChange={(e) => setAppearanceSettings({ ...appearanceSettings, theme: e.target.value })}
            >
              <option value="dark">Dark</option>
              <option value="light">Light</option>
              <option value="auto">System</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Enable Animations"
            description="Show UI transition animations"
          >
            <ToggleSwitch
              checked={appearanceSettings.enableAnimations}
              onChange={(checked) => setAppearanceSettings({ ...appearanceSettings, enableAnimations: checked })}
            />
          </SettingRow>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={saveAppearanceSettings}
            disabled={!appearanceHasChanges || appearanceSaving}
            className="btn btn-primary"
          >
            {appearanceSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Date & Time Settings */}
      <div className="card">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-medium">Date & Time</h3>
          {dateTimeHasChanges && (
            <span className="text-xs text-yellow-400">Unsaved changes</span>
          )}
        </div>
        <div className="p-4 space-y-4">
          <SettingRow
            label="Date Format"
            description="How dates are displayed throughout the app"
          >
            <select
              className="input w-48"
              value={dateTimeSettings.dateFormat}
              onChange={(e) => setDateTimeSettings({ ...dateTimeSettings, dateFormat: e.target.value })}
            >
              <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              <option value="DD/MM/YYYY">DD/MM/YYYY</option>
              <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              <option value="DD MMM YYYY">DD MMM YYYY</option>
              <option value="MMM DD, YYYY">MMM DD, YYYY</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Time Format"
            description="12 or 24 hour time display"
          >
            <select
              className="input w-48"
              value={dateTimeSettings.timeFormat}
              onChange={(e) => setDateTimeSettings({ ...dateTimeSettings, timeFormat: e.target.value })}
            >
              <option value="12h">12 Hour (1:30 PM)</option>
              <option value="24h">24 Hour (13:30)</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Timezone"
            description="Timezone for displaying times"
          >
            <select
              className="input w-48"
              value={dateTimeSettings.timezone}
              onChange={(e) => setDateTimeSettings({ ...dateTimeSettings, timezone: e.target.value })}
            >
              <option value="auto">Auto (Browser)</option>
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </select>
          </SettingRow>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={saveDateTimeSettings}
            disabled={!dateTimeHasChanges || dateTimeSaving}
            className="btn btn-primary"
          >
            {dateTimeSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Table Settings */}
      <div className="card">
        <div className="p-4 border-b border-gray-700 flex items-center justify-between">
          <h3 className="font-medium">Tables & Lists</h3>
          {tableHasChanges && (
            <span className="text-xs text-yellow-400">Unsaved changes</span>
          )}
        </div>
        <div className="p-4 space-y-4">
          <SettingRow
            label="Page Size"
            description="Number of items to show per page"
          >
            <select
              className="input w-48"
              value={tableSettings.pageSize}
              onChange={(e) => setTableSettings({ ...tableSettings, pageSize: parseInt(e.target.value) })}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </SettingRow>

          <SettingRow
            label="Show Poster Images"
            description="Display media posters in lists and tables"
          >
            <ToggleSwitch
              checked={tableSettings.showPosters}
              onChange={(checked) => setTableSettings({ ...tableSettings, showPosters: checked })}
            />
          </SettingRow>

          <SettingRow
            label="Expand Details by Default"
            description="Automatically expand item details in lists"
          >
            <ToggleSwitch
              checked={tableSettings.expandedByDefault}
              onChange={(checked) => setTableSettings({ ...tableSettings, expandedByDefault: checked })}
            />
          </SettingRow>
        </div>
        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={saveTableSettings}
            disabled={!tableHasChanges || tableSaving}
            className="btn btn-primary"
          >
            {tableSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Shared Components
// ============================================================================

interface ConnectionCardProps {
  name: string;
  type: string;
  url: string;
  enabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => Promise<{ data: ConnectionTestResult }>;
}

function ConnectionCard({
  name,
  type,
  url,
  enabled,
  onEdit,
  onDelete,
  onTest,
}: ConnectionCardProps) {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await onTest();
      setTestResult(result.data);
    } catch (error) {
      setTestResult({ connected: false, message: 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ServiceLogo type={type} size={36} />
          <div>
            <h3 className="font-medium">{name}</h3>
            <p className="text-sm text-gray-400">
              <span className="capitalize">{type}</span> • {url}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="btn btn-secondary text-sm"
          >
            {testing ? 'Testing...' : 'Test'}
          </button>
          <button onClick={onEdit} className="btn btn-secondary text-sm">
            Edit
          </button>
          <button onClick={onDelete} className="btn btn-danger text-sm">
            Delete
          </button>
        </div>
      </div>
      {testResult && (
        <div
          className={`mt-3 p-3 rounded text-sm ${
            testResult.connected
              ? 'bg-green-900/50 text-green-300'
              : 'bg-red-900/50 text-red-300'
          }`}
        >
          {testResult.connected ? '✓ ' : '✗ '}
          {testResult.message}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Modal Components
// ============================================================================

interface MediaServerModalProps {
  server: MediaServer | null;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: number) => void;
}

function MediaServerModal({ server, onClose, onSaved, onDelete }: MediaServerModalProps) {
  const [form, setForm] = useState({
    name: server?.name || '',
    type: server?.type || 'jellyfin',
    url: server?.url || '',
    apiKey: server?.apiKey || '',
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [connectionVerified, setConnectionVerified] = useState(!!server);
  
  // Path mappings state
  const [showPathMappings, setShowPathMappings] = useState(false);
  const [pathMappings, setPathMappings] = useState<Array<{ localPath: string; remotePath: string; customPath?: boolean }>>([]);
  const [pathMappingsLoading, setPathMappingsLoading] = useState(false);
  const [browsingIndex, setBrowsingIndex] = useState<number | null>(null);

  // Load path mappings when editing an existing server
  useEffect(() => {
    if (server?.id) {
      const loadMappings = async () => {
        setPathMappingsLoading(true);
        try {
          const { get } = await import('../api/client');
          const response = await get<{ success: boolean; data: Array<any> }>(`/path-mappings/media-server/${server.id}`);
          const normalized = (response.data || []).map((m: any) => ({
            localPath: m.localPath || '',
            remotePath: m.mediaServerPath || m.localPath || '',
            customPath: m.localPath !== (m.mediaServerPath || m.localPath),
          }));
          setPathMappings(normalized);
        } catch (error) {
          console.error('Failed to load path mappings:', error);
        } finally {
          setPathMappingsLoading(false);
        }
      };
      loadMappings();
    }
  }, [server?.id]);

  // Reset verification when connection details change
  useEffect(() => {
    if (!server) {
      setConnectionVerified(false);
      setTestResult(null);
    }
  }, [form.url, form.apiKey, form.type]);

  const handleTest = async () => {
    if (!form.url || !form.apiKey) {
      setError('URL and API Key are required to test');
      return;
    }
    
    setTesting(true);
    setError(null);
    setTestResult(null);
    
    try {
      const result = await mediaServers.testConnection({
        type: form.type,
        url: form.url,
        apiKey: form.apiKey,
      });
      setTestResult(result.data);
      setConnectionVerified(result.data.connected);
    } catch (err: any) {
      setTestResult({ connected: false, message: err?.message || 'Test failed' });
      setConnectionVerified(false);
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!connectionVerified && !server) {
      setError('Please test the connection before saving');
      return;
    }
    
    setSaving(true);
    setError(null);

    try {
      let serverId = server?.id;
      
      if (server) {
        await mediaServers.update(server.id, form);
      } else {
        const response = await mediaServers.create(form);
        serverId = response.data.id;
      }
      
      // Save path mappings
      if (serverId && pathMappings.length > 0) {
        const { put } = await import('../api/client');
        const payload = pathMappings.map(m => ({
          localPath: m.localPath,
          mediaServerPath: m.customPath ? m.remotePath : m.localPath,
        }));
        await put(`/path-mappings/media-server/${serverId}`, { mappings: payload });
      } else if (serverId && pathMappings.length === 0 && server) {
        // Clear mappings if they were all removed
        const { put } = await import('../api/client');
        await put(`/path-mappings/media-server/${serverId}`, { mappings: [] });
      }
      
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Path mapping helpers
  const addPathMapping = () => {
    setPathMappings([...pathMappings, { localPath: '', remotePath: '', customPath: false }]);
    setShowPathMappings(true);
  };

  const removePathMapping = (index: number) => {
    setPathMappings(pathMappings.filter((_, i) => i !== index));
  };

  const updatePathMapping = (index: number, field: 'localPath' | 'remotePath' | 'customPath', value: string | boolean) => {
    const updated = [...pathMappings];
    if (field === 'customPath') {
      updated[index].customPath = value as boolean;
      if (!value) {
        updated[index].remotePath = updated[index].localPath;
      }
    } else if (field === 'localPath') {
      updated[index].localPath = value as string;
      if (!updated[index].customPath) {
        updated[index].remotePath = value as string;
      }
    } else {
      updated[index].remotePath = value as string;
    }
    setPathMappings(updated);
  };

  const getServiceLabel = () => form.type === 'jellyfin' ? 'Jellyfin' : 'Emby';

  return (
    <Modal onClose={onClose} title={server ? 'Edit Media Server' : 'Add Media Server'}>
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
            onChange={(e) => {
              setForm({ ...form, type: e.target.value as any });
              setConnectionVerified(false);
            }}
            className="input w-full"
          >
            <option value="jellyfin">Jellyfin</option>
            <option value="emby">Emby</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input w-full"
            placeholder={`My ${form.type.charAt(0).toUpperCase() + form.type.slice(1)} Server`}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => {
              setForm({ ...form, url: e.target.value });
              setConnectionVerified(false);
            }}
            className="input w-full"
            placeholder="http://localhost:8096"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">API Key</label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => {
              setForm({ ...form, apiKey: e.target.value });
              setConnectionVerified(false);
            }}
            className="input w-full"
            placeholder="Enter API key"
            required
          />
        </div>

        {/* Path Mappings Section */}
        <div className="border-t border-gray-700 pt-4">
          <button
            type="button"
            onClick={() => setShowPathMappings(!showPathMappings)}
            className="flex items-center justify-between w-full text-left"
          >
            <div>
              <span className="font-medium text-sm">Path Mappings</span>
              <span className="text-xs text-gray-500 ml-2">
                {pathMappings.length > 0 ? `(${pathMappings.length} configured)` : '(optional)'}
              </span>
            </div>
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${showPathMappings ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showPathMappings && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-500">
                Only needed if Sweeparr and {getServiceLabel()} see files at different paths.
              </p>
              
              {pathMappingsLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <LoadingSpinner size="sm" /> Loading...
                </div>
              ) : (
                <>
                  {pathMappings.map((mapping, index) => (
                    <div key={index} className="bg-tertiary rounded-lg p-3 space-y-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Sweeparr Path</label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={mapping.localPath}
                            onChange={(e) => updatePathMapping(index, 'localPath', e.target.value)}
                            className="input flex-1 text-sm"
                            placeholder="/data/media/movies"
                          />
                          <button
                            type="button"
                            onClick={() => setBrowsingIndex(index)}
                            className="btn btn-secondary text-sm px-2"
                            title="Browse"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => removePathMapping(index)}
                            className="btn btn-danger text-sm px-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updatePathMapping(index, 'customPath', !mapping.customPath)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              mapping.customPath ? 'bg-orange-600' : 'bg-gray-600'
                            }`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              mapping.customPath ? 'translate-x-[18px]' : 'translate-x-1'
                            }`} />
                          </button>
                          <span className="text-xs text-gray-400">{getServiceLabel()} uses different path</span>
                        </div>
                      </div>
                      
                      {mapping.customPath && (
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">{getServiceLabel()} Path</label>
                          <input
                            type="text"
                            value={mapping.remotePath}
                            onChange={(e) => updatePathMapping(index, 'remotePath', e.target.value)}
                            className="input w-full text-sm"
                            placeholder="/media/movies"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={addPathMapping}
                    className="btn btn-secondary text-sm w-full"
                  >
                    + Add Path Mapping
                  </button>
                </>
              )}
            </div>
          )}
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

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
          {server && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Are you sure you want to delete this server?')) {
                  onDelete(server.id);
                  onClose();
                }
              }}
              className="btn btn-danger mr-auto"
            >
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          {!server && !connectionVerified ? (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !form.url || !form.apiKey}
              className="btn btn-primary"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          ) : (
            <button 
              type="submit" 
              disabled={saving} 
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </form>
      
      {/* File Browser Modal */}
      <FileBrowser
        isOpen={browsingIndex !== null}
        onClose={() => setBrowsingIndex(null)}
        onSelect={(path) => {
          if (browsingIndex !== null) {
            updatePathMapping(browsingIndex, 'localPath', path);
          }
        }}
        initialPath={browsingIndex !== null ? pathMappings[browsingIndex]?.localPath || '/' : '/'}
        title="Select Sweeparr Path"
      />
    </Modal>
  );
}

interface ArrAppModalProps {
  app: ArrApp | null;
  servers: MediaServer[];
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: number) => void;
}

function ArrAppModal({ app, servers, onClose, onSaved, onDelete }: ArrAppModalProps) {
  const [form, setForm] = useState({
    name: app?.name || '',
    type: app?.type || 'radarr',
    url: app?.url || '',
    apiKey: app?.apiKey || '',
    mediaServerId: app?.mediaServerId || null as number | null,
  });
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [connectionTested, setConnectionTested] = useState(false);
  
  // Path mappings state
  const [showPathMappings, setShowPathMappings] = useState(false);
  const [pathMappings, setPathMappings] = useState<Array<{ localPath: string; remotePath: string; customPath?: boolean }>>([]);
  const [pathMappingsLoading, setPathMappingsLoading] = useState(false);
  const [browsingIndex, setBrowsingIndex] = useState<number | null>(null);

  // Load path mappings when editing an existing app
  useEffect(() => {
    if (app?.id) {
      const loadMappings = async () => {
        setPathMappingsLoading(true);
        try {
          const { get } = await import('../api/client');
          const response = await get<{ success: boolean; data: Array<any> }>(`/path-mappings/arr/${app.id}`);
          const normalized = (response.data || []).map((m: any) => ({
            localPath: m.localPath || '',
            remotePath: m.arrPath || m.localPath || '',
            customPath: m.localPath !== (m.arrPath || m.localPath),
          }));
          setPathMappings(normalized);
        } catch (error) {
          console.error('Failed to load path mappings:', error);
        } finally {
          setPathMappingsLoading(false);
        }
      };
      loadMappings();
    }
  }, [app?.id]);

  const handleTest = async () => {
    if (!form.url || !form.apiKey) {
      setError('URL and API Key are required to test');
      return;
    }
    
    setTesting(true);
    setError(null);
    setTestResult(null);
    
    try {
      const result = await arrApps.testConnection({
        type: form.type,
        url: form.url,
        apiKey: form.apiKey,
      });
      setTestResult(result.data);
      if (result.data.connected) {
        setConnectionTested(true);
      }
    } catch (err: any) {
      setTestResult({ connected: false, message: err?.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let appId = app?.id;
      
      if (app) {
        await arrApps.update(app.id, form);
      } else {
        const response = await arrApps.create(form);
        appId = response.data.id;
      }
      
      // Save path mappings
      if (appId && pathMappings.length > 0) {
        const { put } = await import('../api/client');
        const payload = pathMappings.map(m => ({
          localPath: m.localPath,
          arrPath: m.customPath ? m.remotePath : m.localPath,
        }));
        await put(`/path-mappings/arr/${appId}`, { mappings: payload });
      } else if (appId && pathMappings.length === 0 && app) {
        // Clear mappings if they were all removed
        const { put } = await import('../api/client');
        await put(`/path-mappings/arr/${appId}`, { mappings: [] });
      }
      
      onSaved();
    } catch (err: any) {
      setError(err?.message || (typeof err === 'string' ? err : 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  // Path mapping helpers
  const addPathMapping = () => {
    setPathMappings([...pathMappings, { localPath: '', remotePath: '', customPath: false }]);
    setShowPathMappings(true);
  };

  const removePathMapping = (index: number) => {
    setPathMappings(pathMappings.filter((_, i) => i !== index));
  };

  const updatePathMapping = (index: number, field: 'localPath' | 'remotePath' | 'customPath', value: string | boolean) => {
    const updated = [...pathMappings];
    if (field === 'customPath') {
      updated[index].customPath = value as boolean;
      if (!value) {
        updated[index].remotePath = updated[index].localPath;
      }
    } else if (field === 'localPath') {
      updated[index].localPath = value as string;
      if (!updated[index].customPath) {
        updated[index].remotePath = value as string;
      }
    } else {
      updated[index].remotePath = value as string;
    }
    setPathMappings(updated);
  };

  const getServiceLabel = () => form.type === 'radarr' ? 'Radarr' : 'Sonarr';

  return (
    <Modal onClose={onClose} title={app ? 'Edit Arr Service' : 'Add Arr Service'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-200 text-sm">
            {typeof error === 'string' ? error : 'An error occurred'}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium form-label mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value as any })}
            className="input w-full"
          >
            <option value="radarr">Radarr</option>
            <option value="sonarr">Sonarr</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input w-full"
            placeholder={`My ${form.type.charAt(0).toUpperCase() + form.type.slice(1)}`}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
            className="input w-full"
            placeholder={form.type === 'radarr' ? 'http://localhost:7878' : 'http://localhost:8989'}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">API Key</label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
            className="input w-full"
            placeholder="Enter API key"
            required
          />
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

        {/* Path Mappings Section */}
        <div className="border-t border-gray-700 pt-4">
          <button
            type="button"
            onClick={() => setShowPathMappings(!showPathMappings)}
            className="flex items-center justify-between w-full text-left"
          >
            <div>
              <span className="font-medium text-sm">Path Mappings</span>
              <span className="text-xs text-gray-500 ml-2">
                {pathMappings.length > 0 ? `(${pathMappings.length} configured)` : '(optional)'}
              </span>
            </div>
            <svg 
              className={`w-4 h-4 text-gray-400 transition-transform ${showPathMappings ? 'rotate-180' : ''}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showPathMappings && (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-gray-500">
                Only needed if Sweeparr and {getServiceLabel()} see files at different paths.
              </p>
              
              {pathMappingsLoading ? (
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <LoadingSpinner size="sm" /> Loading...
                </div>
              ) : (
                <>
                  {pathMappings.map((mapping, index) => (
                    <div key={index} className="bg-tertiary rounded-lg p-3 space-y-2">
                      <div>
                        <label className="text-xs text-gray-400 mb-1 block">Sweeparr Path</label>
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={mapping.localPath}
                            onChange={(e) => updatePathMapping(index, 'localPath', e.target.value)}
                            className="input flex-1 text-sm"
                            placeholder="/data/media/movies"
                          />
                          <button
                            type="button"
                            onClick={() => setBrowsingIndex(index)}
                            className="btn btn-secondary text-sm px-2"
                            title="Browse"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => removePathMapping(index)}
                            className="btn btn-danger text-sm px-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-gray-600">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => updatePathMapping(index, 'customPath', !mapping.customPath)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              mapping.customPath ? 'bg-orange-600' : 'bg-gray-600'
                            }`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              mapping.customPath ? 'translate-x-[18px]' : 'translate-x-1'
                            }`} />
                          </button>
                          <span className="text-xs text-gray-400">{getServiceLabel()} uses different path</span>
                        </div>
                      </div>
                      
                      {mapping.customPath && (
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">{getServiceLabel()} Path</label>
                          <input
                            type="text"
                            value={mapping.remotePath}
                            onChange={(e) => updatePathMapping(index, 'remotePath', e.target.value)}
                            className="input w-full text-sm"
                            placeholder="/movies"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <button
                    type="button"
                    onClick={addPathMapping}
                    className="btn btn-secondary text-sm w-full"
                  >
                    + Add Path Mapping
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
          {app && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm('Are you sure you want to delete this service?')) {
                  onDelete(app.id);
                  onClose();
                }
              }}
              className="btn btn-danger mr-auto"
            >
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          {!app && !connectionTested ? (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !form.url || !form.apiKey}
              className="btn btn-primary"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          ) : (
            <button 
              type="submit" 
              disabled={saving} 
              className="btn btn-primary"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          )}
        </div>
      </form>
      
      {/* File Browser Modal */}
      <FileBrowser
        isOpen={browsingIndex !== null}
        onClose={() => setBrowsingIndex(null)}
        onSelect={(path) => {
          if (browsingIndex !== null) {
            updatePathMapping(browsingIndex, 'localPath', path);
          }
        }}
        initialPath={browsingIndex !== null ? pathMappings[browsingIndex]?.localPath || '/' : '/'}
        title="Select Sweeparr Path"
      />
    </Modal>
  );
}

// ============================================================================
// ConnectionModal - Unified modal for all service types
// ============================================================================

type ServiceCategory = 'media-server' | 'arr' | 'statistics';
type ConnectionServiceType = 'jellyfin' | 'emby' | 'radarr' | 'sonarr' | 'jellystat' | 'tautulli';

interface ConnectionModalProps {
  service: {
    id: number;
    name: string;
    type: ConnectionServiceType;
    url: string;
    apiKey?: string;
    mediaServerId?: number | null;
  } | null;
  serviceType?: ConnectionServiceType;
  servers?: MediaServer[];
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (id: number) => void;
}

const getConnectionServiceCategory = (type: ConnectionServiceType): ServiceCategory => {
  if (type === 'jellyfin' || type === 'emby') return 'media-server';
  if (type === 'radarr' || type === 'sonarr') return 'arr';
  return 'statistics';
};

const connectionSupportsPathMappings = (type: ConnectionServiceType): boolean => {
  return ['jellyfin', 'emby', 'radarr', 'sonarr'].includes(type);
};

const getConnectionServiceLabel = (type: ConnectionServiceType): string => {
  const labels: Record<ConnectionServiceType, string> = {
    jellyfin: 'Jellyfin',
    emby: 'Emby',
    radarr: 'Radarr',
    sonarr: 'Sonarr',
    jellystat: 'Jellystat',
    tautulli: 'Tautulli',
  };
  return labels[type];
};

function ConnectionModal({ service, serviceType, servers = [], onClose, onSaved, onDelete }: ConnectionModalProps) {
  const effectiveType = service?.type || serviceType || 'radarr';
  const category = getConnectionServiceCategory(effectiveType);
  const isEditing = !!service;
  
  const [form, setForm] = useState({
    name: service?.name || '',
    type: effectiveType,
    url: service?.url || '',
    apiKey: '',
    mediaServerId: service?.mediaServerId || null as number | null,
  });
  
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [connectionTested, setConnectionTested] = useState(isEditing);
  
  const [showPathMappings, setShowPathMappings] = useState(false);
  const [pathMappings, setPathMappings] = useState<Array<{ localPath: string; remotePath: string; customPath?: boolean }>>([]);
  const [pathMappingsLoading, setPathMappingsLoading] = useState(false);
  const [browsingIndex, setBrowsingIndex] = useState<number | null>(null);

  useEffect(() => {
    if (service?.id && connectionSupportsPathMappings(form.type as ConnectionServiceType)) {
      const loadMappings = async () => {
        setPathMappingsLoading(true);
        try {
          const { get } = await import('../api/client');
          const endpoint = category === 'arr' 
            ? `/path-mappings/arr/${service.id}`
            : `/path-mappings/media-server/${service.id}`;
          const response = await get<{ success: boolean; data: Array<any> }>(endpoint);
          const remotePathField = category === 'arr' ? 'arrPath' : 'mediaServerPath';
          const normalized = (response.data || []).map((m: any) => ({
            localPath: m.localPath || '',
            remotePath: m[remotePathField] || m.localPath || '',
            customPath: m.localPath !== (m[remotePathField] || m.localPath),
          }));
          setPathMappings(normalized);
        } catch (error) {
          console.error('Failed to load path mappings:', error);
        } finally {
          setPathMappingsLoading(false);
        }
      };
      loadMappings();
    }
  }, [service?.id, category, form.type]);

  const handleTest = async () => {
    if (!form.url || !form.apiKey) {
      setError('URL and API Key are required to test');
      return;
    }
    
    setTesting(true);
    setError(null);
    setTestResult(null);
    
    try {
      let result;
      if (category === 'media-server') {
        result = await mediaServers.testConnection({ type: form.type, url: form.url, apiKey: form.apiKey });
      } else if (category === 'arr') {
        result = await arrApps.testConnection({ type: form.type, url: form.url, apiKey: form.apiKey });
      } else {
        result = await statisticsServices.testConnection({ type: form.type, url: form.url, apiKey: form.apiKey });
      }
      setTestResult(result.data);
      if (result.data.connected) {
        setConnectionTested(true);
      }
    } catch (err: any) {
      setTestResult({ connected: false, message: err?.message || 'Test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      let savedId = service?.id;
      
      const payload: any = {
        name: form.name,
        type: form.type,
        url: form.url,
      };
      if (form.apiKey) payload.apiKey = form.apiKey;
      if (category === 'arr') payload.mediaServerId = form.mediaServerId;
      
      if (service) {
        if (category === 'media-server') {
          await mediaServers.update(service.id, payload);
        } else if (category === 'arr') {
          await arrApps.update(service.id, payload);
        } else {
          await statisticsServices.update(service.id, payload);
        }
      } else {
        let response;
        if (category === 'media-server') {
          response = await mediaServers.create(payload);
        } else if (category === 'arr') {
          response = await arrApps.create(payload);
        } else {
          response = await statisticsServices.create(payload);
        }
        savedId = response.data.id;
      }
      
      if (savedId && connectionSupportsPathMappings(form.type as ConnectionServiceType)) {
        const { put } = await import('../api/client');
        const endpoint = category === 'arr' 
          ? `/path-mappings/arr/${savedId}`
          : `/path-mappings/media-server/${savedId}`;
        const remotePathField = category === 'arr' ? 'arrPath' : 'mediaServerPath';
        
        if (pathMappings.length > 0) {
          const mappingPayload = pathMappings.map(m => ({
            localPath: m.localPath,
            [remotePathField]: m.customPath ? m.remotePath : m.localPath,
          }));
          await put(endpoint, { mappings: mappingPayload });
        } else if (service) {
          await put(endpoint, { mappings: [] });
        }
      }
      
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addPathMapping = () => {
    setPathMappings([...pathMappings, { localPath: '', remotePath: '', customPath: false }]);
    setShowPathMappings(true);
  };

  const removePathMapping = (index: number) => {
    setPathMappings(pathMappings.filter((_, i) => i !== index));
  };

  const updatePathMapping = (index: number, field: 'localPath' | 'remotePath' | 'customPath', value: string | boolean) => {
    const updated = [...pathMappings];
    if (field === 'customPath') {
      updated[index].customPath = value as boolean;
      if (!value) updated[index].remotePath = updated[index].localPath;
    } else if (field === 'localPath') {
      updated[index].localPath = value as string;
      if (!updated[index].customPath) updated[index].remotePath = value as string;
    } else {
      updated[index].remotePath = value as string;
    }
    setPathMappings(updated);
  };

  const modalTitle = isEditing 
    ? `Edit ${getConnectionServiceLabel(form.type as ConnectionServiceType)}`
    : `Add ${getConnectionServiceLabel(form.type as ConnectionServiceType)}`;

  return (
    <Modal onClose={onClose} title={modalTitle}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded p-3 text-red-200 text-sm">
            {error}
          </div>
        )}

        {!isEditing && (category === 'media-server' || category === 'arr') && (
          <div>
            <label className="block text-sm font-medium form-label mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => {
                setForm({ ...form, type: e.target.value as ConnectionServiceType });
                setConnectionTested(false);
              }}
              className="input w-full"
            >
              {category === 'media-server' ? (
                <>
                  <option value="jellyfin">Jellyfin</option>
                  <option value="emby">Emby</option>
                </>
              ) : (
                <>
                  <option value="radarr">Radarr</option>
                  <option value="sonarr">Sonarr</option>
                </>
              )}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium form-label mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input w-full"
            placeholder={`My ${getConnectionServiceLabel(form.type as ConnectionServiceType)} Server`}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => {
              setForm({ ...form, url: e.target.value });
              setConnectionTested(false);
            }}
            className="input w-full"
            placeholder="http://localhost:8096"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium form-label mb-1">
            API Key {isEditing && '(leave blank to keep current)'}
          </label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => {
              setForm({ ...form, apiKey: e.target.value });
              setConnectionTested(false);
            }}
            className="input w-full"
            placeholder={isEditing ? '••••••••' : 'Enter API key'}
            required={!isEditing}
          />
          {category === 'statistics' && form.type === 'jellystat' && (
            <p className="text-xs text-gray-500 mt-1">
              Find your API key in Jellystat Settings → Security → API Keys
            </p>
          )}
        </div>

        {category === 'arr' && servers.length > 0 && (
          <div>
            <label className="block text-sm font-medium form-label mb-1">Media Server</label>
            <select
              value={form.mediaServerId || ''}
              onChange={(e) => setForm({ ...form, mediaServerId: e.target.value ? parseInt(e.target.value) : null })}
              className="input w-full"
            >
              <option value="">None (no watch history)</option>
              {servers.map(server => (
                <option key={server.id} value={server.id}>
                  {server.name} ({server.type})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Link to a media server to use watch history in cleanup rules.
            </p>
          </div>
        )}

        {connectionSupportsPathMappings(form.type as ConnectionServiceType) && (
          <div className="border-t border-gray-700 pt-4">
            <button
              type="button"
              onClick={() => setShowPathMappings(!showPathMappings)}
              className="flex items-center justify-between w-full text-left"
            >
              <div>
                <span className="font-medium text-sm">Path Mappings</span>
                <span className="text-xs text-gray-500 ml-2">
                  {pathMappings.length > 0 ? `(${pathMappings.length} configured)` : '(optional)'}
                </span>
              </div>
              <svg 
                className={`w-4 h-4 text-gray-400 transition-transform ${showPathMappings ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showPathMappings && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-gray-500">
                  Only needed if Sweeparr and {getConnectionServiceLabel(form.type as ConnectionServiceType)} see files at different paths.
                </p>
                
                {pathMappingsLoading ? (
                  <div className="flex items-center gap-2 text-gray-400 text-sm">
                    <LoadingSpinner size="sm" /> Loading...
                  </div>
                ) : (
                  <>
                    {pathMappings.map((mapping, index) => (
                      <div key={index} className="bg-tertiary rounded-lg p-3 space-y-2">
                        <div>
                          <label className="text-xs text-gray-400 mb-1 block">Sweeparr Path</label>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              value={mapping.localPath}
                              onChange={(e) => updatePathMapping(index, 'localPath', e.target.value)}
                              className="input flex-1 text-sm"
                              placeholder="/data/media/movies"
                            />
                            <button
                              type="button"
                              onClick={() => setBrowsingIndex(index)}
                              className="btn btn-secondary text-sm px-2"
                              title="Browse"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => removePathMapping(index)}
                              className="btn btn-danger text-sm px-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-2 border-t border-gray-600">
                          <button
                            type="button"
                            onClick={() => updatePathMapping(index, 'customPath', !mapping.customPath)}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              mapping.customPath ? 'bg-orange-600' : 'bg-gray-600'
                            }`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              mapping.customPath ? 'translate-x-[18px]' : 'translate-x-1'
                            }`} />
                          </button>
                          <span className="text-xs text-gray-400">{getConnectionServiceLabel(form.type as ConnectionServiceType)} uses different path</span>
                        </div>
                        
                        {mapping.customPath && (
                          <div>
                            <label className="text-xs text-gray-400 mb-1 block">{getConnectionServiceLabel(form.type as ConnectionServiceType)} Path</label>
                            <input
                              type="text"
                              value={mapping.remotePath}
                              onChange={(e) => updatePathMapping(index, 'remotePath', e.target.value)}
                              className="input w-full text-sm"
                              placeholder="/media/movies"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                    
                    <button
                      type="button"
                      onClick={addPathMapping}
                      className="btn btn-secondary text-sm w-full"
                    >
                      + Add Path Mapping
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {testResult && (
          <div className={`p-3 rounded text-sm ${
            testResult.connected
              ? 'bg-green-900/50 text-green-300 border border-green-700'
              : 'bg-red-900/50 text-red-300 border border-red-700'
          }`}>
            {testResult.connected ? '✓ ' : '✗ '}
            {testResult.message}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-gray-700">
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={() => {
                if (confirm(`Are you sure you want to delete this ${getConnectionServiceLabel(form.type as ConnectionServiceType)}?`)) {
                  onDelete(service!.id);
                  onClose();
                }
              }}
              className="btn btn-danger mr-auto"
            >
              Delete
            </button>
          )}
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          {!isEditing && !connectionTested ? (
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !form.url || !form.apiKey}
              className="btn btn-primary"
            >
              {testing ? 'Testing...' : 'Test Connection'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleTest}
                disabled={testing}
                className="btn btn-secondary"
              >
                {testing ? 'Testing...' : 'Test'}
              </button>
              <button type="submit" disabled={saving} className="btn btn-primary">
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          )}
        </div>
      </form>
      
      {connectionSupportsPathMappings(form.type as ConnectionServiceType) && (
        <FileBrowser
          isOpen={browsingIndex !== null}
          onClose={() => setBrowsingIndex(null)}
          onSelect={(path) => {
            if (browsingIndex !== null) {
              updatePathMapping(browsingIndex, 'localPath', path);
            }
          }}
          initialPath={browsingIndex !== null ? pathMappings[browsingIndex]?.localPath || '/' : '/'}
          title="Select Sweeparr Path"
        />
      )}
    </Modal>
  );
}

interface ModalProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

function Modal({ onClose, title, children }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative card rounded-lg shadow-xl w-full max-w-md p-6 m-4">
        <h2 className="text-xl font-semibold mb-4">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default Settings;
