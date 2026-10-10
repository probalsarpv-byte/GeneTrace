// demo-generator.js - Generates synthetic AB1 and FASTQ files for testing

export function createSyntheticAB1(sequence = 'ATGCGATCGATCGATCGATC', sampleName = 'Synthetic_Control_1') {
  const seqLen = sequence.length;
  const numTracePoints = seqLen * 10;
  
  // Tag count: PBAS.1, PCON.1, DATA.9, DATA.10, DATA.11, DATA.12, PLOC.1, SMPL.1, FWO_.1
  const numEntries = 9;
  const dirEntryOffset = 128;
  const dirSize = numEntries * 28;
  
  // Calculate data sizes
  // PBAS: cString (seqLen + 1 bytes)
  const pbasSize = seqLen + 1;
  // PCON: Int8Array (seqLen bytes)
  const pconSize = seqLen;
  // DATA.9-12: Int16Array (numTracePoints * 2 bytes each)
  const traceByteSize = numTracePoints * 2;
  // PLOC: Int16Array (seqLen * 2 bytes)
  const plocByteSize = seqLen * 2;
  // SMPL: pString (sampleName.length + 1)
  const smplSize = sampleName.length + 1;
  // FWO_: cString ('GATC\0' = 5 bytes)
  const fwoSize = 5;
  
  const totalBufferSize = dirEntryOffset + dirSize + pbasSize + pconSize + (traceByteSize * 4) + plocByteSize + smplSize + fwoSize + 64;
  const buffer = new ArrayBuffer(totalBufferSize);
  const view = new DataView(buffer);
  
  // Header
  // Magic: 'ABIF'
  view.setUint8(0, 0x41);
  view.setUint8(1, 0x42);
  view.setUint8(2, 0x49);
  view.setUint8(3, 0x46);
  // Version
  view.setInt16(4, 101, false);
  // numEntries at 18
  view.setInt32(18, numEntries, false);
  // dirEntryOffset at 26
  view.setInt32(26, dirEntryOffset, false);
  
  let currentOffset = dirEntryOffset + dirSize;
  
  function writeDirEntry(entryIdx, name, num, elemType, elemSize, numElems, dataSize, offset) {
    const pos = dirEntryOffset + entryIdx * 28;
    for (let i = 0; i < 4; i++) {
      view.setUint8(pos + i, name.charCodeAt(i));
    }
    view.setInt32(pos + 4, num, false);
    view.setInt16(pos + 8, elemType, false);
    view.setInt16(pos + 10, elemSize, false);
    view.setInt32(pos + 12, numElems, false);
    view.setInt32(pos + 16, dataSize, false);
    view.setInt32(pos + 20, offset, false);
  }
  
  // 0: PBAS.1 (cString, elemType 19)
  writeDirEntry(0, 'PBAS', 1, 19, 1, pbasSize, pbasSize, currentOffset);
  for (let i = 0; i < seqLen; i++) {
    view.setUint8(currentOffset + i, sequence.charCodeAt(i));
  }
  view.setUint8(currentOffset + seqLen, 0);
  currentOffset += pbasSize;
  
  // 1: PCON.1 (Int8, elemType 2)
  writeDirEntry(1, 'PCON', 1, 2, 1, seqLen, seqLen, currentOffset);
  for (let i = 0; i < seqLen; i++) {
    const q = (i < 2 || i > seqLen - 3) ? 15 : 35 + Math.floor(Math.sin(i) * 5);
    view.setInt8(currentOffset + i, q);
  }
  currentOffset += pconSize;
  
  // Peak locations: PLOC.1 (Int16, elemType 4)
  const plocOffset = currentOffset;
  writeDirEntry(2, 'PLOC', 1, 4, 2, seqLen, plocByteSize, plocOffset);
  for (let i = 0; i < seqLen; i++) {
    const peakPos = (i * 10) + 5;
    view.setInt16(plocOffset + i * 2, peakPos, false);
  }
  currentOffset += plocByteSize;
  
  // Traces DATA.9 (G), 10 (A), 11 (T), 12 (C)
  // Let FWO_ = 'GATC', so DATA.9=G, 10=A, 11=T, 12=C
  const traces = { G: currentOffset, A: currentOffset + traceByteSize, T: currentOffset + traceByteSize * 2, C: currentOffset + traceByteSize * 3 };
  
  writeDirEntry(3, 'DATA', 9, 4, 2, numTracePoints, traceByteSize, traces.G);
  writeDirEntry(4, 'DATA', 10, 4, 2, numTracePoints, traceByteSize, traces.A);
  writeDirEntry(5, 'DATA', 11, 4, 2, numTracePoints, traceByteSize, traces.T);
  writeDirEntry(6, 'DATA', 12, 4, 2, numTracePoints, traceByteSize, traces.C);
  
  // Synthesize peak curves
  for (let i = 0; i < seqLen; i++) {
    const base = sequence[i].toUpperCase();
    const peakIdx = (i * 10) + 5;
    for (let dx = -4; dx <= 4; dx++) {
      const idx = peakIdx + dx;
      if (idx >= 0 && idx < numTracePoints) {
        const height = Math.round(1500 * Math.exp(-(dx * dx) / 4));
        const activeTraceOffset = traces[base] || traces.A;
        view.setInt16(activeTraceOffset + idx * 2, height, false);
      }
    }
  }
  currentOffset += traceByteSize * 4;
  
  // SMPL.1 (pString, elemType 18)
  writeDirEntry(7, 'SMPL', 1, 18, 1, smplSize, smplSize, currentOffset);
  view.setUint8(currentOffset, sampleName.length);
  for (let i = 0; i < sampleName.length; i++) {
    view.setUint8(currentOffset + 1 + i, sampleName.charCodeAt(i));
  }
  currentOffset += smplSize;
  
  // FWO_.1 (cString, elemType 19)
  writeDirEntry(8, 'FWO_', 1, 19, 1, 5, 5, currentOffset);
  const fwo = 'GATC';
  for (let i = 0; i < 4; i++) {
    view.setUint8(currentOffset + i, fwo.charCodeAt(i));
  }
  view.setUint8(currentOffset + 4, 0);
  
  return buffer;
}

