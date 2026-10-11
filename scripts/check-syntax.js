import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

function walk(dir) {
    let files = [];
    fs.readdirSync(dir).forEach(f => {
        let full = path.join(dir, f);
        if (fs.statSync(full).isDirectory()) files = files.concat(walk(full));
        else if (f.endsWith('.js')) files.push(full);
    });
    return files;
}

const jsFiles = walk('js');
let errors = 0;
jsFiles.forEach(f => {
    try {
        execSync(`node -c "${f}"`, { stdio: 'pipe' });
    } catch (e) {
        console.error('Syntax error in:', f, e.message);
        errors++;
    }
});

if (errors === 0) {
    console.log(`ALL ${jsFiles.length} JS FILES PASSED SYNTAX CHECK!`);
} else {
    process.exit(1);
}
