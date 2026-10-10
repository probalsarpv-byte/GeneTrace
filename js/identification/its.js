export class ITSWorkflow {
    constructor(analysisState) {
        this.analysisState = analysisState;
    }

    assess(sequenceObj, stats) {
        const type = sequenceObj?.type || 'DNA';
        const length = sequenceObj?.sequence?.length || stats?.length || 0;
        const warnings = [];
        let info = 'Sequence is suitable for ITS analysis.';
        
        if (type !== 'DNA') {
            warnings.push('ITS analysis is typically for DNA sequences.');
            return { suitable: false, warnings, info: 'Incorrect sequence type.' };
        }
        
        if (length < 200 || length > 900) {
            warnings.push('Length is outside the recommended 200-900bp range for ITS amplicons.');
        }

        return { 
            suitable: true, 
            warnings, 
            info 
        };
    }

    runExternalSearch(sequence) {
        const state = { status: 'ready', database: 'ITS_RefSeq_Fungi', program: 'blastn' };
        
        return {
            state,
            copyFasta: () => sequence,
            openNCBIBlast: () => 'https://blast.ncbi.nlm.nih.gov/Blast.cgi?PROGRAM=blastn&PAGE_TYPE=BlastSearch&DATABASE=ITS_RefSeq_Fungi',
            openMycoBank: () => 'https://www.mycobank.org/',
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
            return { level: 'INSUFFICIENT EVIDENCE', note: 'ITS species delimitation requires careful evaluation.' };
        }
        const topCandidate = candidates[0];
        if (topCandidate.identity >= 99.0 && topCandidate.coverage > 95) {
            return { level: 'MODERATE', note: 'High identity alone does not confirm species. ITS species delimitation varies by fungal group.' };
        } else if (topCandidate.identity >= 97.0) {
            return { level: 'LOW', note: 'Genus-level identification supported. ITS species delimitation requires higher similarity or polyphasic data.' };
        }
        return { level: 'INSUFFICIENT EVIDENCE', note: 'Identity <97%. Insufficient evidence for genus or species identification.' };
    }

    getOrganismGroupForVisualization(topCandidate) {
        const name = topCandidate?.organism?.toLowerCase() || '';
        if (name.includes('saccharomyces') || name.includes('candida')) return 'yeast';
        if (name.includes('aspergillus') || name.includes('penicillium')) return 'mold';
        if (name.includes('agaricus') || name.includes('basidiomycota')) return 'basidiomycete';
        if (name.includes('fungus')) return 'filamentous-fungus';
        return 'unknown-fungus';
    }

    buildEvidence(assessResult, candidates, confidence) {
        const evidence = [];
        if (candidates.length > 0) {
            evidence.push({
                category: 'SIMILARITY_STRENGTH',
                strength: confidence.level === 'MODERATE' ? 'MODERATE' : 'WEAK',
                interpretation: `Top match: ${candidates[0].organism} (${candidates[0].identity}% id)`,
                source: 'ITS BLAST'
            });
        }
        return evidence;
    }
}