export function createSyntheticFastq() {
  const sequences = [
    { id: 'read001', desc: 'synthetic_paired_1', seq: 'ATGAAGAGCAACGGCGAGGAGCTGTTCACCGGGGTGGTGCCCATCCTGGTCGAGCTGGACGGCGACGTAAACGGCCACAAGTTCAGCGTGTCCGGCGAGG', qChar: 'I' },
    { id: 'read002', desc: 'synthetic_paired_2', seq: 'GGCGAGGGCGATGCCACCTACGGCAAGCTGACCCTGAAGTTCATCTGCACCACCGGCAAGCTGCCCGTGCCCTGGCCCACCCTCGTGACCACCCTGACCT', qChar: 'I' },
    { id: 'read003', desc: 'low_quality_sample', seq: 'TACGGCGTGCAGTGCTTCAGCCGCTACCCCGACCACATGAAGCAGCACGACTTCTTCAAGTCCGCCATGCCCGAAGGCTACGTCCAGGAGCGCACCATCT', qChar: '#' },
    { id: 'read004', desc: 'adapter_trimmed', seq: 'TTCAAGGACGACGGCAACTACAAGACCCGCGCCGAGGTGAAGTTCGAGGGCGACACCCTGGTGAACCGCATCGAGCTGAAGGGCATCGACTTCAAGGAGT', qChar: 'I' }
  ];

  return sequences.map(item => {
    const qual = item.qChar.repeat(item.seq.length);
    return `@${item.id} ${item.desc}\n${item.seq}\n+\n${qual}`;
  }).join('\n');
}
