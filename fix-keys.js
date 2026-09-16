const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

// Replace key={q.number} with key={`q-${q.number}-${idx}`} for all instances
// Also replace `map((q) =>` with `map((q, idx) =>` if missing
code = code.replace(/\(\(q\) =>/g, "((q, idx) =>");
code = code.replace(/<div key={q\.number}/g, '<div key={`q-${q.number}-${idx}`}');
code = code.replace(/<tr key={q\.number}/g, '<tr key={`q-${q.number}-${idx}`}');

// Replace key={opt} with key={`opt-${oIdx || idx}-${Math.random()}`} ?
// Wait, for options map: q.options.map((opt) =>  --> needs index!
code = code.replace(/q\.options\.map\(\(opt\) =>/g, "q.options.map((opt, optIdx) =>");
code = code.replace(/key={opt}/g, 'key={`opt-${optIdx}`}'); // optIdx is stable for the options array!

code = code.replace(/q\.options\.map\(\(opt: string\) =>/g, "q.options.map((opt: string, optIdx: number) =>");


fs.writeFileSync('app/page.tsx', code);
console.log("Replaced keys");
