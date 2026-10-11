// js/search/reference-search.js
// GeneTrace Reference Search: Client-side sequence similarity engine

/**
 * Generates a frequency map or Set of k-mers from a nucleotide sequence
 */
export function extractKmers(seq, k = 7) {
    const kmers = new Map();
    const clean = seq.toUpperCase();
    for (let i = 0; i <= clean.length - k; i++) {
        const kmer = clean.substring(i, i + k);
        kmers.set(kmer, (kmers.get(kmer) || 0) + 1);
    }
    return kmers;
}

/**
 * Computes k-mer similarity score (cosine or shared fraction) between query and reference
 */
export function calculateKmerScore(queryKmers, refKmers, queryLength, refLength) {
    if (queryKmers.size === 0 || refKmers.size === 0) return 0;
    let sharedCount = 0;
    for (const [kmer, count] of queryKmers.entries()) {
        if (refKmers.has(kmer)) {
            sharedCount += Math.min(count, refKmers.get(kmer));
        }
    }
    const minLen = Math.min(queryLength, refLength);
    return minLen > 0 ? sharedCount / minLen : 0;
}

/**
 * Candidate Pre-filtering: Ranks references by k-mer similarity
 */
export function prefilterCandidates(querySeq, referenceRecords, k = 7, topN = 6) {
    const qClean = querySeq.toUpperCase();
    const queryKmers = extractKmers(qClean, k);
    if (queryKmers.size === 0) return [];

    const scored = [];
    for (const record of referenceRecords) {
        const rSeq = (record.sequence || '').toUpperCase();
        if (rSeq.length < k) continue;
        const refKmers = extractKmers(rSeq, k);
        const kmerScore = calculateKmerScore(queryKmers, refKmers, qClean.length, rSeq.length);
        if (kmerScore > 0.02) { // Minimum k-mer presence threshold
            scored.push({ record, kmerScore });
        }
    }

    scored.sort((a, b) => b.kmerScore - a.kmerScore);
    return scored.slice(0, topN).map(s => s.record);
}

/**
 * Semi-global pairwise sequence alignment (Needleman-Wunsch with free end gaps)
 * Allows amplicons or fragments to align against full-length reference genes.
 */
