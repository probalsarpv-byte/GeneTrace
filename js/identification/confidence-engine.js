// js/identification/confidence-engine.js
// Evaluates scientific confidence for GeneTrace molecular identification

export function evaluateConfidence({
    sequenceObj,
    stats,
    suitability,
    candidates,
    markerType
}) {
    if (!candidates || candidates.length === 0) {
        return {
            level: 'INSUFFICIENT EVIDENCE',
            title: 'No Reference Match',
            reasons: [
                'No reference in the current GeneTrace database met the minimum similarity threshold (>=70% identity).',
                'The sequence may represent an uncataloged taxon, a different genetic locus, or an untargeted genomic fragment.'
            ],
            limitations: [
                'Database scope is limited to curated type and reference strains.',
                'Organism identification cannot be assigned without reference alignment.'
            ]
        };
    }

    const top = candidates[0];
    const identity = top.identity;
    const coverage = top.coverage;
    const seqLen = sequenceObj?.sequence?.length || stats?.length || 0;
    const ambigPct = stats?.ambiguousPercent || 0;
    const suitabilityScore = suitability?.suitabilityScore ?? 100;

    const reasons = [];
    const limitations = [];

    // 1. Sequence Integrity Assessment
    if (ambigPct > 2) {
        reasons.push(`Sequence contains ${ambigPct.toFixed(1)}% ambiguous IUPAC bases, reducing base call certainty.`);
    } else {
        reasons.push(`Sequence integrity is high (${seqLen} bp, <1% ambiguous bases).`);
    }

    // 2. Marker Suitability
    if (suitabilityScore >= 80) {
        reasons.push(`Marker suitability is validated for ${markerType} (${suitabilityScore}/100).`);
    } else {
        reasons.push(`Marker suitability warnings: ${(suitability?.warnings || []).join('; ') || 'Sub-optimal length or GC profile.'}`);
    }

    // 3. Similarity & Coverage Evaluation
    reasons.push(`Top reference similarity: ${identity.toFixed(1)}% identity across ${top.alignmentLength} bp aligned window.`);
    reasons.push(`Query coverage: ${coverage.toFixed(1)}% of query sequence aligns to reference ${top.accession}.`);

    // 4. Taxonomic Consistency among top hits
    if (candidates.length >= 2) {
        const topGenus = top.taxonomy?.genus;
        const secondGenus = candidates[1].taxonomy?.genus;
        if (topGenus && secondGenus && topGenus === secondGenus) {
            reasons.push(`Top candidate matches consistently belong to genus ${topGenus}.`);
        } else if (topGenus && secondGenus) {
            reasons.push(`Top candidates span divergent genera (${topGenus} vs ${secondGenus}), suggesting borderline marker divergence.`);
        }
    }

    // 5. Scientific Limitations
    if (markerType.includes('16S')) {
        limitations.push('EzBioCloud benchmarks suggest 98.7% for genus and 99.0% for species boundaries.');
        limitations.push('Closely related bacterial species can harbor identical or near-identical 16S copies (e.g. Bacillus cereus group).');
        limitations.push('Full phenotypic, biochemical, or whole-genome average nucleotide identity (ANI) is required for definitive species confirmation.');
    } else if (markerType.includes('ITS')) {
        limitations.push('Fungal ITS alleles may be shared across cryptic species complexes (e.g. Candida, Aspergillus).');
        limitations.push('Intragenomic ITS paralogs may be present within single fungal genomes.');
        limitations.push('Secondary barcoding markers (TEF1-alpha, RPB2) are recommended for resolving species complexes.');
    } else if (markerType.includes('18S')) {
        limitations.push('18S rRNA evolves slower than ITS and often provides robust genus-level, but limited species-level, discrimination.');
    } else if (markerType.includes('Viral') || markerType.includes('Phage')) {
        limitations.push('RNA virus and phage mutation rates can cause rapid local divergence.');
        limitations.push('GeneTrace is intended for bioinformatic screening only, strictly not for clinical diagnostic or patient reporting.');
    }

    // 6. Level Determination
    let level = 'LOW';
    if (identity >= 99.0 && coverage >= 95.0 && ambigPct < 1 && suitabilityScore >= 80) {
        level = 'HIGH';
    } else if (identity >= 98.0 && coverage >= 85.0 && suitabilityScore >= 60) {
        level = 'MODERATE';
    } else if (identity >= 80.0 && coverage >= 60.0) {
        level = 'LOW';
    } else {
        level = 'INSUFFICIENT EVIDENCE';
    }

    return {
        level,
        title: `${level} Confidence Identification`,
        identity,
        coverage,
        reasons,
        limitations
    };
}
