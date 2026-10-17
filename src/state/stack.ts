import { create } from 'zustand';

import type { Db } from '@/db/client';
import { addToStack, getStackIds, removeFromStack } from '@/db/repository';

type StackState = {
  ids: string[];
  /** Bumped on every change so screens showing the full stack can refetch. */
  version: number;
  hydrate(db: Db): Promise<void>;
  toggle(db: Db, itemId: string): Promise<boolean>;
};

/** In-memory mirror of the `user_stack` table so "Add to stack" buttons update instantly. */
export const useStack = create<StackState>((set, get) => ({
  ids: [],
  version: 0,
  async hydrate(db) {
    set({ ids: await getStackIds(db) });
  },
  async toggle(db, itemId) {
    const adding = !get().ids.includes(itemId);
    set((s) => ({
      ids: adding ? [...s.ids, itemId] : s.ids.filter((id) => id !== itemId),
      version: s.version + 1,
    }));
    await (adding ? addToStack(db, itemId) : removeFromStack(db, itemId));
    return adding;
  },
}));
