// indexeddb.js
// Basic wrapper for IndexedDB

const DB_NAME = 'GeneTraceDB';
const DB_VERSION = 1;

export async function getDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('projects')) {
                const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
                projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('samples')) {
                const sampleStore = db.createObjectStore('samples', { keyPath: 'id' });
                sampleStore.createIndex('projectId', 'projectId', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('history')) {
                const historyStore = db.createObjectStore('history', { keyPath: 'id' });
                historyStore.createIndex('projectId', 'projectId', { unique: false });
                historyStore.createIndex('sampleId', 'sampleId', { unique: false });
            }
        };
    });
}
