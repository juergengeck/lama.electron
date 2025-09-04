/**
 * Local storage implementation for Electron using IndexedDB
 */
class LocalStorage {
    constructor(options = {}) {
        Object.defineProperty(this, "db", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: null
        });
        Object.defineProperty(this, "dbName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "version", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.dbName = options.dbName || 'lama-desktop';
        this.version = options.version || 1;
    }
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                // Create object stores
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('messages')) {
                    const messageStore = db.createObjectStore('messages', { keyPath: 'id' });
                    messageStore.createIndex('conversationId', 'conversationId', { unique: false });
                    messageStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                if (!db.objectStoreNames.contains('contacts')) {
                    db.createObjectStore('contacts', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('keys')) {
                    db.createObjectStore('keys', { keyPath: 'id' });
                }
            };
        });
    }
    async get(store, key) {
        if (!this.db)
            throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([store], 'readonly');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.get(key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || null);
        });
    }
    async put(store, value) {
        if (!this.db)
            throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([store], 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.put(value);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
    async delete(store, key) {
        if (!this.db)
            throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([store], 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.delete(key);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
    async getAll(store) {
        if (!this.db)
            throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([store], 'readonly');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.getAll();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });
    }
    async query(store, index, value) {
        if (!this.db)
            throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([store], 'readonly');
            const objectStore = transaction.objectStore(store);
            const idx = objectStore.index(index);
            const request = idx.getAll(value);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result || []);
        });
    }
    async clear(store) {
        if (!this.db)
            throw new Error('Database not initialized');
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([store], 'readwrite');
            const objectStore = transaction.objectStore(store);
            const request = objectStore.clear();
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }
}
export const storage = new LocalStorage();
