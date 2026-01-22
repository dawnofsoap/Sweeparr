interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const sizeConfig = {
    sm: { container: 'w-20 h-14', broom: 'w-8 h-8' },
    md: { container: 'w-28 h-20', broom: 'w-12 h-12' },
    lg: { container: 'w-36 h-24', broom: 'w-14 h-14' },
  };

  const config = sizeConfig[size];

  return (
    <div className="flex flex-col items-center justify-center">
      <div className={`relative ${config.container}`}>
        {/* Sweeping broom */}
        <svg
          className={`absolute bottom-2 left-1/2 ${config.broom} animate-sweep-arc`}
          viewBox="0 0 64 64"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ transformOrigin: 'center bottom' }}
        >
          {/* Broom handle */}
          <rect x="30" y="4" width="4" height="32" rx="2" fill="#8B7355" />
          {/* Broom head binding */}
          <rect x="26" y="34" width="12" height="6" rx="1" fill="#5D4E37" />
          {/* Broom bristles */}
          <path d="M22 40 L26 40 L24 58 L20 58 Z" fill="#F97316" />
          <path d="M26 40 L30 40 L28 60 L24 60 Z" fill="#EA580C" />
          <path d="M30 40 L34 40 L32 60 L28 60 Z" fill="#F97316" />
          <path d="M34 40 L38 40 L36 60 L32 60 Z" fill="#EA580C" />
          <path d="M38 40 L42 40 L44 58 L40 58 Z" fill="#F97316" />
        </svg>
      </div>
      {text && (
        <span className="mt-3 text-gray-400 text-sm">{text}</span>
      )}
    </div>
  );
}

export function LoadingPage({ text }: { text?: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}

export default LoadingSpinner;
