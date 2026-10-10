// mutation.js - Pairwise alignment mutation detector & codon consequence analyzer
import { translateCodon } from './translation.js';

export function compareAlignedSequences(refSeq, altSeq) {
    if (!refSeq || !altSeq) return { error: "Sequences missing" };
    if (refSeq.length !== altSeq.length) {
        return { error: "Sequences must be aligned (same length) for direct comparison. Include '-' for gaps." };
    }

    const mutations = [];
    let biologicalPos = 1; // 1-based biological coordinate relative to reference (gaps not counted in ref length)

    for (let i = 0; i < refSeq.length; i++) {
        const refBase = refSeq[i].toUpperCase();
        const altBase = altSeq[i].toUpperCase();

        if (refBase !== altBase) {
            let type = 'substitution';
            if (refBase === '-') {
                type = 'insertion';
            } else if (altBase === '-') {
                type = 'deletion';
            }

            // If it is in a coding region, calculate codon consequence
            let codonInfo = null;
            if (type === 'substitution' && refSeq.indexOf('-') === -1) {
                // If ungapped coding sequence, locate codon (0-based frame 0)
                const codonIndex = Math.floor(i / 3);
                const codonStart = codonIndex * 3;
                if (codonStart + 3 <= refSeq.length) {
                    const refCodon = refSeq.substring(codonStart, codonStart + 3).toUpperCase();
                    const altCodon = altSeq.substring(codonStart, codonStart + 3).toUpperCase();
                    const refAa = translateCodon(refCodon);
                    const altAa = translateCodon(altCodon);
                    
                    let consequence = 'missense';
                    if (refAa === altAa) consequence = 'synonymous';
                    else if (altAa === '*') consequence = 'nonsense (stop gained)';
                    else if (refAa === '*' && altAa !== '*') consequence = 'stop lost';

                    codonInfo = {
                        codonNumber: codonIndex + 1, // 1-based codon coordinate
                        refCodon,
                        altCodon,
                        refAa,
                        altAa,
                        consequence
                    };
                }
            } else if (type === 'insertion' || type === 'deletion') {
                codonInfo = {
                    consequence: 'frameshift / indel'
                };
            }

            mutations.push({
                alignmentPosition: i + 1, // 1-based
                biologicalPosition: refBase === '-' ? `after ${biologicalPos - 1}` : biologicalPos, // 1-based
                reference: refBase,
                alternative: altBase,
                type: type,
                codonInfo: codonInfo
            });
        }
        
        if (refBase !== '-') {
            biologicalPos++;
        }
    }

    return { 
        mutations, 
        totalLength: refSeq.length,
        referenceBases: biologicalPos - 1
    };
}
