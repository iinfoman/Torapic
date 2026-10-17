import { DatabaseSync } from 'node:sqlite';

import type { Db } from '../src/db/client';

/** Adapts node:sqlite to the async expo-sqlite surface the repository uses. */
export function openTestDb(): Db {
  const db = new DatabaseSync(':memory:');
  const db_: Db = {
    async execAsync(source) {
      db.exec(source);
    },
    async runAsync(source, ...params) {
      return db.prepare(source).run(...(params as never[]));
    },
    async getFirstAsync<T>(source: string, ...params: unknown[]) {
      return (db.prepare(source).get(...(params as never[])) ?? null) as T | null;
    },
    async getAllAsync<T>(source: string, ...params: unknown[]) {
      return db.prepare(source).all(...(params as never[])) as T[];
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (e) {
        db.exec('ROLLBACK');
        throw e;
      }
    },
  };
  return db_;
}
