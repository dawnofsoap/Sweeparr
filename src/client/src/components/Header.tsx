import { useState, useEffect } from 'react';
import { health } from '../api';

function Header() {
  const [status, setStatus] = useState<'healthy' | 'unhealthy' | 'loading'>('loading');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await health.get();
        setStatus(res.status === 'healthy' ? 'healthy' : 'unhealthy');
      } catch {
        setStatus('unhealthy');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const statusConfig = {
    healthy: { color: 'bg-green-500', text: 'Healthy' },
    unhealthy: { color: 'bg-red-500', text: 'Unhealthy' },
    loading: { color: 'bg-yellow-500', text: 'Checking...' },
  };

  return (
    <header className="h-16 header-container border-b flex items-center justify-between px-6">
      <div>{/* Breadcrumb or page title can go here */}</div>

      <div className="flex items-center gap-4">
        {/* Health indicator */}
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 ${statusConfig[status].color} rounded-full`} />
          <span className="text-sm header-text">{statusConfig[status].text}</span>
        </div>

        {/* Notifications */}
        <button className="p-2 header-text hover:text-primary hover:bg-secondary rounded-lg transition-colors">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
        </button>
      </div>
    </header>
  );
}

export default Header;
