const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');
const start = `    const activeLevels = taksonomi === "SOLO" ? soloLevels : bloomLevels;
        const qNorm = q.taxonomyLevel.toLowerCase().trim();`;
const end = 'Belum ada data Dimensi Profil Lulusan</div>`;\n';

const idxStart = code.indexOf(start);
const idxEnd = code.indexOf(end);

if (idxStart !== -1 && idxEnd !== -1) {
    code = code.substring(0, idxStart) + code.substring(idxEnd + end.length);
    fs.writeFileSync('app/page.tsx', code);
    console.log('Fixed');
} else {
    console.log('Not found');
    console.log(idxStart, idxEnd);
}
