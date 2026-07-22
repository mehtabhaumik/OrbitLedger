'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks the user's prefers-reduced-motion setting.
 *
 * Starts pessimistic (assumes reduced motion) so nothing animates during SSR or
 * the first paint before the media query is read - a chart that draws itself in
 * before hydration would jump. It flips to the real value in an effect.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(true);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
