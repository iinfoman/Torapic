import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import type { Db } from '@/db/client';

/**
 * Runs a local-database query and re-runs it when `deps` (primitives) change.
 * The previous result stays visible while the next one loads, and stale
 * responses are dropped, so fast typing never flickers.
 */
export function useDbQuery<T>(query: (db: Db) => Promise<T>, deps: unknown[]): { data: T | undefined; loading: boolean } {
  const db = useSQLiteContext();
  const key = JSON.stringify(deps);
  const [result, setResult] = useState<{ key: string; data: T | undefined } | null>(null);

  useEffect(() => {
    let cancelled = false;
    query(db).then(
      (data) => !cancelled && setResult({ key, data }),
      (error) => {
        console.warn('[db]', error);
        if (!cancelled) setResult({ key, data: undefined });
      }
    );
    return () => {
      cancelled = true;
    };
    // `query` is usually an inline closure; `key` captures everything it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, key]);

  return { data: result?.data, loading: result?.key !== key };
}
