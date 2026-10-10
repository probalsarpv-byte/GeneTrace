export function formatFastaOutput(name, sequence, lineWidth = 60) {
  let fasta = `>${name}\n`;
  for (let i = 0; i < sequence.length; i += lineWidth) {
    fasta += sequence.substring(i, i + lineWidth) + '\n';
  }
  return fasta;
}

export function convertAb1ToFasta(ab1Data, trimStart, trimEnd, sequenceName) {
  const seq = ab1Data.baseCalls.substring(trimStart, trimEnd + 1);
  return formatFastaOutput(sequenceName || ab1Data.sampleName, seq);
}

export function convertFastqToFasta(reads) {
  return reads.map(r => formatFastaOutput(`${r.id} ${r.description}`, r.sequence)).join('');
}

export function convertToPlainSequence(fastaText) {
  return fastaText.split(/\r?\n/)
    .filter(line => !line.startsWith('>') && line.trim() !== '')
    .join('')
    .replace(/\s/g, '');
}
