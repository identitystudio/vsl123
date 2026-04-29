'use client';

import { useEffect } from 'react';

export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    let cancelled = false;

    const cleanup = async () => {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        if (cancelled || registrations.length === 0) {
          return;
        }

        await Promise.all(registrations.map((registration) => registration.unregister()));

        if (!cancelled && navigator.serviceWorker.controller) {
          window.location.reload();
        }
      } catch {
        // Ignore cleanup failures. The app does not depend on service workers.
      }
    };

    cleanup();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
