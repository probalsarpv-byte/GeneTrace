export class VirusWorkflow {
    constructor(analysisState) {
        this.analysisState = analysisState;
    }

    assess(sequenceObj, stats) {
        const type = sequenceObj?.type || 'DNA';
        const length = sequenceObj?.sequence?.length || stats?.length || 0;
        const gcPercent = stats?.gcPercent || 50;
        
        return {
            hasCodingPotential: true, 
            gcProfile: gcPercent > 60 ? 'high' : (gcPercent < 40 ? 'low' : 'normal'),
            lengthClass: length < 5000 ? 'short' : (length < 30000 ? 'medium' : 'long'),
            notes: 'Viral identification relies on diverse markers or whole genomes, not a single conserved gene like 16S.'
        };
    }
    
    searchStrategy() {
        return 'Viral sequence identification typically involves querying the full NCBI GenBank (nr/nt), ViPR (Virus Pathogen Database), or RVDB (Reference Viral DataBase).';
    }

    prepareSearch(sequence) {
        return {
            fasta: `>query\n${sequence}`,
            openNCBIBlast: () => 'https://blast.ncbi.nlm.nih.gov/Blast.cgi?PROGRAM=blastn&PAGE_TYPE=BlastSearch',
            openViPR: () => 'https://www.viprbrc.org/'
        };
    }

    assessConfidence(candidates) {
        if (!candidates || candidates.length === 0) {
            return { level: 'INSUFFICIENT', note: 'This tool is NOT for clinical diagnosis.' };
        }
        const topCandidate = candidates[0];
        if (topCandidate.identity >= 95.0) {
            return { level: 'MODERATE', note: 'Viral sequences are highly diverse; family-level placement suggested. This tool is NOT for clinical diagnosis.' };
        } else {
            return { level: 'LOW', note: 'Low similarity to known viral genomes. This tool is NOT for clinical diagnosis.' };
        }
    }

    getViralGroupForVisualization(topCandidate) {
        const name = topCandidate?.organism?.toLowerCase() || '';
        if (name.includes('phage')) return 'bacteriophage';
        if (name.includes('rna virus') || name.includes('coronavirus')) return 'ssRNA-virus';
        if (name.includes('dna virus') || name.includes('herpes')) return 'dsDNA-virus';
        if (name.includes('retro')) return 'retrovirus';
        return 'unknown-virus';
    }
}
