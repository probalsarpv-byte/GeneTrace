// batch.js

export function processBatch(parsedSequences, statsFunction, typeFunction, validateFunction) {
    if (!parsedSequences || !Array.isArray(parsedSequences)) return [];

    return parsedSequences.map(seqObj => {
        const type = typeFunction(seqObj.sequence);
        const validation = validateFunction(seqObj);
        
        let stats = null;
        let gcPercent = 0;
        let atPercent = 0;
        
        if (type === 'DNA' || type === 'RNA') {
            stats = statsFunction(seqObj.sequence, type); // Assuming calculateNucleotideStats
            gcPercent = stats.gcPercentage;
            atPercent = stats.atPercentage;
        }

        return {
            id: seqObj.id,
            name: seqObj.name,
            type: type,
            length: seqObj.sequence.length,
            gcPercent: gcPercent,
            atPercent: atPercent,
            status: validation.label,
            warnings: validation.warnings
        };
    });
}
