// js/phylogeny/tree-builder.js
// Builds authentic phylogenetic trees from query sequence and reference database records
import { pairwiseAlign } from '../search/reference-search.js';

/**
 * Constructs a UPGMA phylogenetic tree from a query sequence and selected reference records
 */
export function buildPhylogeneticTreeFromReferences(queryName, querySeq, topCandidates, allDbRefs = []) {
    const qClean = (queryName || 'Query_Sample').replace(/[\s(),:]+/g, '_');
    const items = [
        { name: qClean, sequence: querySeq, isQuery: true }
    ];

    // 1. Add top candidate references (2 to 4)
    const usedIds = new Set();
    const candidateSubset = topCandidates.slice(0, 3);
    for (const cand of candidateSubset) {
        const refRec = cand.referenceRecord;
        if (!refRec || !refRec.sequence) continue;
        const cleanName = (refRec.organism || refRec.id).replace(/[\s(),:]+/g, '_');
        items.push({ name: cleanName, sequence: refRec.sequence, isQuery: false });
        usedIds.add(refRec.id);
    }

    // 2. Add one more-distant reference from the same marker group if available (outgroup/context)
    if (allDbRefs.length > 0) {
        const outgroup = allDbRefs.find(r => !usedIds.has(r.id) && r.sequence);
        if (outgroup) {
            const cleanName = (outgroup.organism || outgroup.id).replace(/[\s(),:]+/g, '_');
            items.push({ name: cleanName, sequence: outgroup.sequence, isQuery: false });
        }
    }

    if (items.length < 2) {
        return { newick: `(${qClean}:0.0);`, taxa: [qClean] };
    }

    // 3. Compute pairwise distance matrix (d = 1 - identity/100)
    const n = items.length;
    const dist = [];
    for (let i = 0; i < n; i++) {
        dist[i] = [];
        for (let j = 0; j < n; j++) {
            if (i === j) {
                dist[i][j] = 0;
            } else if (j < i) {
                dist[i][j] = dist[j][i];
            } else {
                const align = pairwiseAlign(items[i].sequence, items[j].sequence);
                const identity = align ? align.identity : 50;
                const d = Math.max(0.001, Math.min(1.0, 1.0 - (identity / 100)));
                dist[i][j] = d;
            }
        }
    }

    // 4. UPGMA Clustering Algorithm
    let clusters = items.map((item, idx) => ({
        id: idx,
        name: item.name,
        size: 1,
        height: 0,
        newick: `${item.name}`
    }));

    let currentDist = dist.map(row => [...row]);

    while (clusters.length > 1) {
        // Find minimum distance pair (i, j)
        let minD = Infinity;
        let minI = 0;
        let minJ = 1;

        for (let i = 0; i < clusters.length; i++) {
            for (let j = i + 1; j < clusters.length; j++) {
                if (currentDist[i][j] < minD) {
                    minD = currentDist[i][j];
                    minI = i;
                    minJ = j;
                }
            }
        }

        const clusterA = clusters[minI];
        const clusterB = clusters[minJ];
        const newHeight = minD / 2;
        const branchA = Math.max(0.001, newHeight - clusterA.height).toFixed(4);
        const branchB = Math.max(0.001, newHeight - clusterB.height).toFixed(4);

        const mergedCluster = {
            id: clusters.length,
            size: clusterA.size + clusterB.size,
            height: newHeight,
            newick: `(${clusterA.newick}:${branchA},${clusterB.newick}:${branchB})`
        };

        // Compute distances from merged cluster to all remaining clusters
        const newRow = [];
        for (let k = 0; k < clusters.length; k++) {
            if (k === minI || k === minJ) continue;
            // Weighted average distance
            const dK = (clusterA.size * currentDist[minI][k] + clusterB.size * currentDist[minJ][k]) / (clusterA.size + clusterB.size);
            newRow.push(dK);
        }

        // Rebuild distance matrix without minI and minJ
        const nextDist = [];
        const nextClusters = clusters.filter((_, idx) => idx !== minI && idx !== minJ);
        
        let oldIdxK = 0;
        for (let r = 0; r < nextClusters.length; r++) {
            nextDist[r] = [];
            let oldIdxL = 0;
            for (let c = 0; c < nextClusters.length; c++) {
                // Find original indices
                let origR = clusters.indexOf(nextClusters[r]);
                let origC = clusters.indexOf(nextClusters[c]);
                nextDist[r][c] = currentDist[origR][origC];
            }
            nextDist[r].push(newRow[r]);
        }

        const mergedRow = [...newRow, 0];
        nextDist.push(mergedRow);
        nextClusters.push(mergedCluster);

        clusters = nextClusters;
        currentDist = nextDist;
    }

    const finalNewick = `${clusters[0].newick};`;
    return {
        newick: finalNewick,
        taxa: items.map(it => it.name),
        queryName: qClean
    };
}
