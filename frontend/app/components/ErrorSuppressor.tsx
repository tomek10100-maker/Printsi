'use client';

if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args) => {
    // Prevent Next.js dev overlay from popping up for 'Failed to fetch' network errors
    // caused by background polling or blocked requests.
    const isFetchError = args.some(
      arg => 
        (arg instanceof Error && arg.message.includes('Failed to fetch')) ||
        (typeof arg === 'string' && arg.includes('Failed to fetch')) ||
        (arg && arg.message && arg.message.includes('Failed to fetch'))
    );

    if (isFetchError) {
      console.warn('⚠️ Suppressed console.error to prevent Next.js overlay:', ...args.map(a => a?.message || a));
      return;
    }

    originalError.apply(console, args);
  };
}

export function ErrorSuppressor() {
  return null;
}
