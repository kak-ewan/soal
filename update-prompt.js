const fs = require('fs');
let code = fs.readFileSync('app/page.tsx', 'utf8');

const originalPromptContext = 'Integrasi Konteks Lokal Indonesia: ${konteksLokalActive ? `AKtif di Provinsi ${provinsi}. Perintah tambahan: ${perintahTambahan || "Tidak ada"}` : "Tidak aktif"}';

const newPromptContext = 'Integrasi Konteks Lokal Indonesia (WAJIB JIKA AKTIF): ${konteksLokalActive ? `AKTIF di Provinsi ${provinsi}. Anda HARUS SEKSAMA memastikan soal-soal menggunakan nama orang lokal khas daerah, tradisi/budaya, lanskap geografis, tata niaga, kesenian, atau kearifan lokal yang secara spesifik ada di ${provinsi}. WAJIB buat stimulus cerita yang berlokasi di ${provinsi}. Perintah tambahan: ${perintahTambahan || "Tidak ada"}` : "Tidak aktif"}';

if (code.includes(originalPromptContext)) {
    code = code.replace(originalPromptContext, newPromptContext);
    fs.writeFileSync('app/page.tsx', code);
    console.log("Updated prompt context.");
} else {
    console.log("Not found.");
}
