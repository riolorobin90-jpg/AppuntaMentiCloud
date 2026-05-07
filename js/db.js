/**
 * IndexedDB engine for Image Storage
 */

export const ImageDB = {
  dbName: 'AppuntaMenti_Images',
  dbVersion: 1,
  db: null,

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);
      request.onerror = () => reject('IDB Error');
      request.onsuccess = (e) => { 
        this.db = e.target.result; 
        resolve(this.db); 
      };
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('images')) {
          db.createObjectStore('images', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  },

  async save(refId, type, base64) {
    await this.init();
    const tx = this.db.transaction('images', 'readwrite');
    const store = tx.objectStore('images');
    return new Promise(resolve => {
      store.add({ refId, type, data: base64, ts: Date.now() });
      tx.oncomplete = () => resolve();
    });
  },

  async getByRef(refId) {
    await this.init();
    const tx = this.db.transaction('images', 'readonly');
    const store = tx.objectStore('images');
    return new Promise(resolve => {
      const results = [];
      store.openCursor().onsuccess = (e) => {
        const cursor = e.target.result;
        if (cursor) {
          if (cursor.value.refId === refId) results.push(cursor.value);
          cursor.continue();
        } else resolve(results);
      };
    });
  },

  async delete(id) {
    await this.init();
    const tx = this.db.transaction('images', 'readwrite');
    tx.objectStore('images').delete(id);
    return new Promise(resolve => tx.oncomplete = () => resolve());
  }
};
