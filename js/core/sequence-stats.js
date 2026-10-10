// sequence-stats.js

export function calculateNucleotideStats(sequence) {
    let a = 0, c = 0, g = 0, t = 0, u = 0, n = 0;
    let others = 0;
    
    for (let i = 0; i < sequence.length; i++) {
        switch (sequence[i]) {
            case 'A': a++; break;
            case 'C': c++; break;
            case 'G': g++; break;
            case 'T': t++; break;
            case 'U': u++; break;
            case 'N': n++; break;
            default: others++; break;
        }
    }

    const length = sequence.length;
    const gcCount = g + c;
    const atCount = a + t + u;
    
    const gcPercentage = length > 0 ? (gcCount / length) * 100 : 0;
    const atPercentage = length > 0 ? (atCount / length) * 100 : 0;
    
    // GC Skew = (G - C) / (G + C)
    const gcSkew = gcCount > 0 ? (g - c) / gcCount : 0;
    // AT Skew = (A - T) / (A + T)
    const atSkew = atCount > 0 ? (a - (t+u)) / atCount : 0;

    // Very rough MW estimate: 
    // ssDNA avg MW per nucleotide ~ 330 Da (g/mol)
    // dsDNA avg MW per base pair ~ 660 Da
    // Let's report ssDNA estimated MW
    const mwEstimateDa = length * 330;
    
    return {
        counts: { A: a, C: c, G: g, T: t, U: u, N: n, Other: others },
        gcPercentage,
        atPercentage,
        gcSkew,
        atSkew,
        mwEstimateDa,
        length
    };
}

export function calculateProteinStats(sequence) {
    // Basic counts for a subset of categories
    let acidic = 0; // D, E
    let basic = 0;  // K, R, H
    let aromatic = 0; // F, W, Y
    let hydrophobic = 0; // A, I, L, M, V, F, W, Y, C
    
    for (let i = 0; i < sequence.length; i++) {
        const aa = sequence[i];
        if (aa === 'D' || aa === 'E') acidic++;
        if (aa === 'K' || aa === 'R' || aa === 'H') basic++;
        if (aa === 'F' || aa === 'W' || aa === 'Y') aromatic++;
        if (['A','I','L','M','V','F','W','Y','C'].includes(aa)) hydrophobic++;
    }
    
    const length = sequence.length;
    
    // Avg amino acid is ~110 Da
    const mwEstimateDa = length * 110;
    
    return {
        acidicFraction: length > 0 ? acidic / length : 0,
        basicFraction: length > 0 ? basic / length : 0,
        aromaticFraction: length > 0 ? aromatic / length : 0,
        hydrophobicFraction: length > 0 ? hydrophobic / length : 0,
        mwEstimateDa,
        length
    };
}
