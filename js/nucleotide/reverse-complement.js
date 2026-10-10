// reverse-complement.js

const COMPLEMENT_MAP = {
    'A': 'T', 'T': 'A', 'U': 'A', 'G': 'C', 'C': 'G',
    'R': 'Y', 'Y': 'R', 'S': 'S', 'W': 'W', 'K': 'M', 'M': 'K',
    'B': 'V', 'D': 'H', 'H': 'D', 'V': 'B', 'N': 'N', '-': '-'
};

export function reverseComplement(sequence) {
    if (!sequence) return '';
    let rc = '';
    for (let i = sequence.length - 1; i >= 0; i--) {
        const char = sequence[i];
        rc += COMPLEMENT_MAP[char] || char; // default to original if unknown
    }
    return rc;
}

export function reverse(sequence) {
    if (!sequence) return '';
    return sequence.split('').reverse().join('');
}

export function complement(sequence) {
    if (!sequence) return '';
    let comp = '';
    for (let i = 0; i < sequence.length; i++) {
        const char = sequence[i];
        comp += COMPLEMENT_MAP[char] || char;
    }
    return comp;
}
