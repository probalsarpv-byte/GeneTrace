// fasta-parser.js

/**
 * Parses raw FASTA text into an array of sequence objects.
 * @param {string} text - Raw FASTA text
 * @returns {Array} Array of parsed sequence objects { name, sequence, original }
 */
export function parseFasta(text) {
    if (!text || typeof text !== 'string') {
        throw new Error('Invalid input: Expected a string.');
    }

    const lines = text.split(/\r?\n/);
    const sequences = [];
    let currentSeq = null;

    for (let line of lines) {
        line = line.trim();
        if (!line) continue;

        if (line.startsWith('>')) {
            // Header line
            if (currentSeq) {
                sequences.push(currentSeq);
            }
            currentSeq = {
                id: line.substring(1).split(/\s+/)[0], // first word as ID
                name: line.substring(1).trim(),
                sequence: '',
                original: ''
            };
        } else {
            // Sequence line
            if (!currentSeq) {
                // If there's no header, create a default one
                currentSeq = {
                    id: 'Unknown_Sequence',
                    name: 'Unknown Sequence (no header provided)',
                    sequence: '',
                    original: ''
                };
            }
            // Add raw line to original, and cleaned to sequence
            currentSeq.original += line + '\n';
            // Remove all whitespace for the sequence string
            currentSeq.sequence += line.replace(/\s+/g, '').toUpperCase();
        }
    }

    if (currentSeq) {
        sequences.push(currentSeq);
    }

    return sequences;
}

/**
 * Cleans a sequence of common formatting artifacts.
 * @param {string} seq - Sequence string
 * @returns {string} Cleaned sequence
 */
export function cleanSequence(seq) {
    return seq.replace(/[\s\r\n\t]/g, '').toUpperCase();
}
