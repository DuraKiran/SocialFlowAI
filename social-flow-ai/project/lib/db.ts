const DB_NAME = 'socialflow';
const DB_VERSION = 1;

export const STORES = [
  'users',
  'workspaces',
  'team_members',
  'social_accounts',
  'media_files',
  'ai_generations',
  'posts',
  'analytics_snapshots',
  'notifications',
  'subscriptions',
] as const;

export type StoreName = (typeof STORES)[number];

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only available in the browser'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('users')) {
          const s = db.createObjectStore('users', { keyPath: 'id' });
          s.createIndex('email', 'email', { unique: true });
        }
        const ws = db.createObjectStore('workspaces', { keyPath: 'id' });
        ws.createIndex('ownerId', 'ownerId');
        const tm = db.createObjectStore('team_members', { keyPath: 'id' });
        tm.createIndex('userId', 'user_id');
        tm.createIndex('workspaceId', 'workspace_id');
        const sa = db.createObjectStore('social_accounts', { keyPath: 'id' });
        sa.createIndex('workspaceId', 'workspaceId');
        const mf = db.createObjectStore('media_files', { keyPath: 'id' });
        mf.createIndex('workspaceId', 'workspaceId');
        const ai = db.createObjectStore('ai_generations', { keyPath: 'id' });
        ai.createIndex('workspaceId', 'workspaceId');
        ai.createIndex('mediaFileId', 'mediaFileId');
        const po = db.createObjectStore('posts', { keyPath: 'id' });
        po.createIndex('workspaceId', 'workspaceId');
        po.createIndex('mediaFileId', 'mediaFileId');
        po.createIndex('status', 'status');
        po.createIndex('scheduledAt', 'scheduledAt');
        const an = db.createObjectStore('analytics_snapshots', { keyPath: 'id' });
        an.createIndex('postId', 'postId');
        an.createIndex('workspaceId', 'workspaceId');
        const no = db.createObjectStore('notifications', { keyPath: 'id' });
        no.createIndex('userId', 'userId');
        db.createObjectStore('subscriptions', { keyPath: 'id' });
        void db; // keep reference alive
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('Failed to open database'));
    });
  }
  return dbPromise;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Database request failed'));
  });
}

export async function putRecord<T>(store: StoreName, value: T): Promise<T> {
  const db = await openDb();
  return wrap(db.transaction(store, 'readwrite').objectStore(store).put(value)) as Promise<T>;
}

export async function getRecord<T>(store: StoreName, id: string): Promise<T | undefined> {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).get(id)) as Promise<T | undefined>;
}

export async function getAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return wrap(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
}

export async function getByIndex<T>(
  store: StoreName,
  index: string,
  value: IDBValidKey
): Promise<T[]> {
  const db = await openDb();
  return wrap(
    db.transaction(store).objectStore(store).index(index).getAll(value)
  ) as Promise<T[]>;
}

export async function deleteRecord(store: StoreName, id: string): Promise<void> {
  const db = await openDb();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('Delete failed'));
  });
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}
