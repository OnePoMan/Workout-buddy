import { useEffect, useState } from 'react';
import { logicalDay } from '../../domain/dates';
import type { LogicalDay } from '../../domain/types';

/** The current logical day. Re-checked every 30 s and whenever the app becomes visible. */
export function useToday(rolloverHour: number): LogicalDay {
  const [today, setToday] = useState(() => logicalDay(new Date(), rolloverHour));
  useEffect(() => {
    const check = () => setToday(logicalDay(new Date(), rolloverHour));
    check();
    const id = window.setInterval(check, 30_000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, [rolloverHour]);
  return today;
}
