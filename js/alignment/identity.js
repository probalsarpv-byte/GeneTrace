// identity.js - Pairwise sequence identity calculation
export function calculateIdentity(seq1, seq2) {
    if (!seq1 || !seq2) return null;
    
    const s1 = seq1.toUpperCase();
    const s2 = seq2.toUpperCase();
    const minLength = Math.min(s1.length, s2.length);
    const maxLength = Math.max(s1.length, s2.length);
    
    let matches = 0;
    let mismatches = 0;
    let gaps = 0;

    for (let i = 0; i < minLength; i++) {
        if (s1[i] === '-' || s2[i] === '-') {
            gaps++;
        } else if (s1[i] === s2[i]) {
            matches++;
        } else {
            mismatches++;
        }
    }
    
    // Count trailing length difference as gaps
    gaps += (maxLength - minLength);

    const identityPercent = (matches / maxLength) * 100;

    return {
        matches,
        mismatches,
        gaps,
        alignmentLength: maxLength,
        identityPercent
    };
}
