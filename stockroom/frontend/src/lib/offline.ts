// IndexedDB-based offline queue for Store app
// Captures mutations when offline and replays on reconnect

const DB_NAME = 'stockroom-offline';
const STORE_NAME = 'pending-ops';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export interface PendingOp {
  id?: number;
  url: string;
  method: string;
  body: object;
  timestamp: number;
}

export async function queueOp(op: Omit<PendingOp, 'id' | 'timestamp'>): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ ...op, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPendingOps(): Promise<PendingOp[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function removeOp(id: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function syncPendingOps(): Promise<{ synced: number; failed: number }> {
  const ops = await getPendingOps();
  let synced = 0, failed = 0;
  for (const op of ops) {
    try {
      const res = await fetch(op.url, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(op.body),
      });
      if (res.ok) {
        await removeOp(op.id!);
        synced++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }
  return { synced, failed };
}

export async function offlineFetch(url: string, options: RequestInit & { body?: any }): Promise<any> {
  if (navigator.onLine) {
    return fetch(url, options).then(r => r.json());
  }
  // Offline: queue and return optimistic response
  await queueOp({ url, method: options.method || 'POST', body: options.body });
  return { queued: true, message: 'Operation queued for sync when online' };
}
