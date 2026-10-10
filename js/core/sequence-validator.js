// sequence-validator.js
import { detectSequenceType } from './sequence-type.js';

export function validateSequence(parsedSequenceObj) {
    const { sequence, name } = parsedSequenceObj;
    
    const length = sequence.length;
    const type = detectSequenceType(sequence);
    
    let nCount = 0;
    let invalidCount = 0;
    
    const validChars = type === 'Protein' 
        ? /^[A-Z\*\-]$/ 
        : /^[ACGTRYSWKMBDHVN\-U]$/;

    for (let i = 0; i < length; i++) {
        const char = sequence[i];
        if (char === 'N') nCount++;
        if (!validChars.test(char)) invalidCount++;
    }

    const nPercentage = (nCount / length) * 100;
    
    let label = 'Excellent';
    const warnings = [];

    if (!name || name === 'Unknown Sequence (no header provided)') {
        warnings.push('Missing FASTA header.');
        if (label === 'Excellent') label = 'Good';
    }

    if (length < 20) {
        warnings.push('Very short sequence (less than 20 bases/residues).');
        label = 'Caution';
    }

    if (invalidCount > 0) {
        warnings.push(`Contains ${invalidCount} invalid characters for type ${type}.`);
        label = 'Poor';
    }

    if (nPercentage > 10) {
        warnings.push(`High percentage of ambiguous bases (N): ${nPercentage.toFixed(1)}%.`);
        if (label !== 'Poor') label = 'Caution';
    }
    
    if (type === 'Unknown') {
        warnings.push('Unable to determine if sequence is Nucleotide or Protein.');
        label = 'Poor';
    }

    // Basic homopolymer check (e.g., AAAAAAAAAA)
    if (/(A{15,}|C{15,}|G{15,}|T{15,})/.test(sequence)) {
        warnings.push('Contains large stretches of identical bases.');
        if (label === 'Excellent') label = 'Caution';
    }

    return {
        label,
        warnings,
        type,
        length,
        validChars: length - invalidCount,
        ambiguousChars: nCount
    };
}
