// primer.js

export function analyzePrimer(sequence) {
    if (!sequence) return null;
    
    const cleanSeq = sequence.toUpperCase().replace(/[^ATCG]/g, '');
    const length = cleanSeq.length;
    
    if (length === 0) return null;

    let gCount = 0;
    let cCount = 0;
    let aCount = 0;
    let tCount = 0;

    for (let char of cleanSeq) {
        if (char === 'G') gCount++;
        else if (char === 'C') cCount++;
        else if (char === 'A') aCount++;
        else if (char === 'T') tCount++;
    }

    const gcPercent = ((gCount + cCount) / length) * 100;
    
    // Wallace rule for < 14bp, roughly: 2*(A+T) + 4*(G+C)
    // Simplified Nearest Neighbor/salt-adjusted is better but Wallace is standard basic estimation
    let tm = 0;
    if (length < 14) {
        tm = (aCount + tCount) * 2 + (gCount + cCount) * 4;
    } else {
        tm = 64.9 + 41 * (gCount + cCount - 16.4) / length;
    }

    // GC clamp: Check if the last 5 bases contain at least 2 G or C
    const tail = cleanSeq.slice(-5);
    let tailGcCount = 0;
    for (let char of tail) {
        if (char === 'G' || char === 'C') tailGcCount++;
    }
    const hasGcClamp = tailGcCount >= 2;

    return {
        length,
        gcPercent,
        tmEstimate: tm,
        hasGcClamp,
        warning: length < 15 || length > 30 ? "Primer length is outside typical 15-30bp range." : null
    };
}
