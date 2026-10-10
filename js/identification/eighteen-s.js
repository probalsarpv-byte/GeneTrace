export class EighteenSWorkflow {
    constructor(analysisState) {
        this.analysisState = analysisState;
    }

    assess(sequenceObj, stats) {
        const type = sequenceObj?.type || 'DNA';
        const length = sequenceObj?.sequence?.length || stats?.length || 0;
        const warnings = [];
        let info = 'Sequence is suitable for 18S analysis (protozoa, microalgae, etc).';
        
        if (type !== 'DNA') {
            warnings.push('18S analysis is typically for DNA sequences.');
            return { suitable: false, warnings, info: 'Incorrect sequence type.' };
        }
        
        if (length < 500 || length > 2000) {
            warnings.push('Length is outside the typical 500-2000bp range for 18S amplicons.');
        }

        return { 
            suitable: true, 
            warnings, 
            info 
        };
    }

    runExternalSearch(sequence) {
        const state = { status: 'ready', database: '18S_ribosomal_RNA', program: 'blastn' };
        
        return {
            state,
            copyFasta: () => sequence,
            openNCBIBlast: () => 'https://blast.ncbi.nlm.nih.gov/Blast.cgi?PROGRAM=blastn&PAGE_TYPE=BlastSearch',
            statusOptions: ['not_run', 'external_service_opened', 'results_manual']
        };
    }

    buildCandidates(manualInput) {
        if (!manualInput) return [];
        const lines = manualInput.trim().split('\n');
        return lines.map(line => {
            const [accession, organism, identity, coverage] = line.split('\t');
            return { accession, organism, identity: parseFloat(identity), coverage: parseFloat(coverage) };
        }).filter(c => c.accession && !isNaN(c.identity));
    }

    assessConfidence(candidates) {
        if (!candidates || candidates.length === 0) {
            return { level: 'INSUFFICIENT EVIDENCE', note: '18S sequence matching required.' };
        }
        const topCandidate = candidates[0];
        if (topCandidate.identity >= 99.0) {
            return { level: 'MODERATE', note: '18S is less discriminating than ITS at species level for many groups. Genus or Family level may be more accurate.' };
        } else if (topCandidate.identity >= 97.0) {
            return { level: 'LOW', note: 'Family or Order level identification supported.' };
        }
        return { level: 'INSUFFICIENT EVIDENCE', note: 'Identity <97%. Insufficient evidence.' };
    }

    getOrganismGroupForVisualization(topCandidate) {
        const name = topCandidate?.organism?.toLowerCase() || '';
        if (name.includes('plasmodium') || name.includes('protozoa')) return 'protozoan';
        if (name.includes('algae') || name.includes('chlorella')) return 'microalgae';
        if (name.includes('amoeba')) return 'amoeba';
        if (name.includes('paramecium')) return 'ciliate';
        return 'unknown-eukaryote';
    }

    buildEvidence(assessResult, candidates, confidence) {
        const evidence = [];
        if (candidates.length > 0) {
            evidence.push({
                category: 'SIMILARITY_STRENGTH',
                strength: confidence.level === 'MODERATE' ? 'MODERATE' : 'WEAK',
                interpretation: `Top match: ${candidates[0].organism} (${candidates[0].identity}% id)`,
                source: '18S BLAST'
            });
        }
        return evidence;
    }
}
