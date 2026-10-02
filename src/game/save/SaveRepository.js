const DB_NAME = 'realms-of-pixel';
const STORE = 'profiles';

export class SaveRepository {
  constructor() { this.dbPromise = null; }
  open() {
    if (!globalThis.indexedDB) return Promise.resolve(null);
    if (!this.dbPromise) this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }
  async load() {
    try {
      const db = await this.open();
      if (!db) return this.loadFallback();
      const data = await this.request(db, 'readonly', (store) => store.get('local'));
      return data ?? this.loadFallback();
    } catch { return this.loadFallback(); }
  }
  async save(data) {
    try {
      const db = await this.open();
      if (!db) return this.saveFallback(data);
      await this.request(db, 'readwrite', (store) => store.put(data, 'local'));
      this.saveFallback(data);
      return true;
    } catch { return this.saveFallback(data); }
  }
  request(db, mode, action) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  loadFallback() { try { return JSON.parse(localStorage.getItem(DB_NAME) || 'null'); } catch { return null; } }
  saveFallback(data) { try { localStorage.setItem(DB_NAME, JSON.stringify(data)); return true; } catch { return false; } }
}
