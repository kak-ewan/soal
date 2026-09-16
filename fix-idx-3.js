const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

code = code.replace(/<div key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\} className="p-3 rounded/g, '<div key={`keyblock-${q.number}`} className="p-3 rounded');

code = code.replace(/<tr key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\} className="hover:bg-slate-50\/50/g, '<tr key={`kisi-${q.number}`} className="hover:bg-slate-50/50');
code = code.replace(/<tr key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\} className=\{cn\(/g, '<tr key={`analisis-${q.number}`} className={cn(');
code = code.replace(/<div key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\} className="p-3\.5/g, '<div key={`printkey-${q.number}`} className="p-3.5');
code = code.replace(/<tr key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\} className="bg-white/g, '<tr key={`printtable-${q.number}`} className="bg-white');

fs.writeFileSync('app/page.tsx', code);
console.log("Fixed");
