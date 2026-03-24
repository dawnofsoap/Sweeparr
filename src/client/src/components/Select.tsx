import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption<T = string> {
  value: T;
  label: string;
  badge?: {
    text: string;
    color: 'blue' | 'purple' | 'green' | 'orange' | 'red' | 'gray';
  };
  disabled?: boolean;
}

interface SelectProps<T = string> {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

const badgeColors = {
  blue: 'bg-blue-900/50 text-blue-300',
  purple: 'bg-purple-900/50 text-purple-300',
  green: 'bg-green-900/50 text-green-300',
  orange: 'bg-orange-900/50 text-orange-300',
  red: 'bg-red-900/50 text-red-300',
  gray: 'bg-gray-700 text-gray-300',
};

export function Select<T extends string | number>({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Select...', 
  disabled = false,
  className = '',
  size = 'md',
}: SelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);
  const textSize = size === 'sm' ? 'text-sm' : 'text-base';
  const padding = size === 'sm' ? 'px-3 py-1.5' : 'px-3 py-2';

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`input w-full ${padding} ${textSize} text-left flex items-center justify-between gap-2 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        }`}
        style={{ backgroundColor: 'rgb(var(--input-bg))', borderColor: 'rgb(var(--input-border))' }}
      >
        <span className="flex items-center gap-2 min-w-0 flex-1">
          {selectedOption ? (
            <>
              <span className="truncate">{selectedOption.label}</span>
              {selectedOption.badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColors[selectedOption.badge.color]}`}>
                  {selectedOption.badge.text}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-500">{placeholder}</span>
          )}
        </span>
        <svg 
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 mt-1 w-full rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto"
          style={{ backgroundColor: 'rgb(var(--bg-secondary))', border: '1px solid rgb(var(--border-color))' }}
        >
          {options.map((option) => (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => {
                if (!option.disabled) {
                  onChange(option.value);
                  setIsOpen(false);
                }
              }}
              disabled={option.disabled}
              className={`w-full ${padding} text-left ${textSize} flex items-center gap-2 transition-colors ${
                option.disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer'
              }`}
              style={{ 
                backgroundColor: value === option.value ? 'rgb(var(--bg-tertiary))' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!option.disabled && value !== option.value) {
                  e.currentTarget.style.backgroundColor = 'rgb(var(--bg-tertiary))';
                }
              }}
              onMouseLeave={(e) => {
                if (value !== option.value) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              <span className="truncate">{option.label}</span>
              {option.badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${badgeColors[option.badge.color]}`}>
                  {option.badge.text}
                </span>
              )}
            </button>
          ))}
          {options.length === 0 && (
            <div className={`${padding} text-gray-500 ${textSize}`}>No options available</div>
          )}
        </div>
      )}
    </div>
  );
}

export default Select;
