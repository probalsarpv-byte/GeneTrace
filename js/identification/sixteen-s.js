// js/identification/sixteen-s.js
// 16S rRNA Bacterial Identification Pipeline
import { searchReferences } from '../search/reference-search.js';
import { evaluateConfidence } from './confidence-engine.js';

export class SixteenSWorkflow {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    assess(sequenceObj, stats) {
        const type = sequenceObj?.type || 'DNA';
        const length = sequenceObj?.sequence?.length || stats?.length || 0;
        const gc = stats?.gcPercent || 50;
        
        let suitable = true;
        let suitabilityScore = 100;
        const warnings = [];
        
        if (type !== 'DNA') {
            suitable = false;
            suitabilityScore = 0;
            warnings.push('16S rRNA must be a DNA sequence.');
        }
        
        if (length < 200 || length > 1800) {
            suitabilityScore -= 30;
            warnings.push('Length outside optimal 200-1800 bp range.');
        }
        
        if (gc < 40 || gc > 70) {
            suitabilityScore -= 20;
            warnings.push('GC content outside typical 40-70% range for bacterial 16S.');
        }

        return { 
            suitable, 
            suitabilityScore, 
            warnings, 
            recommendation: suitable ? 'Proceed with 16S bacterial identification' : 'Consider alternative workflow' 
        };
    }

    async runSearch(sequenceObj, stats) {
        const suitability = this.assess(sequenceObj, stats);
        const refs = await this.dbManager.loadMarkerGroup('bacteria-16s');
        const candidates = searchReferences(sequenceObj.sequence, refs);
        const confidence = evaluateConfidence({
            sequenceObj,
            stats,
            suitability,
            candidates,
            markerType: '16S rRNA'
        });

        return {
            marker: '16S rRNA',
            domain: 'Bacteria',
            suitability,
            candidates,
            confidence,
            topCandidate: candidates[0] || null
        };
    }

    getOrganismGroupForVisualization(candidate) {
        const name = candidate?.organism?.toLowerCase() || '';
        if (name.includes('bacillus') || name.includes('staphylococcus') || name.includes('streptococcus') || name.includes('lactobacillus')) {
            return 'gram-positive';
        }
        return 'bacterium';
    }
}
