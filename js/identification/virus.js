// js/identification/virus.js
// Viral Sequence Investigation Pipeline
import { searchReferences } from '../search/reference-search.js';
import { evaluateConfidence } from './confidence-engine.js';

export class VirusWorkflow {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    assess(sequenceObj, stats) {
        const type = sequenceObj?.type || 'DNA';
        const length = sequenceObj?.sequence?.length || stats?.length || 0;
        const gcPercent = stats?.gcPercent || 50;
        
        return {
            suitable: true,
            suitabilityScore: 90,
            hasCodingPotential: true, 
            gcProfile: gcPercent > 60 ? 'high' : (gcPercent < 40 ? 'low' : 'normal'),
            lengthClass: length < 5000 ? 'short' : (length < 30000 ? 'medium' : 'long'),
            warnings: [],
            recommendation: 'Proceed with viral diagnostic screening'
        };
    }

    async runSearch(sequenceObj, stats) {
        const suitability = this.assess(sequenceObj, stats);
        // Load both viral and bacteriophage reference sets
        const virRefs = await this.dbManager.loadMarkerGroup('viruses');
        const phaRefs = await this.dbManager.loadMarkerGroup('phages');
        const allRefs = [...virRefs, ...phaRefs];

        const candidates = searchReferences(sequenceObj.sequence, allRefs);
        const confidence = evaluateConfidence({
            sequenceObj,
            stats,
            suitability,
            candidates,
            markerType: 'Viral Diagnostic Region'
        });

        return {
            marker: 'Viral Diagnostic Region',
            domain: 'Viruses',
            suitability,
            candidates,
            confidence,
            topCandidate: candidates[0] || null
        };
    }

    getOrganismGroupForVisualization(candidate) {
        const name = candidate?.organism?.toLowerCase() || '';
        if (name.includes('phage') || name.includes('lambda') || name.includes('t4') || name.includes('phix')) {
            return 'bacteriophage';
        }
        return 'ssRNA-virus';
    }
}
