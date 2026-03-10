export const db = {
  async init() {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('DocumentExamplesDB', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('examples');
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
  async get(key: string): Promise<string | null> {
    const dbInstance = await this.init();
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('examples', 'readonly');
      const store = tx.objectStore('examples');
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  },
  async set(key: string, value: string): Promise<void> {
    const dbInstance = await this.init();
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('examples', 'readwrite');
      const store = tx.objectStore('examples');
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },
  async remove(key: string): Promise<void> {
    const dbInstance = await this.init();
    return new Promise((resolve, reject) => {
      const tx = dbInstance.transaction('examples', 'readwrite');
      const store = tx.objectStore('examples');
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
};
