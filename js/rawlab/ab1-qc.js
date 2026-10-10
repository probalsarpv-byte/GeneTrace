export function analyzeAB1Quality(ab1Data) {
  const seq = ab1Data.baseCalls;
  const quals = ab1Data.qualityScores;
  const len = ab1Data.sequenceLength;
  
  let sum = 0;
  let lowQualCount = 0;
  let ambigCount = 0;
  const ambigChars = /[^ACGT]/i;
  
  const sortedQuals = new Int8Array(quals).sort();
  const medianQuality = sortedQuals[Math.floor(len / 2)];
  
  let maxRegionLength = 0;
  let maxRegionStart = 0;
  let currentRegionStart = -1;
  
  const qualityByPosition = [];
  
  for (let i = 0; i < len; i++) {
    const q = quals[i];
    sum += q;
    if (q < 20) lowQualCount++;
    if (ambigChars.test(seq[i])) ambigCount++;
    
    qualityByPosition.push({ pos: i, base: seq[i], quality: q });
    
    if (q >= 20) {
      if (currentRegionStart === -1) currentRegionStart = i;
    } else {
      if (currentRegionStart !== -1) {
        const rLen = i - currentRegionStart;
        if (rLen > maxRegionLength) {
          maxRegionLength = rLen;
          maxRegionStart = currentRegionStart;
        }
        currentRegionStart = -1;
      }
    }
  }
  
  if (currentRegionStart !== -1) {
    const rLen = len - currentRegionStart;
    if (rLen > maxRegionLength) {
      maxRegionLength = rLen;
      maxRegionStart = currentRegionStart;
    }
  }
  
  const meanQuality = sum / len;
  
  // Suggested trim
  let trimStart = 0;
  for (let i = 0; i < len - 5; i++) {
    let allGood = true;
    for (let j = 0; j < 5; j++) {
      if (quals[i+j] < 20) allGood = false;
    }
    if (allGood) { trimStart = i; break; }
  }
  
  let trimEnd = len - 1;
  for (let i = len - 1; i >= 4; i--) {
    let allGood = true;
    for (let j = 0; j < 5; j++) {
      if (quals[i-j] < 20) allGood = false;
    }
    if (allGood) { trimEnd = i; break; }
  }
  
  const trimmedLen = trimEnd - trimStart + 1;
  const passesQC = trimmedLen >= 100 && meanQuality >= 20;
  
  return {
    sequenceLength: len,
    meanQuality,
    medianQuality,
    minQuality: sortedQuals[0],
    maxQuality: sortedQuals[len - 1],
    lowQualityBases: lowQualCount,
    ambiguousBases: ambigCount,
    nPercent: (ambigCount / len) * 100,
    highQualityRegion: { start: maxRegionStart, end: maxRegionStart + maxRegionLength - 1, length: maxRegionLength },
    suggestedTrimStart: trimStart,
    suggestedTrimEnd: trimEnd,
    trimmedSequence: seq.substring(trimStart, trimEnd + 1),
    trimmedLength: trimmedLen,
    qualityByPosition,
    passesQC,
    interpretation: passesQC ? "Good quality sequence" : "Low quality sequence, proceed with caution"
  };
}

export function trimSequence(ab1Data, start, end) {
  return ab1Data.baseCalls.substring(start, end + 1);
}
