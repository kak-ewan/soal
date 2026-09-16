const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

// The original q.number was correct except if duplicate, but if duplicate we probably want to use the index. 
// However, the function renderQuestionBlock has `globalIndexInArray`, which is local.
code = code.replace(/<div key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\} className="pb-6/g, '<div key={`q-${q.number}-${typeof globalIndexInArray !== "undefined" ? globalIndexInArray : typeof idx !== "undefined" ? idx : q.number}`} className="pb-6');

code = code.replace(/<div key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\} className="space-y-2 pb-4">/g, '<div key={`q-${q.number}-${typeof groupIndex !== "undefined" ? groupIndex : typeof idx !== "undefined" ? idx : q.number}`} className="space-y-2 pb-4">');

code = code.replace(/<div key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\} className="p-3\.5/g, '<div key={`q-${q.number}-${typeof idx !== "undefined" ? idx : q.number}`} className="p-3.5');

code = code.replace(/<div key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\} className="p-3 /g, '<div key={`q-${q.number}-${typeof idx !== "undefined" ? idx : q.number}`} className="p-3 ');

code = code.replace(/<tr key=\{\`q-\$\{q\.number\}-\$\{idx\}\`\}/g, '<tr key={`q-${q.number}-${typeof idx !== "undefined" ? idx : q.number}`}');


fs.writeFileSync('app/page.tsx', code);
console.log("Replaced idx errors");
