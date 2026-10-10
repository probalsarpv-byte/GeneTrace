// sequence-type.js

const IUPAC_NUC = new Set(['A', 'C', 'G', 'T', 'U', 'R', 'Y', 'S', 'W', 'K', 'M', 'B', 'D', 'H', 'V', 'N', '-']);
const STANDARD_AA = new Set(['A', 'R', 'N', 'D', 'C', 'Q', 'E', 'G', 'H', 'I', 'L', 'K', 'M', 'F', 'P', 'S', 'T', 'W', 'Y', 'V']);

/**
 * Guesses whether the sequence is DNA, RNA, or Protein based on character composition.
 * @param {string} seq - Cleaned sequence string
 * @returns {string} 'DNA', 'RNA', 'Protein', or 'Unknown'
 */
export function detectSequenceType(seq) {
    if (!seq) return 'Unknown';

    let countA = 0, countC = 0, countG = 0, countT = 0, countU = 0, countN = 0;
    let countStandardAA = 0;
    let countOther = 0;
    
    const length = seq.length;

    for (let i = 0; i < length; i++) {
        const char = seq[i];
        if (char === 'A') countA++;
        else if (char === 'C') countC++;
        else if (char === 'G') countG++;
        else if (char === 'T') countT++;
        else if (char === 'U') countU++;
        else if (char === 'N') countN++;
        
        if (STANDARD_AA.has(char)) countStandardAA++;
        
        if (!IUPAC_NUC.has(char)) countOther++;
    }

    // Thresholds
    const nucPercentage = (countA + countC + countG + countT + countU + countN) / length;
    const isMostlyNuc = nucPercentage > 0.85; // 85% of characters are basic nucleotides

    if (isMostlyNuc) {
        if (countU > 0 && countT === 0) {
            return 'RNA';
        } else if (countT > 0 && countU === 0) {
            return 'DNA';
        }
        // If it has neither T nor U, default to DNA unless it's extremely ambiguous
        return 'DNA';
    }

    // If it's not mostly nucleotides, check if it's mostly amino acids
    const aaPercentage = countStandardAA / length;
    if (aaPercentage > 0.85) {
        return 'Protein';
    }

    return 'Unknown';
}
