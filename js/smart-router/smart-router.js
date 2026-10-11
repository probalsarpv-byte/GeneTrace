// js/smart-router/smart-router.js
// Rule-based molecular workflow recommender
// Triage based on sequence type, length, GC profile, ORF coding density, and primer motifs.
// Never makes definitive claims - only provides evidence-based routing.

export const WORKFLOWS = {
    '16S': { id: '16S', name: '16S rRNA Bacterial Identification', icon: '🦠', targetView: 'id-16s' },
    'archaea': { id: 'archaea', name: '16S rRNA Archaeal Identification', icon: '♨️', targetView: 'id-archaea' },
    'ITS': { id: 'ITS', name: 'ITS Fungal Molecular Identification', icon: '🍄', targetView: 'id-its' },
    '18S': { id: '18S', name: '18S Eukaryotic & Microalgal Identification', icon: '🔬', targetView: 'id-18s' },
    'virus': { id: 'virus', name: 'Viral & Bacteriophage Investigation', icon: '☣️', targetView: 'id-virus' },
    'protein': { id: 'protein', name: 'Protein Sequence Analysis', icon: '🧪', targetView: 'analyze-protein' },
    'coding-gene': { id: 'coding-gene', name: 'Protein-Coding Gene Analysis', icon: '🧬', targetView: 'analyze-nucleotide' },
    'unknown': { id: 'unknown', name: 'Unknown Sequence Investigation Pipeline', icon: '❓', targetView: 'id-unknown' }
};

