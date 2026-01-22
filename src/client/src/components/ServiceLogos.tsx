// Service logos - using official PNG icons from the projects' GitHub repositories
// Icons are stored in /public/icons/

// Official brand colors
export const serviceColors: Record<string, string> = {
  // Media servers
  jellyfin: '#00A4DC',
  emby: '#52B54B',
  plex: '#E5A00D',
  // *arr apps
  radarr: '#FFC230',
  sonarr: '#35C5F4',
  lidarr: '#1DB954',
  readarr: '#8E24AA',
  prowlarr: '#FFC107',
  // Statistics services
  jellystat: '#6366F1', // Indigo/purple to match their UI
  tautulli: '#E5A00D', // Yellow/gold
  // Storage services
  truenas: '#0095D5', // TrueNAS blue
  // Notification services
  discord: '#5865F2',
  slack: '#4A154B',
  telegram: '#2AABEE',
  email: '#EA4335',
  pushover: '#249DF1',
  gotify: '#36CFC9',
};

// Service type labels
export const serviceLabels: Record<string, string> = {
  // Media servers
  jellyfin: 'Jellyfin',
  emby: 'Emby',
  plex: 'Plex',
  // *arr apps
  radarr: 'Radarr',
  sonarr: 'Sonarr',
  lidarr: 'Lidarr',
  readarr: 'Readarr',
  prowlarr: 'Prowlarr',
  // Statistics services
  jellystat: 'Jellystat',
  tautulli: 'Tautulli',
  // Storage services
  truenas: 'TrueNAS',
  'truenas-scale': 'TrueNAS SCALE',
  'truenas-core': 'TrueNAS CORE',
  // Notification services
  discord: 'Discord',
  slack: 'Slack',
  telegram: 'Telegram',
  email: 'Email',
  pushover: 'Pushover',
  gotify: 'Gotify',
};

// Get icon path for a service type
export function getServiceIconPath(type: string): string {
  const normalizedType = type.toLowerCase();
  // Prefer PNG for *arr apps and media servers, SVG for others
  const pngServices = ['radarr', 'sonarr', 'lidarr', 'readarr', 'prowlarr', 'jellyfin', 'emby', 'plex'];
  const extension = pngServices.includes(normalizedType) ? 'png' : 'svg';
  
  // Handle TrueNAS variants
  if (normalizedType === 'truenas' || normalizedType === 'truenas-scale') {
    return '/icons/truenas-scale.svg';
  }
  if (normalizedType === 'truenas-core') {
    return '/icons/truenas-core.svg';
  }
  
  return `/icons/${normalizedType}.${extension}`;
}

interface ServiceLogoProps {
  type: string;
  className?: string;
  size?: number;
}

// Main logo component using actual image files
export function ServiceLogo({ type, className, size = 32 }: ServiceLogoProps) {
  const iconPath = getServiceIconPath(type);
  const normalizedType = type.toLowerCase();
  
  return (
    <img 
      src={iconPath} 
      alt={`${serviceLabels[normalizedType] || type} logo`}
      className={className}
      style={{ 
        width: size, 
        height: size,
        objectFit: 'contain',
      }}
      onError={(e) => {
        // Fallback to colored circle with first letter if image fails
        const target = e.target as HTMLImageElement;
        target.style.display = 'none';
        const parent = target.parentElement;
        if (parent) {
          const fallback = document.createElement('div');
          fallback.className = 'rounded-full flex items-center justify-center text-white text-xs font-bold';
          fallback.style.width = `${size}px`;
          fallback.style.height = `${size}px`;
          fallback.style.backgroundColor = serviceColors[normalizedType] || '#666';
          fallback.textContent = type.charAt(0).toUpperCase();
          parent.appendChild(fallback);
        }
      }}
    />
  );
}

// Colored wrapper (adds brand color tint/glow if needed)
export function ServiceLogoColored({ type, className, size = 32 }: ServiceLogoProps) {
  return (
    <div className={`flex items-center justify-center ${className || ''}`}>
      <ServiceLogo type={type} size={size} />
    </div>
  );
}

// Logo with background circle
export function ServiceLogoWithBackground({ type, className, size = 40 }: ServiceLogoProps) {
  const color = serviceColors[type.toLowerCase()] || '#666';
  const iconSize = Math.floor(size * 0.65);
  
  return (
    <div 
      className={`rounded-full flex items-center justify-center ${className || ''}`}
      style={{ 
        backgroundColor: color,
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        padding: 4,
      }}
    >
      <ServiceLogo type={type} size={iconSize} />
    </div>
  );
}

// Simple fallback component (letter in colored circle)
export function ServiceLogoFallback({ type, className, size = 32 }: ServiceLogoProps) {
  const color = serviceColors[type.toLowerCase()] || '#666';
  
  return (
    <div 
      className={`rounded-full flex items-center justify-center text-white font-bold ${className || ''}`}
      style={{ 
        backgroundColor: color,
        width: size,
        height: size,
        fontSize: size * 0.4,
      }}
    >
      {type.charAt(0).toUpperCase()}
    </div>
  );
}
