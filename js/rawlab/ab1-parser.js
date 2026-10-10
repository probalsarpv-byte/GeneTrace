export function validateAB1Buffer(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 128) {
    return { valid: false, error: "Buffer too small to be an AB1 file" };
  }
  const view = new DataView(arrayBuffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  if (magic !== 'ABIF') {
    return { valid: false, error: "Invalid magic bytes, expected ABIF" };
  }
  return { valid: true };
}

export function parseAB1(arrayBuffer) {
  const validation = validateAB1Buffer(arrayBuffer);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const view = new DataView(arrayBuffer);
  const version = view.getInt16(4, false);
  
  const dirEntryOffset = view.getInt32(26, false);
  const numEntries = view.getInt32(18, false);

  const tags = {};
  
  for (let i = 0; i < numEntries; i++) {
    const offset = dirEntryOffset + i * 28;
    if (offset + 28 > arrayBuffer.byteLength) break;
    
    const tagName = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1), view.getUint8(offset + 2), view.getUint8(offset + 3));
    const tagNum = view.getInt32(offset + 4, false);
    const elemType = view.getInt16(offset + 8, false);
    const elemSize = view.getInt16(offset + 10, false);
    const numElems = view.getInt32(offset + 12, false);
    const dataSize = view.getInt32(offset + 16, false);
    let dataOffset = view.getInt32(offset + 20, false);
    
    // If dataSize <= 4, data is stored in the dataOffset field itself
    if (dataSize <= 4) {
      dataOffset = offset + 20;
    }
    
    if (!tags[tagName]) tags[tagName] = {};
    tags[tagName][tagNum] = { elemType, elemSize, numElems, dataSize, dataOffset };
  }
  
  function readData(tagInfo) {
    if (!tagInfo) return null;
    const { elemType, numElems, dataOffset } = tagInfo;
    
    if (elemType === 18) { // pString
      const len = view.getUint8(dataOffset);
      let str = '';
      for (let i = 0; i < len; i++) {
        str += String.fromCharCode(view.getUint8(dataOffset + 1 + i));
      }
      return str;
    }
    if (elemType === 19) { // cString
      let str = '';
      for (let i = 0; i < numElems - 1; i++) { // null terminated
        str += String.fromCharCode(view.getUint8(dataOffset + i));
      }
      return str;
    }
    if (elemType === 2) { // Int8
      const arr = new Int8Array(numElems);
      for (let i = 0; i < numElems; i++) {
        arr[i] = view.getInt8(dataOffset + i);
      }
      return arr;
    }
    if (elemType === 4) { // Int16
      const arr = new Int16Array(numElems);
      for (let i = 0; i < numElems; i++) {
        arr[i] = view.getInt16(dataOffset + i * 2, false);
      }
      return arr;
    }
    return null;
  }

  const baseCalls = readData(tags['PBAS']?.[1]) || "";
  const qualityScores = readData(tags['PCON']?.[1]); // Int8Array
  const data9 = readData(tags['DATA']?.[9]);
  const data10 = readData(tags['DATA']?.[10]);
  const data11 = readData(tags['DATA']?.[11]);
  const data12 = readData(tags['DATA']?.[12]);
  const peakLocations = readData(tags['PLOC']?.[1]);
  const sampleName = readData(tags['SMPL']?.[1]) || "Unknown Sample";
  
  const fwo = readData(tags['FWO_']?.[1]) || "GATC"; // typical fallback, but usually A,C,G,T in some order

  let A = null, C = null, G = null, T = null;
  // FWO_ tells us the order of bases corresponding to DATA 9, 10, 11, 12
  const bases = fwo.split('');
  const datas = [data9, data10, data11, data12];
  
  for (let i = 0; i < bases.length; i++) {
    if (bases[i] === 'A') A = datas[i];
    if (bases[i] === 'C') C = datas[i];
    if (bases[i] === 'G') G = datas[i];
    if (bases[i] === 'T') T = datas[i];
  }
  
  return {
    baseCalls,
    qualityScores,
    traces: { A, C, G, T },
    peakLocations,
    sampleName,
    metadata: {
      containerName: readData(tags['CTNM']?.[1]),
      lane: readData(tags['LANE']?.[1])
    },
    traceLength: A ? A.length : 0,
    sequenceLength: baseCalls.length
  };
}
