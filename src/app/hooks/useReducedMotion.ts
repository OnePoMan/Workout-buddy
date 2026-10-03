import { useEffect, useState } from 'react';
import type { ReduceMotion } from '../../domain/types';

const QUERY = '(prefers-reduced-motion: reduce)';

/** Resolves the Settings value against the OS preference. */
export function useReducedMotion(setting: ReduceMotion): boolean {
  const [system, setSystem] = useState(() => typeof matchMedia === 'function' && matchMedia(QUERY).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(QUERY);
    const onChange = () => setSystem(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return setting === 'on' || (setting === 'system' && system);
}
