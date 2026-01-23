import { useState, useEffect } from 'react';
import { post } from '../api/client';
import { LoadingSpinner } from './LoadingSpinner';
import { Portal } from './Portal';

interface BrowseResult {
  currentPath: string;
  parentPath: string | null;
  directories: Array<{ name: string; path: string }>;
}

interface FileBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
  title?: string;
}

export function FileBrowser({ isOpen, onClose, onSelect, initialPath = '/', title = 'Browse Directories' }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || '/');
  const [directories, setDirectories] = useState<Array<{ name: string; path: string }>>([]);
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPath, setManualPath] = useState(initialPath || '/');

  const fetchDirectories = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await post<{ success: boolean; data: BrowseResult }>('/path-mappings/browse', { currentPath: path });
      setCurrentPath(response.data.currentPath);
      setParentPath(response.data.parentPath);
      setDirectories(response.data.directories);
      setManualPath(response.data.currentPath);
    } catch (err: any) {
      setError(err.message || 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchDirectories(initialPath || '/');
    }
  }, [isOpen, initialPath]);

  const handleNavigate = (path: string) => {
    fetchDirectories(path);
  };

  const handleGoUp = () => {
    if (parentPath) {
      fetchDirectories(parentPath);
    }
  };

  const handleManualNavigate = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPath.trim()) {
      fetchDirectories(manualPath.trim());
    }
  };

  const handleSelect = () => {
    onSelect(currentPath);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />
        <div className="relative card rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4">
          {/* Header */}
          <div className="p-4 border-b border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{title}</h2>
              <button onClick={onClose} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Manual path input */}
            <form onSubmit={handleManualNavigate} className="flex gap-2">
              <input
                type="text"
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
                className="input flex-1 text-sm"
                placeholder="/path/to/directory"
              />
              <button type="submit" className="btn btn-secondary text-sm">
                Go
              </button>
            </form>
          </div>

          {/* Directory listing */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <div className="text-red-400 text-center py-4">
                {error}
              </div>
            ) : (
              <div className="space-y-1">
                {/* Parent directory button */}
                {parentPath && (
                  <button
                    onClick={handleGoUp}
                    className="w-full flex items-center gap-2 p-2 rounded hover:bg-hover text-left text-gray-300"
                  >
                    <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
                    </svg>
                    <span className="text-sm">..</span>
                    <span className="text-xs text-gray-500 ml-auto">Parent Directory</span>
                  </button>
                )}
                
                {/* Directory list */}
                {directories.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">
                    No subdirectories found
                  </p>
                ) : (
                  directories.map((dir) => (
                    <button
                      key={dir.path}
                      onClick={() => handleNavigate(dir.path)}
                      className="w-full flex items-center gap-2 p-2 rounded hover:bg-hover text-left"
                    >
                      <svg className="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span className="text-sm">{dir.name}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-gray-700">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400 truncate flex-1 mr-4">
                Selected: <code className="bg-black/30 px-1 rounded">{currentPath}</code>
              </div>
              <div className="flex gap-2">
                <button onClick={onClose} className="btn btn-secondary">
                  Cancel
                </button>
                <button onClick={handleSelect} className="btn btn-primary">
                  Select
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Portal>
  );
}
