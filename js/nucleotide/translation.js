// translation.js

const STANDARD_GENETIC_CODE = {
    'ATA':'I', 'ATC':'I', 'ATT':'I', 'ATG':'M',
    'ACA':'T', 'ACC':'T', 'ACG':'T', 'ACT':'T',
    'AAC':'N', 'AAT':'N', 'AAA':'K', 'AAG':'K',
    'AGC':'S', 'AGT':'S', 'AGA':'R', 'AGG':'R',
    'CTA':'L', 'CTC':'L', 'CTG':'L', 'CTT':'L',
    'CCA':'P', 'CCC':'P', 'CCG':'P', 'CCT':'P',
    'CAC':'H', 'CAT':'H', 'CAA':'Q', 'CAG':'Q',
    'CGA':'R', 'CGC':'R', 'CGG':'R', 'CGT':'R',
    'GTA':'V', 'GTC':'V', 'GTG':'V', 'GTT':'V',
    'GCA':'A', 'GCC':'A', 'GCG':'A', 'GCT':'A',
    'GAC':'D', 'GAT':'D', 'GAA':'E', 'GAG':'E',
    'GGA':'G', 'GGC':'G', 'GGG':'G', 'GGT':'G',
    'TCA':'S', 'TCC':'S', 'TCG':'S', 'TCT':'S',
    'TTC':'F', 'TTT':'F', 'TTA':'L', 'TTG':'L',
    'TAC':'Y', 'TAT':'Y', 'TAA':'*', 'TAG':'*',
    'TGC':'C', 'TGT':'C', 'TGA':'*', 'TGG':'W'
};

export function translateCodon(codon) {
    // Convert U to T for standard lookup
    const normalized = codon.replace(/U/g, 'T').toUpperCase();
    if (normalized.length !== 3) return '';
    
    // Check if there are ambiguous bases
    if (normalized.includes('N') || normalized.includes('R') || normalized.includes('Y')) {
        return 'X'; 
    }
    
    return STANDARD_GENETIC_CODE[normalized] || 'X';
}

export function translateSequence(sequence, frame = 1) {
    if (!sequence) return '';
    
    let translated = '';
    const startIdx = (frame > 0) ? frame - 1 : (frame === -1 ? 0 : (frame === -2 ? 1 : 2));
    
    // If reverse frame, we need to process the reverse complement first, handled elsewhere, 
    // assume `sequence` passed here is the strand to translate
    
    for (let i = startIdx; i < sequence.length - 2; i += 3) {
        const codon = sequence.substring(i, i + 3);
        translated += translateCodon(codon);
    }
    
    return translated;
}
