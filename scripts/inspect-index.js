import fs from 'fs';

const html = fs.readFileSync('index.html', 'utf8');

const views = [...html.matchAll(/id="(view-[^"]+)"/g)].map(m => m[1]);
console.log('--- VIEWS ---');
console.log(views);

const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
console.log('--- SCRIPTS ---');
console.log(scripts);

// Check for external blast mentions
const blastMatches = [...html.matchAll(/(NCBI BLAST|EzBioCloud|SILVA|MycoBank|ViPR|External BLAST)/gi)].map(m => m[0]);
console.log('--- EXTERNAL MATCHES IN index.html ---');
console.log([...new Set(blastMatches)]);
