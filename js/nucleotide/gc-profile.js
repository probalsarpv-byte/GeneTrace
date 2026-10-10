// gc-profile.js

export function calculateSlidingGC(sequence, windowSize = 50, step = 10) {
    if (!sequence || sequence.length < windowSize) {
        return [];
    }
    
    const profile = [];
    for (let i = 0; i <= sequence.length - windowSize; i += step) {
        const windowSeq = sequence.substring(i, i + windowSize);
        let gcCount = 0;
        for (let j = 0; j < windowSize; j++) {
            if (windowSeq[j] === 'G' || windowSeq[j] === 'C') {
                gcCount++;
            }
        }
        profile.push({
            position: i + (windowSize / 2), // middle of window
            gc: (gcCount / windowSize) * 100
        });
    }
    
    return profile;
}
