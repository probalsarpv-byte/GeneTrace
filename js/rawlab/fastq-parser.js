export function detectPhredEncoding(qualityChars) {
  for (let i = 0; i < qualityChars.length; i++) {
    const code = qualityChars.charCodeAt(i);
    if (code < 33 || code > 105) return "Unknown";
    if (code > 74) return "Phred+64";
  }
  return "Phred+33";
}

export function parseFastq(text) {
  const lines = text.split(/\r?\n/);
  const reads = [];
  
  for (let i = 0; i < lines.length; i += 4) {
    if (i + 3 >= lines.length) break; // Incomplete record
    
    const idLine = lines[i];
    const seq = lines[i+1];
    const plus = lines[i+2];
    const qual = lines[i+3];
    
    if (!idLine.startsWith('@') || !plus.startsWith('+')) {
      console.warn(`Malformed record at line ${i+1}`);
      continue;
    }
    
    if (seq.length !== qual.length) {
      console.warn(`Length mismatch at line ${i+1}`);
      continue;
    }
    
    const idParts = idLine.substring(1).split(' ');
    const id = idParts[0];
    const desc = idParts.slice(1).join(' ');
    
    const qScores = new Int8Array(qual.length);
    for (let j = 0; j < qual.length; j++) {
      qScores[j] = qual.charCodeAt(j) - 33; // Default Phred+33
    }
    
    reads.push({
      id,
      description: desc,
      sequence: seq,
      qualityStr: qual,
      qualityScores: qScores
    });
    
    if (reads.length >= 50000) {
      console.warn("Reached maximum memory limit (50000 reads)");
      break;
    }
  }
  
  return reads;
}

export async function parseFastqAsync(file, onProgress) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      onProgress && onProgress(50);
      try {
        const reads = parseFastq(e.target.result);
        onProgress && onProgress(100);
        resolve(reads);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
