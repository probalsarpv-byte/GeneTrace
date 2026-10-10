// orf.js
import { translateSequence } from './translation.js';
import { reverseComplement } from './reverse-complement.js';

export function findORFs(sequence, minLengthAa = 50, startCodons = ['ATG'], stopCodons = ['TAA', 'TAG', 'TGA']) {
    const minLengthNuc = minLengthAa * 3;
    const orfs = [];
    const seqLen = sequence.length;
    
    const seqFwd = sequence.toUpperCase().replace(/U/g, 'T');
    const seqRev = reverseComplement(seqFwd);
    
    function searchStrand(seq, isReverse) {
        for (let frame = 0; frame < 3; frame++) {
            let currentStart = -1;
            
            for (let i = frame; i < seq.length - 2; i += 3) {
                const codon = seq.substring(i, i + 3);
                
                if (currentStart === -1 && startCodons.includes(codon)) {
                    currentStart = i;
                } else if (currentStart !== -1 && stopCodons.includes(codon)) {
                    const lengthNuc = (i + 3) - currentStart;
                    if (lengthNuc >= minLengthNuc) {
                        const nucSeq = seq.substring(currentStart, i + 3);
                        
                        let startPos = currentStart + 1;
                        let endPos = i + 3;
                        let frameId = frame + 1;
                        
                        if (isReverse) {
                            // Convert coords back to forward strand
                            const tempStart = startPos;
                            startPos = seqLen - endPos + 1;
                            endPos = seqLen - tempStart + 1;
                            frameId = -frameId;
                        }
                        
                        orfs.push({
                            id: `ORF_${startPos}_${endPos}_frame${frameId}`,
                            start: startPos,
                            end: endPos,
                            strand: isReverse ? '-' : '+',
                            frame: frameId,
                            lengthNuc,
                            lengthAa: lengthNuc / 3,
                            sequence: nucSeq,
                            translation: translateSequence(nucSeq, 1)
                        });
                    }
                    // Reset start to find next ORF in this frame
                    currentStart = -1;
                }
            }
        }
    }
    
    searchStrand(seqFwd, false);
    searchStrand(seqRev, true);
    
    // Sort by length descending
    orfs.sort((a, b) => b.lengthNuc - a.lengthNuc);
    
    return orfs;
}
