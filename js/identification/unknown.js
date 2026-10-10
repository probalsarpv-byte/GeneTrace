export class UnknownSequenceInvestigator {
    investigate(sequenceObj, validationResult, stats, orfData) {
        const type = validationResult?.type || sequenceObj?.type || 'DNA';
        const length = stats?.length || sequenceObj?.sequence?.length || 0;
        const gc = stats?.gcPercent || 50;
        
        const markerClues = [];
        const seqUpper = (sequenceObj?.sequence || '').toUpperCase();
        if (seqUpper.includes('TATCGATCTGCCTG')) markerClues.push('Possible 16S motif');
        if (seqUpper.includes('CTTGGTCATTTAGAGGAAGTAA')) markerClues.push('Possible ITS motif');
        
        const orfCount = orfData?.orfs?.length || 0;
        const codingTendency = orfCount > 0 ? 'Present' : 'Low';
        
        let likelyCategory = 'Unknown';
        if (markerClues.includes('Possible 16S motif')) likelyCategory = 'Bacterial 16S Fragment';
        else if (markerClues.includes('Possible ITS motif')) likelyCategory = 'Fungal ITS Fragment';
        else if (codingTendency === 'Present') likelyCategory = 'Protein-coding gene fragment';
        
        return {
            observed: { 
                type, 
                length, 
                gc, 
                orfCount, 
                codingTendency, 
                markerClues 
            },
            interpretation: { 
                likelyCategory, 
                alternativeCategories: ['Synthetic Construct', 'Non-coding RNA'], 
                reasoning: 'Interpretation based on basic composition and motif matching. Requires homology search for confirmation.' 
            },
            recommendedNextStep: { 
                workflowId: 'blast', 
                description: 'Run generic NCBI BLAST (nr/nt) to identify sequence origins', 
                actions: ['Run BLASTn', 'Run BLASTx'] 
            },
            limitations: [
                'No definitive identification can be made without database homology search.',
                'Motifs are approximate and may match by chance.',
                'This is an investigation pipeline, not a diagnostic tool.'
            ]
        };
    }
}
