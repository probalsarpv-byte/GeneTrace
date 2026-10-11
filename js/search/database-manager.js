// js/search/database-manager.js
// Lazy loading and caching for GeneTrace reference databases

export class DatabaseManager {
    constructor(basePath = 'data/reference') {
        this.basePath = basePath;
        this.cache = new Map(); // markerKey -> Array of reference records
        this.indices = new Map(); // markerKey -> Index metadata
        this.taxonomyIndex = null;
    }

    /**
     * Maps marker categories to folder and file names
     */
    getMarkerPathConfig(category) {
        const configs = {
            'bacteria-16s': { folder: 'bacteria/16s', index: 'bacteria-16s-index.json' },
            'archaea-16s': { folder: 'archaea/16s', index: 'archaea-16s-index.json' },
            'fungi-its': { folder: 'fungi/its', index: 'fungi-its-index.json' },
            'eukaryotes-18s': { folder: 'eukaryotes/18s', index: 'eukaryotes-18s-index.json' },
            'algae': { folder: 'algae', index: 'algae-index.json' },
            'viruses': { folder: 'viruses', index: 'viruses-index.json' },
            'phages': { folder: 'phages', index: 'phages-index.json' }
        };
        return configs[category] || null;
    }

    async fetchJson(relPath) {
        if (typeof window === 'undefined') {
            const fs = await import('fs');
            const path = await import('path');
            const fullPath = path.resolve(process.cwd(), relPath);
            return JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        } else {
            const resp = await fetch(relPath);
            if (!resp.ok) throw new Error(`HTTP ${resp.status} loading ${relPath}`);
            return await resp.json();
        }
    }

    /**
     * Loads the index and all chunks for a specific marker category on demand
     */
    async loadMarkerGroup(category) {
        if (this.cache.has(category)) {
            return this.cache.get(category);
        }

        const config = this.getMarkerPathConfig(category);
        if (!config) {
            console.warn(`Unknown marker category: ${category}`);
            return [];
        }

        try {
            // 1. Fetch index
            const indexPath = `${this.basePath}/${config.folder}/${config.index}`;
            const indexData = await this.fetchJson(indexPath);
            this.indices.set(category, indexData);

            // 2. Fetch chunks
            const allRecords = [];
            for (const chunkFile of indexData.chunks) {
                const chunkPath = `${this.basePath}/${config.folder}/${chunkFile}`;
                const chunkRecords = await this.fetchJson(chunkPath);
                allRecords.push(...chunkRecords);
            }

            this.cache.set(category, allRecords);
            return allRecords;
        } catch (err) {
            console.error(`Error loading reference database for ${category}:`, err);
            return [];
        }
    }

    /**
     * Loads the master taxonomy index
     */
    async loadTaxonomyIndex() {
        if (this.taxonomyIndex) return this.taxonomyIndex;
        try {
            const taxPath = `${this.basePath}/taxonomy/taxonomy-index.json`;
            this.taxonomyIndex = await this.fetchJson(taxPath);
            return this.taxonomyIndex;
        } catch (err) {
            console.error('Error loading taxonomy index:', err);
            return null;
        }
    }

    /**
     * Look up a reference record by ID across all cached datasets
     */
    getReferenceById(id) {
        for (const records of this.cache.values()) {
            const found = records.find(r => r.id === id);
            if (found) return found;
        }
        return null;
    }
}

// Future Backend Adapter interface
export class ReferenceSearchAdapter {
    async search(querySequence, options) {
        throw new Error('search() must be implemented by adapter');
    }
}
