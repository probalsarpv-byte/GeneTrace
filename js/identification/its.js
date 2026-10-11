// js/identification/its.js
// ITS Fungal Molecular Identification Pipeline
import { searchReferences } from '../search/reference-search.js';
import { evaluateConfidence } from './confidence-engine.js';

export class ITSWorkflow {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    assess(sequenceObj, stats) {
        const type = sequenceObj?.type || 'DNA';
        const length = sequenceObj?.sequence?.length || stats?.length || 0;
        const warnings = [];
        let suitabilityScore = 100;
        
        if (type !== 'DNA') {
            warnings.push('ITS marker analysis requires a DNA sequence.');
            return { suitable: false, suitabilityScore: 0, warnings, recommendation: 'Incorrect sequence type' };
        }
        
        if (length < 200 || length > 1200) {
            suitabilityScore -= 30;
            warnings.push('Length is outside typical 200-1200 bp range for fungal ITS amplicons.');
        }

        return { 
            suitable: suitabilityScore > 0, 
            suitabilityScore,
            warnings, 
            recommendation: suitabilityScore >= 70 ? 'Proceed with fungal ITS identification' : 'Consider alternative workflow'
        };
    }

    async runSearch(sequenceObj, stats) {
        const suitability = this.assess(sequenceObj, stats);
        const refs = await this.dbManager.loadMarkerGroup('fungi-its');
        const candidates = searchReferences(sequenceObj.sequence, refs);
        const confidence = evaluateConfidence({
            sequenceObj,
            stats,
            suitability,
            candidates,
            markerType: 'ITS1-5.8S-ITS2'
        });

        return {
            marker: 'ITS1-5.8S-ITS2',
            domain: 'Fungi',
            suitability,
            candidates,
            confidence,
            topCandidate: candidates[0] || null
        };
    }

    getOrganismGroupForVisualization(candidate) {
        const name = candidate?.organism?.toLowerCase() || '';
        if (name.includes('saccharomyces') || name.includes('candida') || name.includes('cryptococcus') || name.includes('schizosaccharomyces')) {
            return 'yeast';
        }
        return 'filamentous-fungus';
    }
}
