import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface PendingChange {
  id?: number;
  chapter: number;
  section: number;
  completed: boolean;
  markedCompleteAt: string; // ISO timestamp, becomes p_marked_complete_at
}

interface WCFDB extends DBSchema {
  pendingChanges: {
    key: number;
    value: PendingChange;
  };
}

let dbPromise: Promise<IDBPDatabase<WCFDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<WCFDB>("wcf-reading-tracker", 1, {
      upgrade(db) {
        db.createObjectStore("pendingChanges", {
          keyPath: "id",
          autoIncrement: true,
        });
      },
    });
  }
  return dbPromise;
}

// SPEC.md §3.2/§6: offline queue for marks made while disconnected, flushed
// on reconnect. One row per attempted change, in the order they happened --
// the server (mark_section_complete's last-write-wins) resolves conflicts,
// this queue just guarantees delivery.
export async function addPendingChange(change: Omit<PendingChange, "id">) {
  const db = await getDB();
  await db.add("pendingChanges", change as PendingChange);
}

export async function getPendingChanges(): Promise<PendingChange[]> {
  const db = await getDB();
  return db.getAll("pendingChanges");
}

export async function removePendingChange(id: number) {
  const db = await getDB();
  await db.delete("pendingChanges", id);
}

// SPEC.md §7 "Reset During Sync": clear the queue so nothing queued before
// the reset gets replayed after it.
export async function clearPendingChanges() {
  const db = await getDB();
  await db.clear("pendingChanges");
}
