import { openDB, type DBSchema, type IDBPDatabase } from "idb";

export interface PendingChange {
  id?: number;
  chapter: number;
  section: number;
  completed: boolean;
  markedCompleteAt: string; // ISO timestamp, becomes p_marked_complete_at
}

export interface PendingPosition {
  chapter: number;
  section: number;
  updatedAt: string; // ISO timestamp, becomes p_updated_at
}

interface WCFDB extends DBSchema {
  pendingChanges: {
    key: number;
    value: PendingChange;
  };
  pendingPosition: {
    key: string;
    value: PendingPosition;
  };
}

const POSITION_KEY = "current";

let dbPromise: Promise<IDBPDatabase<WCFDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<WCFDB>("wcf-reading-tracker", 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore("pendingChanges", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
        if (oldVersion < 2) {
          // Out-of-line key (fixed POSITION_KEY) since only the single most
          // recent position matters -- a new write simply overwrites the
          // previous pending one, unlike ordered completion toggles.
          db.createObjectStore("pendingPosition");
        }
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

// SPEC.md §5.1: offline queue for the current reading position, mirroring
// addPendingChange/getPendingChanges above but as a single overwrite-latest
// slot rather than a list, since only the most recent position matters.
export async function setPendingPosition(position: PendingPosition) {
  const db = await getDB();
  await db.put("pendingPosition", position, POSITION_KEY);
}

export async function getPendingPosition(): Promise<PendingPosition | undefined> {
  const db = await getDB();
  return db.get("pendingPosition", POSITION_KEY);
}

export async function clearPendingPosition() {
  const db = await getDB();
  await db.delete("pendingPosition", POSITION_KEY);
}
