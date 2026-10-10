export class EvidenceEngine {
    constructor() {
        this.evidenceList = [];
    }

    addEvidence(category, evidence, source, strength, interpretation, limitation) {
        this.evidenceList.push({ category, evidence, source, strength, interpretation, limitation });
    }

    getEvidenceByCategory(category) {
        return this.evidenceList.filter(e => e.category === category);
    }

    getOverallConfidence() {
        if (this.evidenceList.length === 0) {
            return { level: 'INSUFFICIENT', score: 0, reasoning: 'No evidence collected.', primaryLimitation: 'No data.' };
        }
        
        let strong = 0, moderate = 0, weak = 0, absent = 0;
        this.evidenceList.forEach(e => {
            if (e.strength === 'STRONG') strong++;
            else if (e.strength === 'MODERATE') moderate++;
            else if (e.strength === 'WEAK') weak++;
            else if (e.strength === 'ABSENT') absent++;
        });

        if (strong > 0 && absent === 0) {
            return { level: 'HIGH', score: 90, reasoning: 'Strong evidence without critical missing pieces.', primaryLimitation: 'Still probabilistic.' };
        } else if (strong > 0 || moderate > 0) {
            return { level: 'MODERATE', score: 60, reasoning: 'Some good evidence, but lacking definitive proof or has missing data.', primaryLimitation: 'Incomplete evidence base.' };
        } else if (weak > 0) {
            return { level: 'LOW', score: 30, reasoning: 'Only weak evidence available.', primaryLimitation: 'Requires better quality data or matches.' };
        }
        return { level: 'INSUFFICIENT', score: 10, reasoning: 'Evidence insufficient for conclusion.', primaryLimitation: 'Needs more analysis.' };
    }

    renderEvidenceBoard(containerId) {
        const html = this.evidenceList.map(e => `
            <div class="evidence-card">
                <span class="pill category">${e.category}</span>
                <span class="pill strength-${e.strength.toLowerCase()}">${e.strength}</span>
                <p><strong>${e.evidence}</strong></p>
                <p><em>Interpretation:</em> ${e.interpretation}</p>
                <p class="source">Source: ${e.source}</p>
                <details><summary>Limitation</summary><p>${e.limitation}</p></details>
            </div>
        `).join('');
        
        const container = document.getElementById(containerId);
        if (container) container.innerHTML = html;
        return html;
    }

    clear() {
        this.evidenceList = [];
    }

    toJSON() {
        return JSON.stringify(this.evidenceList, null, 2);
    }

    static fromSequenceAnalysis(sequenceObj, validationResult, stats) {
        const engine = new EvidenceEngine();
        if (validationResult?.isValid) {
            engine.addEvidence('SEQUENCE_INTEGRITY', 'Valid sequence format', 'Validator', 'STRONG', 'Sequence is structurally sound', 'Does not guarantee biological validity');
        } else {
            engine.addEvidence('SEQUENCE_INTEGRITY', 'Invalid sequence format', 'Validator', 'ABSENT', 'Cannot be analyzed reliably', 'Fundamental issue');
        }
        return engine;
    }
}
