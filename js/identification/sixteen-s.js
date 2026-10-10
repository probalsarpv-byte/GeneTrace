export class SixteenSWorkflow {
    constructor(analysisState) {
        this.analysisState = analysisState;
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
            warnings.push('Length outside optimal 200-1800bp range.');
        }
        
        if (gc < 40 || gc > 70) {
            suitabilityScore -= 20;
            warnings.push('GC content outside typical 40-70% range for 16S.');
        }

        return { 
            suitable, 
            suitabilityScore, 
            warnings, 
            recommendation: suitable ? 'Proceed with 16S identification' : 'Consider alternative workflow' 
        };
    }

    prepareSearch(sequence) {
        return {
            fasta: sequence,
            getNCBIBlast16SUrl: () => 'https://blast.ncbi.nlm.nih.gov/Blast.cgi?PROGRAM=blastn&PAGE_TYPE=BlastSearch&DATABASE=16S_ribosomal_RNA_Bacteria_and_Archaea',
            getEzBioCloudUrl: () => 'https://www.ezbiocloud.net/identify',
            silvaSinaUrl: 'https://www.arb-silva.de/aligner/',
            status: 'ready'
        };
    }

    assessConfidence(candidates) {
        if (!candidates || candidates.length === 0) {
            return { level: 'INSUFFICIENT', note: 'No candidates provided. Polyphasic taxonomy required for formal species identification.' };
        }
        const topCandidate = candidates[0];
        if (topCandidate.identity >= 99.0) {
            return { level: 'MODERATE', note: 'EzBioCloud 99% threshold used for species-level suggestion. Polyphasic taxonomy required for formal species identification.' };
        } else if (topCandidate.identity >= 98.7) {
            return { level: 'LOW', note: 'Genus-level inference supported. Polyphasic taxonomy required for formal species identification.' };
        }
        return { level: 'INSUFFICIENT', note: 'Identity <98.7%. Insufficient for reliable genus or species identification.' };
    }

    buildEvidence(assessResult, candidates, confidence) {
        const evidence = [];
        if (candidates && candidates.length > 0) {
            evidence.push({
                category: 'SIMILARITY_STRENGTH',
                strength: confidence.level === 'MODERATE' ? 'STRONG' : 'WEAK',
                interpretation: `Top 16S match: ${candidates[0].organism} (${candidates[0].identity}% id)`,
                source: '16S Search'
            });
        }
        return evidence;
    }

    getOrganismGroupForVisualization(candidate) {
        const name = candidate?.organism?.toLowerCase() || '';
        if (name.includes('archaea') || name.includes('methano')) return 'archaea';
        if (name.includes('treponema') || name.includes('borrelia')) return 'spirochete';
        if (name.includes('bacillus') || name.includes('staphylococcus')) return 'gram-positive';
        if (name.includes('escherichia') || name.includes('pseudomonas')) return 'gram-negative';
        return 'bacterium';
    }
}
