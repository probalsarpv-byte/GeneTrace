// js/identification/archaea.js
// Dedicated 16S rRNA Archaeal Identification Pipeline
import { searchReferences } from '../search/reference-search.js';
import { evaluateConfidence } from './confidence-engine.js';

export class ArchaeaWorkflow {
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
            warnings.push('Length outside optimal 200-1800 bp range for 16S amplicons.');
        }
        
        if (gc < 35 || gc > 75) {
            suitabilityScore -= 20;
            warnings.push('GC content outside typical 35-75% range for archaeal 16S.');
        }

        return { 
            suitable, 
            suitabilityScore, 
            warnings, 
            recommendation: suitable ? 'Proceed with Archaeal 16S identification' : 'Consider alternative workflow' 
        };
    }

    async runSearch(sequenceObj, stats) {
        const suitability = this.assess(sequenceObj, stats);
        const refs = await this.dbManager.loadMarkerGroup('archaea-16s');
        const candidates = searchReferences(sequenceObj.sequence, refs);
        const confidence = evaluateConfidence({
            sequenceObj,
            stats,
            suitability,
            candidates,
            markerType: '16S rRNA (Archaeal)'
        });

        return {
            marker: '16S rRNA (Archaeal)',
            domain: 'Archaea',
            suitability,
            candidates,
            confidence,
            topCandidate: candidates[0] || null
        };
    }

    getOrganismGroupForVisualization(candidate) {
        return 'archaea';
    }
}
