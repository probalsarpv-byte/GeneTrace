// motif.js

export function findMotifs(sequence, motifPattern, isRegex = false) {
    if (!sequence || !motifPattern) return [];
    
    const seqUpper = sequence.toUpperCase();
    const matches = [];
    
    if (isRegex) {
        try {
            const regex = new RegExp(motifPattern, 'gi');
            let match;
            while ((match = regex.exec(seqUpper)) !== null) {
                matches.push({
                    motif: match[0],
                    start: match.index + 1, // 1-based biological coordinate
                    end: match.index + match[0].length,
                    strand: '+'
                });
                // To support overlapping matches, we could manually advance regex.lastIndex, but native exec doesn't do overlapping well.
                // For simplicity, we'll advance by 1 if overlapping is needed.
                regex.lastIndex = match.index + 1;
            }
        } catch (e) {
            console.error("Invalid regex motif", e);
        }
    } else {
        const patternUpper = motifPattern.toUpperCase();
        let startIndex = 0;
        let index;
        while ((index = seqUpper.indexOf(patternUpper, startIndex)) > -1) {
            matches.push({
                motif: patternUpper,
                start: index + 1,
                end: index + patternUpper.length,
                strand: '+'
            });
            startIndex = index + 1; // overlapping support
        }
    }
    
    return matches;
}
