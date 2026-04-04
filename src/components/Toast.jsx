import { useEffect } from 'react';

export default function Toast({ message, type = 'info', onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: {
      background: 'var(--dds-color-status-success-soft)',
      color: 'var(--dds-color-status-success)',
      borderColor: 'color-mix(in srgb, var(--dds-color-status-success) 30%, var(--dds-color-border-normal))',
    },
    error: {
      background: 'var(--dds-color-status-error-soft)',
      color: 'var(--dds-color-status-error)',
      borderColor: 'color-mix(in srgb, var(--dds-color-status-error) 30%, var(--dds-color-border-normal))',
    },
    info: {
      background: 'var(--dds-color-status-info-soft)',
      color: 'var(--dds-color-status-info)',
      borderColor: 'color-mix(in srgb, var(--dds-color-status-info) 30%, var(--dds-color-border-normal))',
    },
    warning: {
      background: 'var(--dds-color-status-warning-soft)',
      color: 'var(--dds-color-status-warning)',
      borderColor: 'color-mix(in srgb, var(--dds-color-status-warning) 30%, var(--dds-color-border-normal))',
    },
  };

  const icons = {
    success: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    warning: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  };

  return (
    <div
      className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg border shadow-lg animate-slide-in-right"
      style={styles[type]}
    >
      <div className="flex-shrink-0">
        {icons[type]}
      </div>
      <p className="text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 ml-2 opacity-70 hover:opacity-100 transition-opacity"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
