// 16s-workflow.js
// Basic identification logic

export function evaluate16S(sequence, stats) {
    let confidence = 'INSUFFICIENT';
    const reasons = [];

    // Length check
    if (stats.length > 1300 && stats.length < 1600) {
        reasons.push('Length is consistent with near-full-length 16S rRNA gene (~1.5 kb).');
        confidence = 'MODERATE'; // Requires BLAST to be High
    } else if (stats.length > 300 && stats.length <= 1300) {
        reasons.push('Length is consistent with a partial 16S rRNA gene amplicon.');
        confidence = 'LOW';
    } else {
        reasons.push('Length is not typical for 16S rRNA amplicon or full gene.');
    }

    // GC check - typical for bacteria is wide (20-75%), but we can just note it
    reasons.push(`GC content is ${stats.gcPercentage.toFixed(1)}%.`);

    return {
        confidence,
        reasons,
        recommendation: "Run NCBI BLASTn against the 16S ribosomal RNA (Bacteria and Archaea) database for definitive taxonomic identification."
    };
}
