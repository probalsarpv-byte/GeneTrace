export function calculateFastqQC(reads) {
  let totalBases = 0;
  let totalLengths = 0;
  let minLength = Infinity;
  let maxLength = 0;
  let gcCount = 0;
  let nCount = 0;
  let totalQuality = 0;
  let poorQualityReads = 0;
  let shortReads = 0;
  
  const lengths = [];
  const qualityDistribution = Array(41).fill(0);
  const positionQualities = []; // Array of arrays
  
  reads.forEach(read => {
    const len = read.sequence.length;
    totalBases += len;
    totalLengths += len;
    if (len < minLength) minLength = len;
    if (len > maxLength) maxLength = len;
    lengths.push(len);
    
    if (len < 100) shortReads++;
    
    let readQualSum = 0;
    
    for (let i = 0; i < len; i++) {
      const char = read.sequence[i].toUpperCase();
      if (char === 'G' || char === 'C') gcCount++;
      if (char === 'N') nCount++;
      
      const q = read.qualityScores[i];
      readQualSum += q;
      
      if (q >= 0 && q <= 40) qualityDistribution[q]++;
      
      if (i < 500) {
        if (!positionQualities[i]) positionQualities[i] = [];
        positionQualities[i].push(q);
      }
    }
    
    if (len > 0) {
      const meanQ = readQualSum / len;
      if (meanQ < 20) poorQualityReads++;
      totalQuality += readQualSum;
    }
  });
  
  if (reads.length === 0) return null;
  
  lengths.sort((a, b) => a - b);
  const medianLength = lengths[Math.floor(lengths.length / 2)];
  
  const qualityByPosition = positionQualities.map((qs, pos) => {
    qs.sort((a, b) => a - b);
    const sum = qs.reduce((a, b) => a + b, 0);
    return {
      pos,
      mean: sum / qs.length,
      q25: qs[Math.floor(qs.length * 0.25)],
      median: qs[Math.floor(qs.length * 0.5)],
      q75: qs[Math.floor(qs.length * 0.75)],
      min: qs[0],
      max: qs[qs.length - 1]
    };
  });
  
  // Bin read lengths
  const lenDist = {};
  lengths.forEach(l => {
    const bin = Math.floor(l / 10) * 10;
    lenDist[bin] = (lenDist[bin] || 0) + 1;
  });
  const readLengthDistribution = Object.keys(lenDist).map(k => ({ length: Number(k), count: lenDist[k] }));
  
  return {
    totalReads: reads.length,
    meanReadLength: totalLengths / reads.length,
    minLength,
    maxLength,
    medianLength,
    totalBases,
    gcPercent: (gcCount / totalBases) * 100,
    nPercent: (nCount / totalBases) * 100,
    meanQuality: totalQuality / totalBases,
    qualityByPosition,
    qualityDistribution: qualityDistribution.map((count, q) => ({ q, count })),
    readLengthDistribution,
    poorQualityReads,
    shortReads
  };
}

export function calculateFastqQCWorkerScript() {
  return `
    ${calculateFastqQC.toString()}
    self.onmessage = function(e) {
      const res = calculateFastqQC(e.data);
      self.postMessage(res);
    };
  `;
}