export function analyzeAndRecommend(sequenceObj, validationResult, stats, orfData = null) {
    const recommendationsMap = {};
    const type = validationResult?.type || sequenceObj?.type || 'DNA';
    const length = stats?.length || sequenceObj?.sequence?.length || 0;
    const gcPercent = stats?.gcPercent || 50;
    const seqUpper = (sequenceObj?.sequence || '').toUpperCase();

    function addScore(workflowId, score, reason) {
        if (!WORKFLOWS[workflowId]) return;
        if (!recommendationsMap[workflowId]) {
            recommendationsMap[workflowId] = { 
                ...WORKFLOWS[workflowId], 
                score: 0, 
                reasoning: [] 
            };
        }
        recommendationsMap[workflowId].score += score;
        if (reason) recommendationsMap[workflowId].reasoning.push(reason);
    }

    // 1. Protein Sequence
    if (type === 'Protein') {
        addScore('protein', 15, 'Input detected as amino acid / protein sequence.');
        return finalizeResults(recommendationsMap);
    }

    // 2. RNA Input
    if (type === 'RNA') {
        addScore('virus', 3, 'RNA input may represent viral genome, replicon, or cellular transcript.');
    }

    // 3. Length Warnings
    if (length < 100) {
        addScore('unknown', 10, 'Sequence is very short (<100 bp), insufficient for standard marker resolution.');
        return finalizeResults(recommendationsMap);
    }

    // 4. ORF & Coding Density (Crucial differentiator: rRNA/ITS are non-coding; genes have long ORFs)
    const orfs = orfData?.orfs || [];
    const maxOrfLen = orfs.reduce((max, o) => Math.max(max, o.lengthAa || 0), 0);
    const hasLongOrf = maxOrfLen >= 90;

    if (hasLongOrf) {
        addScore('coding-gene', 4, `Substantive open reading frame detected (${maxOrfLen} aa), consistent with protein-coding gene.`);
        addScore('virus', 2, 'Continuous open reading frames are typical in compact viral genomes.');
    } else {
        // Non-coding or low coding density favors structural RNAs (16S, ITS, 18S)
        addScore('16S', 1, 'Lack of dominant coding ORF is characteristic of ribosomal RNA.');
        addScore('ITS', 1, 'Non-coding profile is consistent with internal transcribed spacers.');
        addScore('18S', 1, 'Non-coding profile is consistent with eukaryotic 18S rRNA.');
    }

    // 5. Marker Primer Signatures (Strongest biological clues)
    // Bacterial 16S primer signatures: 27F, 515F, 1492R
    if (seqUpper.includes('AGAGTTTGATC') || seqUpper.includes('GTGCCAGC') || seqUpper.includes('GGTTACCTTGTTACGACTT') || seqUpper.includes('GAGTTTGATCATGGCTCAG')) {
        addScore('16S', 6, 'Sequence contains conserved bacterial 16S universal primer annealing motif.');
    }

    // Archaeal 16S primer signatures
    if (seqUpper.includes('TTCCGGTTGATCC') || seqUpper.includes('ACGGGCGGTGW') || seqUpper.includes('GGTGGCCAG') || seqUpper.includes('TACCTGGTTGATCC')) {
        addScore('archaea', 6, 'Contains diagnostic archaeal 16S rRNA motif signatures.');
    }

    // Fungal ITS signatures: ITS1-F, ITS4, 5.8S core
    if (seqUpper.includes('CTTGGTCATTTAGAGG') || seqUpper.includes('TCCTCCGCTTATTGATATGC') || seqUpper.includes('GCATCGATGAAGAACGC') || seqUpper.includes('GCTGCGTTCTTCATCGATGC')) {
        addScore('ITS', 6, 'Contains conserved fungal ITS ribosomal primer motif (ITS1 / 5.8S / ITS4).');
    }

    // Eukaryotic 18S signatures: NS1, NS8
    if (seqUpper.includes('AACCTGGTTGATCCTGCCAGT') || seqUpper.includes('TGATCCTTCTGCAGGTTCACCTAC') || seqUpper.includes('CAGCAGCCGCGGTAATTC')) {
        addScore('18S', 6, 'Contains conserved eukaryotic 18S universal primer motif.');
    }

    // Viral / Bacteriophage cues
    if (seqUpper.includes('AGGAGGT') || seqUpper.includes('GATGATGAT') || (length >= 1000 && length <= 5000 && hasLongOrf && gcPercent > 48)) {
        addScore('virus', 2, 'Coding density and sequence characteristics consistent with viral / phage locus.');
    }

    // 6. Length and GC profile support (Never definitive alone, but contributory)
    if (!hasLongOrf) {
        if (length >= 300 && length <= 900 && gcPercent >= 38 && gcPercent <= 58) {
            addScore('ITS', 2, 'Amplicon length (300-900 bp) and GC% are typical for fungal ITS barcoding.');
        }
        if (length >= 400 && length <= 1700 && gcPercent >= 45 && gcPercent <= 65) {
            addScore('16S', 2, 'Length (400-1700 bp) and balanced GC% are consistent with 16S rRNA amplicons.');
        }
        if (length >= 500 && length <= 2000 && gcPercent >= 40 && gcPercent <= 60) {
            addScore('18S', 2, 'Length and GC content align with eukaryotic 18S ribosomal markers.');
        }
    }

    // Fallback: If no workflow scored >= 3, include unknown
    addScore('unknown', 1, 'Multi-stage diagnostic investigation available for uncharacterized sequences.');

    return finalizeResults(recommendationsMap);
}

function finalizeResults(recommendationsMap) {
    const recommendations = Object.values(recommendationsMap).sort((a, b) => b.score - a.score);

    recommendations.forEach(rec => {
        if (rec.score >= 5) rec.confidence = 'HIGH';
        else if (rec.score >= 3) rec.confidence = 'MODERATE';
        else rec.confidence = 'LOW';
    });

    const primaryWorkflow = recommendations.length > 0 ? recommendations[0].id : 'unknown';
    const confidence = recommendations.length > 0 ? recommendations[0].confidence : 'LOW';

    return { 
        recommendations, 
        primaryWorkflow, 
        confidence, 
        reasoning: recommendations[0]?.reasoning || [] 
    };
}

export function getWorkflowById(id) {
    return WORKFLOWS[id] || null;
}
