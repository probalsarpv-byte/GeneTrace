// js/identification/unknown.js
// Unknown Sequence Investigative Pipeline
import { searchReferences } from '../search/reference-search.js';
import { evaluateConfidence } from './confidence-engine.js';

export class UnknownSequenceInvestigator {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    async investigate(sequenceObj, validationResult, stats, orfData) {
        const type = validationResult?.type || sequenceObj?.type || 'DNA';
        const length = stats?.length || sequenceObj?.sequence?.length || 0;
        const gc = stats?.gcPercent || 50;
        const seqUpper = (sequenceObj?.sequence || '').toUpperCase();

        // 1. Marker Clues (conserved universal primer annealing sites)
        const markerClues = [];
        // 27F / 1492R bacterial 16S primer signatures
        if (seqUpper.includes('AGAGTTTGATC') || seqUpper.includes('TACGGYTACCTTGTTACGACTT') || seqUpper.includes('GGTTACCTTGTTACGACTT')) {
            markerClues.push('Matches conserved 16S universal primer motif (27F / 1492R)');
        }
        // ITS1F / ITS4 fungal primer signatures
        if (seqUpper.includes('CTTGGTCATTTAGAGG') || seqUpper.includes('TCCTCCGCTTATTGATATGC')) {
            markerClues.push('Matches conserved fungal ITS primer motif (ITS1 / ITS4)');
        }
        // 18S eukaryotic primer signatures
        if (seqUpper.includes('AACCTGGTTGATCCTGCCAGT') || seqUpper.includes('TGATCCTTCTGCAGGTTCACCTAC')) {
            markerClues.push('Matches conserved eukaryotic 18S primer motif (NS1 / NS8)');
        }

        // 2. Coding Potential & ORF density
        const orfs = orfData?.orfs || [];
        const orfCount = orfs.length;
        const maxOrfLen = orfs.reduce((max, o) => Math.max(max, o.lengthAa || 0), 0);
        const codingTendency = maxOrfLen >= 80 ? 'High coding capacity (substantive ORF detected)' : (orfCount > 0 ? 'Moderate coding capacity' : 'Low / Non-coding');

        // 3. Multi-database GeneTrace Reference Search
        let bestHits = [];
        let searchedGroups = ['bacteria-16s', 'fungi-its', 'eukaryotes-18s', 'archaea-16s', 'viruses', 'phages'];
        
        for (const grp of searchedGroups) {
            try {
                const refs = await this.dbManager.loadMarkerGroup(grp);
                const hits = searchReferences(seqUpper, refs);
                if (hits.length > 0) {
                    bestHits.push(...hits);
                }
            } catch (e) {
                // Ignore individual group load error
            }
        }

        bestHits.sort((a, b) => b.identity - a.identity || b.score - a.score);
        const topCandidate = bestHits.length > 0 && bestHits[0].identity >= 70 ? bestHits[0] : null;

        // 4. Determination
        let probableOutcome = '';
        let confidenceLevel = 'INSUFFICIENT EVIDENCE';

        if (topCandidate) {
            confidenceLevel = topCandidate.identity >= 98.7 ? 'MODERATE' : 'LOW';
            probableOutcome = `Potential association with ${topCandidate.organism} (${topCandidate.marker}, ${topCandidate.identity}% ID)`;
        } else {
            confidenceLevel = 'INSUFFICIENT EVIDENCE';
            probableOutcome = 'Insufficient evidence for organism-level identification.';
        }

        return {
            observed: {
                type,
                length,
                gc: parseFloat(gc.toFixed(1)),
                orfCount,
                maxOrfLen,
                codingTendency,
                markerClues
            },
            candidates: bestHits.slice(0, 5),
            topCandidate,
            confidence: {
                level: confidenceLevel,
                title: `${confidenceLevel} Confidence Investigation`,
                reasons: [
                    topCandidate 
                        ? `Closest detected database homolog: ${topCandidate.organism} (${topCandidate.identity}% identity, ${topCandidate.coverage}% coverage).`
                        : 'No reference locus matched above the 70% sequence identity threshold in the GeneTrace reference database.',
                    `Sequence coding evaluation: ${codingTendency} (${orfCount} open reading frames).`,
                    markerClues.length > 0 ? markerClues.join('; ') : 'No canonical ribosomal primer binding signatures identified.'
                ],
                limitations: [
                    'Uncharacterized sequences may originate from untargeted genomic loci, intergenic spacers, plasmids, or unsequenced environmental taxa.',
                    'Zero sequence data leaves your browser. De novo gene prediction or metagenomic assembly is recommended for novel isolates.'
                ]
            },
            interpretation: {
                probableOutcome,
                recommendedRoute: topCandidate ? topCandidate.marker : 'De novo investigation'
            }
        };
    }

    getOrganismGroupForVisualization(candidate) {
        if (!candidate) return 'unknown';
        const name = candidate.organism?.toLowerCase() || '';
        if (name.includes('phage')) return 'bacteriophage';
        if (name.includes('virus')) return 'ssRNA-virus';
        if (name.includes('saccharomyces') || name.includes('candida')) return 'yeast';
        if (name.includes('aspergillus') || name.includes('penicillium')) return 'filamentous-fungus';
        if (name.includes('tetra') || name.includes('paramecium')) return 'protozoan';
        return 'bacterium';
    }
}
