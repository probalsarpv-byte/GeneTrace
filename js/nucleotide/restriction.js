// restriction.js

export async function findRestrictionSites(sequence) {
    if (!sequence) return [];
    
    // Load local dataset
    let enzymes = [];
    try {
        const response = await fetch('./data/restriction-enzymes.json');
        enzymes = await response.json();
    } catch (e) {
        console.error('Failed to load restriction enzymes', e);
        return [];
    }

    const sites = [];
    
    enzymes.forEach(enzyme => {
        const seqUpper = sequence.toUpperCase();
        let startIndex = 0;
        let index;
        
        while ((index = seqUpper.indexOf(enzyme.sequence, startIndex)) > -1) {
            sites.push({
                enzyme: enzyme.name,
                recognition: enzyme.sequence,
                position: index + 1, // 1-based biological coordinate
                cutSite: index + 1 + enzyme.cut
            });
            startIndex = index + 1;
        }
    });
    
    // Sort by position
    sites.sort((a, b) => a.position - b.position);
    
    return sites;
}
