import type { SQLiteBindValue } from 'expo-sqlite';

/**
 * The subset of expo-sqlite's SQLiteDatabase that Torapic uses. Keeping the
 * repository on this interface lets tests run it against node:sqlite.
 */
export type Db = {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: SQLiteBindValue[]): Promise<unknown>;
  getFirstAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T | null>;
  getAllAsync<T>(source: string, ...params: SQLiteBindValue[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
};

export const DATABASE_NAME = 'torapic.db';