export function pairwiseAlign(querySeq, refSeq, matchScore = 2, mismatchPenalty = -1, gapPenalty = -2) {
    const q = querySeq.toUpperCase();
    const r = refSeq.toUpperCase();
    const n = q.length;
    const m = r.length;

    if (n === 0 || m === 0) {
        return null;
    }

    // Allocate score matrix (Flat Float32Array for high performance & memory efficiency)
    // Row: 0..n (Query), Col: 0..m (Reference)
    const cols = m + 1;
    const matrix = new Int32Array((n + 1) * cols);

    // Free end gaps at start: first row is 0 so query can align anywhere in reference without penalty
    // First column: penalized so full query is aligned against reference
    for (let i = 0; i <= n; i++) {
        matrix[i * cols] = i * gapPenalty;
    }
    for (let j = 0; j <= m; j++) {
        matrix[j] = 0; // free start on reference
    }

    // Fill Matrix
    for (let i = 1; i <= n; i++) {
        const qChar = q[i - 1];
        const rowOffset = i * cols;
        const prevRowOffset = (i - 1) * cols;

        for (let j = 1; j <= m; j++) {
            const rChar = r[j - 1];
            const isMatch = (qChar === rChar && qChar !== 'N');
            const diagScore = matrix[prevRowOffset + (j - 1)] + (isMatch ? matchScore : mismatchPenalty);
            const upScore = matrix[prevRowOffset + j] + gapPenalty;
            const leftScore = matrix[rowOffset + (j - 1)] + gapPenalty;

            matrix[rowOffset + j] = Math.max(diagScore, upScore, leftScore);
        }
    }

    // Traceback: find max in last row (best alignment of full query against reference)
    let bestScore = -Infinity;
    let bestJ = m;
    const lastRowOffset = n * cols;
    for (let j = 1; j <= m; j++) {
        if (matrix[lastRowOffset + j] > bestScore) {
            bestScore = matrix[lastRowOffset + j];
            bestJ = j;
        }
    }

    let i = n;
    let j = bestJ;
    const refEnd = bestJ;
    let refStart = 1;
    let queryStart = 1;

    const alignedQArr = [];
    const alignedRArr = [];
    const matchIndArr = [];

    let matches = 0;
    let mismatches = 0;
    let gaps = 0;

    while (i > 0) {
        if (j > 0) {
            const qChar = q[i - 1];
            const rChar = r[j - 1];
            const isMatch = (qChar === rChar && qChar !== 'N');
            const currentScore = matrix[i * cols + j];
            const diagScore = matrix[(i - 1) * cols + (j - 1)] + (isMatch ? matchScore : mismatchPenalty);

            if (currentScore === diagScore) {
                alignedQArr.push(qChar);
                alignedRArr.push(rChar);
                if (isMatch) {
                    matchIndArr.push('|');
                    matches++;
                } else {
                    matchIndArr.push(' ');
                    mismatches++;
                }
                i--;
                j--;
                continue;
            }

            const leftScore = matrix[i * cols + (j - 1)] + gapPenalty;
            if (currentScore === leftScore) {
                alignedQArr.push('-');
                alignedRArr.push(rChar);
                matchIndArr.push(' ');
                gaps++;
                j--;
                continue;
            }
        }

        alignedQArr.push(q[i - 1]);
        alignedRArr.push('-');
        matchIndArr.push(' ');
        gaps++;
        i--;
    }

    refStart = j + 1;
    queryStart = i + 1;

    alignedQArr.reverse();
    alignedRArr.reverse();
    matchIndArr.reverse();

    const alignedQuery = alignedQArr.join('');
    const alignedRef = alignedRArr.join('');
    const matchLine = matchIndArr.join('');
    const alignmentLength = alignedQuery.length;

    const identity = alignmentLength > 0 ? (matches / alignmentLength) * 100 : 0;
    const coverage = n > 0 ? (Math.min(n, (alignmentLength - gaps)) / n) * 100 : 0;

    return {
        score: bestScore,
        matches,
        mismatches,
        gaps,
        alignmentLength,
        identity: Math.min(100, Math.max(0, identity)),
        coverage: Math.min(100, Math.max(0, coverage)),
        alignedQuery,
        alignedRef,
        matchLine,
        queryStart,
        queryEnd: n,
        refStart,
        refEnd
    };
}

/**
 * GeneTrace Reference Search: Pre-filter + Pairwise Align top candidates
 */
export function searchReferences(querySequence, referenceRecords, options = {}) {
    if (!querySequence || referenceRecords.length === 0) return [];

    const topN = options.topN || 5;
    const candidates = prefilterCandidates(querySequence, referenceRecords, 7, topN);

    // If no candidate passed k-mer filter, test the first few references directly as fallback
    const targets = candidates.length > 0 ? candidates : referenceRecords.slice(0, 3);

    const results = [];
    for (const ref of targets) {
        if (!ref.sequence) continue;
        const align = pairwiseAlign(querySequence, ref.sequence);
        if (align && (align.identity >= 65 || align.matches >= 30)) {
            results.push({
                referenceId: ref.id,
                accession: ref.accession,
                organism: ref.organism,
                scientificName: ref.scientificName,
                marker: ref.marker,
                identity: parseFloat(align.identity.toFixed(1)),
                coverage: parseFloat(align.coverage.toFixed(1)),
                alignmentLength: align.alignmentLength,
                matches: align.matches,
                mismatches: align.mismatches,
                gaps: align.gaps,
                score: align.score,
                taxonomy: {
                    domain: ref.domain,
                    kingdom: ref.kingdom,
                    phylum: ref.phylum,
                    class: ref.class,
                    order: ref.order,
                    family: ref.family,
                    genus: ref.genus,
                    species: ref.species
                },
                alignment: {
                    alignedQuery: align.alignedQuery,
                    matchLine: align.matchLine,
                    alignedRef: align.alignedRef,
                    queryStart: align.queryStart,
                    queryEnd: align.queryEnd,
                    refStart: align.refStart,
                    refEnd: align.refEnd
                },
                referenceRecord: ref
            });
        }
    }

    // Sort by identity, then score
    results.sort((a, b) => b.identity - a.identity || b.score - a.score);

    // Assign rank
    results.forEach((r, idx) => {
        r.rank = idx + 1;
    });

    return results;
}
