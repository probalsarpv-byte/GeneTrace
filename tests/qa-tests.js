// qa-tests.js
// Automated testing suite for GeneTrace core algorithms

import { parseFasta, cleanSequence } from '../js/core/fasta-parser.js';
import { detectSequenceType } from '../js/core/sequence-type.js';
import { validateSequence } from '../js/core/sequence-validator.js';
import { calculateNucleotideStats, calculateProteinStats } from '../js/core/sequence-stats.js';
import { reverseComplement } from '../js/nucleotide/reverse-complement.js';
import { translateCodon, translateSequence } from '../js/nucleotide/translation.js';
import { findORFs } from '../js/nucleotide/orf.js';

let failed = 0;
let passed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
    } else {
        console.error(`❌ FAIL: ${message}`);
        failed++;
    }
}

console.log("Running GeneTrace QA Tests...");

try {
    // 1. FASTA Parsing Tests
    const rawFasta = `>seq1
ATGC
>seq2
CGTA`;
    const parsed = parseFasta(rawFasta);
    assert(parsed.length === 2, "FASTA Parser: Should parse two sequences");
    assert(parsed[0].sequence === "ATGC", "FASTA Parser: First sequence parsed correctly");
    
    // 2. Sequence Type Tests
    assert(detectSequenceType("ATGCATGC") === "DNA", "Type Detect: DNA");
    assert(detectSequenceType("AUGC") === "RNA", "Type Detect: RNA");
    assert(detectSequenceType("MKWYV") === "Protein", "Type Detect: Protein");
    assert(detectSequenceType("NNNN") === "DNA", "Type Detect: Ambiguous defaults to DNA"); // Based on current logic

    // 3. Validation Tests
    const valObj = { name: "Test", sequence: "ATGCATGC" };
    const valResult = validateSequence(valObj);
    assert(valResult.label === "Caution", "Validator: 8 bp is flagged as Caution (too short)");
    
    const badVal = validateSequence({ name: "Bad", sequence: "ATGCX" });
    assert(badVal.label === "Poor", "Validator: Invalid char flags as Poor");

    // 4. Reverse Complement
    assert(reverseComplement("ATGC") === "GCAT", "RevComp: ATGC -> GCAT");
    assert(reverseComplement("RYM") === "KRY", "RevComp: IUPAC RYM -> KRY");

    // 5. Translation
    assert(translateCodon("ATG") === "M", "Translate: ATG -> M");
    assert(translateCodon("TAA") === "*", "Translate: TAA -> * (Stop)");
    assert(translateCodon("NTG") === "X", "Translate: Ambiguous -> X");
    
    assert(translateSequence("ATGGCC") === "MA", "Translate Seq: ATGGCC -> MA");

    // 6. ORF Finder
    // seq with ATG (start), CCC (Pro), TAA (stop). Length = 9 nuc (3 aa)
    // We set minLengthAa to 2 for this test
    const orfSeq = "ATGCCCTAA";
    const orfs = findORFs(orfSeq, 2);
    assert(orfs.length === 1, "ORF Finder: Should find 1 ORF");
    if (orfs.length > 0) {
        assert(orfs[0].lengthAa === 3, "ORF Finder: Length should be 3 AA");
        assert(orfs[0].translation === "MP*", "ORF Finder: Translation should be MP*");
        assert(orfs[0].strand === "+", "ORF Finder: Strand should be +");
    }

    console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);

} catch (e) {
    console.error("Test execution threw an error:");
    console.error(e);
    process.exit(1);
}
