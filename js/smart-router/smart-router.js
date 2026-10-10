// smart-router.js - Rule-based workflow recommender
// Never makes definitive claims - only recommends workflows

const WORKFLOWS = {
    '16S': { id: '16S', name: '16S Identification Recommended', icon: '🦠' },
    'ITS': { id: 'ITS', name: 'ITS Fungal Analysis Suggested', icon: '🍄' },
    '18S': { id: '18S', name: '18S Eukaryotic Identification Suggested', icon: '🔬' },
    'virus': { id: 'virus', name: 'Virus Sequence Analysis Recommended', icon: '🧬' },
    'protein': { id: 'protein', name: 'Protein Sequence Analysis Suggested', icon: '🥩' },
    'genomic': { id: 'genomic', name: 'Genomic Fragment Analysis Recommended', icon: '🧩' },
    'insufficient': { id: 'insufficient', name: 'Insufficient Length Warning', icon: '⚠️' }
};

function analyzeAndRecommend(sequenceObj, validationResult, stats, orfData = null) {
    const recommendationsMap = {};
    const type = validationResult?.type || sequenceObj?.type || 'DNA';
    const length = stats?.length || sequenceObj?.sequence?.length || 0;
    const gcPercent = stats?.gcPercent || 50;

    function addScore(workflowId, score, reason) {
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

    if (type === 'Protein') {
        addScore('protein', 10, 'Sequence identified as Protein type');
    } else if (type === 'RNA') {
        addScore('virus', 2, 'RNA sequence may indicate viral genome or transcript');
    }

    if (length < 100) {
        addScore('insufficient', 10, 'Sequence is very short (<100bp), making identification difficult');
    } else if (length > 10000) {
        addScore('genomic', 10, 'Sequence is very long (>10000bp), likely a genomic fragment');
    }

    if (type === 'DNA' && length >= 200 && length <= 2000 && gcPercent >= 45 && gcPercent <= 65) {
        addScore('16S', 3, 'Length range consistent with 16S amplicon');
    }
    
    const seqUpper = (sequenceObj?.sequence || '').toUpperCase();
    if (seqUpper.includes('TATCGATCTGCCTGYCATCR') || seqUpper.includes('GTGCCAGC')) { // approximation of motif
        addScore('16S', 5, 'Contains conserved 16S primer site motifs');
    }

    if (type === 'DNA' && length >= 300 && length <= 900 && gcPercent >= 40 && gcPercent <= 55) {
        addScore('ITS', 2, 'Length consistent with ITS amplicon');
    }

    if (seqUpper.includes('CTTGGTCATTTAGAGGAAGTAA') || seqUpper.includes('GCTGCGTTCTTCATCGATGC')) {
        addScore('ITS', 4, 'Contains conserved ITS primer site motifs');
    }

    if (type === 'DNA' && length >= 500 && length <= 2000 && gcPercent >= 40 && gcPercent <= 60) {
        addScore('18S', 2, 'Length and GC% consistent with 18S amplicon');
    }

    if (length < 1000 && gcPercent > 60) {
        addScore('virus', 1, 'Length and high GC content might indicate viral fragment');
    }

    if (orfData && orfData.hasSubstantialOrfs) {
        addScore('protein', 3, 'Substantial coding potential detected');
    }

    const recommendations = Object.values(recommendationsMap).sort((a, b) => b.score - a.score);
    
    recommendations.forEach(rec => {
        if (rec.score >= 5) rec.confidence = 'HIGH';
        else if (rec.score >= 3) rec.confidence = 'MODERATE';
        else rec.confidence = 'LOW';
    });

    const primaryWorkflow = recommendations.length > 0 ? recommendations[0].id : 'unknown';
    const confidence = recommendations.length > 0 ? recommendations[0].confidence : 'LOW';

    return { recommendations, primaryWorkflow, confidence, reasoning: recommendations[0]?.reasoning || [] };
}

function getWorkflowById(id) {
    return WORKFLOWS[id] || null;
}

export { analyzeAndRecommend, WORKFLOWS, getWorkflowById };
