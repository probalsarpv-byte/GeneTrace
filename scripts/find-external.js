import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');
const lines = html.split('\n');
const results = [];

lines.forEach((line, idx) => {
    if (/NCBI BLAST|EzBioCloud|SILVA|MycoBank|ViPR|External BLAST/i.test(line)) {
        results.push({ lineNum: idx + 1, content: line.trim() });
    }
});

console.log(JSON.stringify(results, null, 2));
