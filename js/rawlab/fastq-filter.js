export function filterReads(reads, options = {}) {
  const minMeanQuality = options.minMeanQuality || 20;
  const minLength = options.minLength || 50;
  const maxNPercent = options.maxNPercent || 5;
  const trimLeft = options.trimLeft || 0;
  const trimRight = options.trimRight || 0;
  
  const retained = [];
  const removed = [];
  
  let removedByQuality = 0;
  let removedByLength = 0;
  let removedByN = 0;
  
  reads.forEach(read => {
    let seq = read.sequence;
    let qual = read.qualityStr;
    let qScores = read.qualityScores;
    
    if (trimLeft > 0 || trimRight > 0) {
      const end = seq.length - trimRight;
      seq = seq.substring(trimLeft, end);
      qual = qual.substring(trimLeft, end);
      qScores = qScores.slice(trimLeft, end);
    }
    
    if (seq.length < minLength) {
      removedByLength++;
      removed.push(read);
      return;
    }
    
    let nCnt = 0;
    let sumQ = 0;
    for (let i = 0; i < seq.length; i++) {
      if (seq[i].toUpperCase() === 'N') nCnt++;
      sumQ += qScores[i];
    }
    
    const nPct = (nCnt / seq.length) * 100;
    if (nPct > maxNPercent) {
      removedByN++;
      removed.push(read);
      return;
    }
    
    const meanQ = sumQ / seq.length;
    if (meanQ < minMeanQuality) {
      removedByQuality++;
      removed.push(read);
      return;
    }
    
    retained.push({
      id: read.id,
      description: read.description,
      sequence: seq,
      qualityStr: qual,
      qualityScores: qScores
    });
  });
  
  return {
    retained,
    removed,
    stats: {
      before: reads.length,
      after: retained.length,
      percentRetained: (retained.length / reads.length) * 100,
      removedByQuality,
      removedByLength,
      removedByN
    }
  };
}

export function exportFilteredFastq(reads) {
  return reads.map(r => `@${r.id} ${r.description}\n${r.sequence}\n+\n${r.qualityStr}`).join('\n');
}

export function exportFilteredFasta(reads) {
  return reads.map(r => `>${r.id} ${r.description}\n${r.sequence}`).join('\n');
}
