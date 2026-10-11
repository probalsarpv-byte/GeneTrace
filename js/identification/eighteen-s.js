// js/identification/eighteen-s.js
// 18S Eukaryotic & Microalgal Identification Pipeline
import { searchReferences } from '../search/reference-search.js';
import { evaluateConfidence } from './confidence-engine.js';

export class EighteenSWorkflow {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    assess(sequenceObj, stats) {
        const type = sequenceObj?.type || 'DNA';
        const length = sequenceObj?.sequence?.length || stats?.length || 0;
        const warnings = [];
        let suitabilityScore = 100;
        
        if (type !== 'DNA') {
            warnings.push('18S analysis requires a DNA sequence.');
            return { suitable: false, suitabilityScore: 0, warnings, recommendation: 'Incorrect sequence type' };
        }
        
        if (length < 300 || length > 2500) {
            suitabilityScore -= 30;
            warnings.push('Length is outside typical 300-2500 bp range for 18S amplicons.');
        }

        return { 
            suitable: suitabilityScore > 0, 
            suitabilityScore,
            warnings, 
            recommendation: suitabilityScore >= 70 ? 'Proceed with 18S eukaryotic identification' : 'Consider alternative workflow'
        };
    }

    async runSearch(sequenceObj, stats) {
        const suitability = this.assess(sequenceObj, stats);
        // Load both microeukaryote and microalgal references
        const eukRefs = await this.dbManager.loadMarkerGroup('eukaryotes-18s');
        const algRefs = await this.dbManager.loadMarkerGroup('algae');
        const allRefs = [...eukRefs, ...algRefs];

        const candidates = searchReferences(sequenceObj.sequence, allRefs);
        const confidence = evaluateConfidence({
            sequenceObj,
            stats,
            suitability,
            candidates,
            markerType: '18S rRNA'
        });

        return {
            marker: '18S rRNA',
            domain: 'Eukaryota',
            suitability,
            candidates,
            confidence,
            topCandidate: candidates[0] || null
        };
    }

    getOrganismGroupForVisualization(candidate) {
        const name = candidate?.organism?.toLowerCase() || '';
        if (name.includes('chlamydomonas') || name.includes('chlorella') || name.includes('scenedesmus') || name.includes('volvox')) {
            return 'protozoan'; // or microalga
        }
        return 'protozoan';
    }
}
