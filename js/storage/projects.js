// projects.js - IndexedDB Project & Sample Persistence
import { getDB } from './indexeddb.js';

export async function createProject(name, description = '') {
    const db = await getDB();
    const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    
    const project = {
        id,
        name: name || 'Untitled Project',
        description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readwrite');
        const store = tx.objectStore('projects');
        const request = store.add(project);
        
        request.onsuccess = () => resolve(project);
        request.onerror = () => reject(request.error);
    });
}

export async function getAllProjects() {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function getProject(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('projects', 'readonly');
        const store = tx.objectStore('projects');
        const request = store.get(id);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteProject(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['projects', 'samples'], 'readwrite');
        const projStore = tx.objectStore('projects');
        const sampleStore = tx.objectStore('samples');
        
        projStore.delete(id);

        // Delete associated samples
        const sampleIndex = sampleStore.index('projectId');
        const req = sampleIndex.getAllKeys(id);
        req.onsuccess = () => {
            (req.result || []).forEach(k => sampleStore.delete(k));
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
    });
}

export async function saveSample(projectId, sampleData) {
    const db = await getDB();
    const id = sampleData.id || ('samp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6));
    
    const sample = {
        id,
        projectId,
        name: sampleData.name || 'Unnamed Sample',
        sequence: sampleData.sequence || '',
        type: sampleData.type || 'DNA',
        stats: sampleData.stats || null,
        validation: sampleData.validation || null,
        savedAt: new Date().toISOString()
    };

    return new Promise((resolve, reject) => {
        const tx = db.transaction('samples', 'readwrite');
        const store = tx.objectStore('samples');
        const request = store.put(sample);

        request.onsuccess = () => resolve(sample);
        request.onerror = () => reject(request.error);
    });
}

export async function getSamples(projectId) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('samples', 'readonly');
        const store = tx.objectStore('samples');
        const index = store.index('projectId');
        const request = index.getAll(projectId);

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

export async function deleteSample(id) {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction('samples', 'readwrite');
        const store = tx.objectStore('samples');
        const request = store.delete(id);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
    });
}

export async function exportProject(projectId) {
    const proj = await getProject(projectId);
    if (!proj) throw new Error('Project not found');
    const samples = await getSamples(projectId);

    return {
        format: 'genetrace-project-v1',
        exportedAt: new Date().toISOString(),
        project: proj,
        samples: samples
    };
}

export async function importProject(projectJson) {
    const db = await getDB();
    if (!projectJson || !projectJson.project) {
        throw new Error('Invalid project file format');
    }

    const { project, samples } = projectJson;
    
    return new Promise((resolve, reject) => {
        const tx = db.transaction(['projects', 'samples'], 'readwrite');
        const projStore = tx.objectStore('projects');
        const sampleStore = tx.objectStore('samples');

        projStore.put(project);
        if (Array.isArray(samples)) {
            samples.forEach(s => sampleStore.put(s));
        }

        tx.oncomplete = () => resolve({ project, count: samples ? samples.length : 0 });
        tx.onerror = () => reject(tx.error);
    });
}
