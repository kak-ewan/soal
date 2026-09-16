import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Lazy-initialized Gemini client to prevent crashes if key is missing during build
let aiClient: GoogleGenAI | null = null;

function getAiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environments. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

export async function POST(req: NextRequest) {
  try {
    const {
      subject,
      level, // Currently "SD"
      fase,
      kelas,
      sumberKonten, // array of strings (lingkup materi / tujuan pembelajaran)
      dimensiProfil, // array of strings
      tipeSoalList,  // array of { type: string, count: number, illustratedCount: number }
      taksonomi,     // "SOLO" or "BLOOM"
      taksonomiLevels, // selected levels
      konteksLokal,  // { active: boolean, provinsi: string, perintahTambahan: string }
      includeMcqExplanation,
      genOpts = { soal: true, kisi: true, kunci: true, analisis: true },
      soalBahasaArab = false,
      mcqOptionsCount = 4
    } = await req.json();

    const ai = getAiClient();

    // Constructing a detailed prompt explaining the requested options
    const formattedSumberKonten = sumberKonten && sumberKonten.length > 0
      ? sumberKonten.map((item: string, i: number) => `${i + 1}. ${item}`).join("\n")
      : "Sesuai standar capaian fase kurikulum.";

    const formattedTipeSoal = tipeSoalList && tipeSoalList.length > 0
      ? tipeSoalList.map((t: any) => `- Tipe: ${t.type}, Jumlah: ${t.count} soal (dari jumlah tersebut, ${t.illustratedCount} soal harus bergambar/memiliki ilustrasi)`).join("\n")
      : "- Campuran Pilihan Ganda & Uraian, total 5 soal.";

    const totalSoal = tipeSoalList && tipeSoalList.length > 0
      ? tipeSoalList.reduce((acc: number, cur: any) => acc + (cur.count || 0), 0)
      : 5;

    const prompt = `
Anda adalah ahli perumus soal ujian (asesmen) kurikulum nasional (Pedoman Perencanaan Asesmen Kemendikdasmen).
Tugas Anda adalah merumuskan sekelompok soal ujian berkualitas premium dan aplikatif untuk guru tingkat SD, SMP, SMA, atau SMK di Indonesia yang diberi nama platform "Ngide Soal".

### CONSTRAINT JUMLAH SOAL YANG SANGAT KETAT (MANDATORI / CRITICAL):
- TOTAL JAWABAN SOAL YANG HARUS DIHASILKAN WAJIB TEPAT PERSIS: ${totalSoal} SOAL.
- Array 'questions' dalam format JSON hasil kembalian Anda harus berisi TEPAT ${totalSoal} objek soal (tidak boleh kurang dari ${totalSoal}, tidak boleh lebih dari ${totalSoal}).
- Rincian per tipe soal yang harus dibuat wajib sesuka hati/teratur:
${tipeSoalList && tipeSoalList.length > 0 ? tipeSoalList.map((t: any) => `  * Tipe '${t.type}' harus dibuat TEPAT SEKALI ${t.count} butir soal.`).join("\n") : `  * Campuran, total ${totalSoal} soal.`}

PERINGATAN KERAS: Kegagalan mengembalikan tepat ${totalSoal} soal adalah kesalahan fatal! Jangan tambahkan soal bonus, soal variasi, atau alternatif. Hitung ulang jumlah objek dalam array 'questions' sebelum mengirim jawaban Anda untuk memastikan totalnya tepat ${totalSoal}!

INFORMASI SPESIFIK ARTIFAK SOAL:
- Mata Pelajaran: ${subject}
- Jenjang: ${level}
- Fase: ${fase}
- Kelas: ${kelas}
- Sumber Konten / Sasaran Pembelajaran:
${formattedSumberKonten}

- Rencana Tipe Soal & Porsi Bergambar:
${formattedTipeSoal}

- Dimensi Profil Lulusan yang difokuskan: ${dimensiProfil && dimensiProfil.length > 0 ? dimensiProfil.join(", ") : "Semua Dimensi"}
- Kerangka Taksonomi Utama: ${taksonomi} ${taksonomiLevels && taksonomiLevels.length > 0 ? `(HANYA pilih tingkatan/level dari daftar ini: ${taksonomiLevels.join(", ")})` : `(Gunakan level ${taksonomi === "SOLO" ? "Taksonomi SOLO: Unistruktural, Multistruktural, Relasional, Abstrak Diperluas" : "Taksonomi BLOOM: Mengingat, Memahami, Menerapkan, Menganalisis, Mengevaluasi, Mencipta"})`}

- Bahasa & Penulisan Arab: ${soalBahasaArab ? "WAJIB menyertakan tulisan Arab asli (lengkap dengan harakat/tanda baca/syakal yang tepat dan rapi) pada teks stimulus, kisah, ayat, kutipan, atau butir pertanyaan utama, bersandingan dengan transliterasi atau terjemahan Bahasa Indonesia yang lurus, agar sesuai untuk pengajaran Bahasa Arab / Pendidikan Agama Islam di sekolah Indonesia." : "Bahasa Indonesia standar."}
- Jumlah Opsi Jawaban Pilihan Ganda: Untuk setiap soal Pilihan Ganda (MCQ) maupun Pilihan Ganda Kompleks, Anda wajib menyajikan persis ${mcqOptionsCount} opsi pilihan jawaban (dimulai dari A sampai ${mcqOptionsCount === 5 ? "E" : mcqOptionsCount === 4 ? "D" : "C"}). Teks pilihan jawaban harus diawali dengan abjad tersebut secara konsisten (contoh: "A. ", "B. ", "C. ", ...).

- Integrasi Konteks Lokal Indonesia: ${konteksLokal && konteksLokal.active ? `AKtif di Provinsi ${konteksLokal.provinsi}. Perintah tambahan: ${konteksLokal.perintahTambahan || "Tidak ada"}` : "Tidak aktif"}
- Opsi Penjelasan Pilihan Ganda: ${includeMcqExplanation ? "Aktif" : "Tidak Aktif"}. ${includeMcqExplanation ? "Wajib memberikan pembahasan detail dan analisis distraktor di bagian rubrikAsesmen untuk soal Pilihan Ganda dan Pilihan Ganda Kompleks." : "DILARANG menuliskan penjelasan atau pembahasan panjang untuk soal Pilihan Ganda dan Pilihan Ganda Kompleks pada correctAnswer maupun rubrikAsesmen, melainkan CUKUP berikan jawaban singkat dan pedoman penskoran sederhana secara ringkas guna menghemat token."}

PANDUAN KURIKULUM NASIONAL:
1. Prinsip Utama:
   - Berkesadaran (Mindful): Mengajak murid memahami tujuan belajar, menilai dirinya sendiri, regulasi diri, berpikir komputasional/logis runtut.
   - Bermakna (Meaningful): Menghubungkan materi dengan kehidupan nyata, isu lokal/global, kontekstual, pemecahan masalah konkret, bukan sekadar hafalan.
   - Menggembirakan (Joyful): Menantang tapi menyenangkan, memicu "AHA moment" (momen penemuan solusi kreatif), bebas berekspresi secara cerdas.
2. Taksonomi SOLO vs BLOOM:
   - Jika taksonomi terpilih adalah SOLO, gunakan level: Unistruktural (1 aspek), Multistruktural (beberapa aspek terpisah), Relasional (menghubungkan), Abstrak Diperluas (generalisasi global & aksi nyata).
   - Jika taksonomi terpilih adalah BLOOM, gunakan level: Mengingat (C1), Memahami (C2), Menerapkan (C3), Menganalisis (C4), Mengevaluasi (C5), Mencipta (C6).
3. Gambar / Ilustrasi Soal:
   - Untuk soal yang ditandakan sebagai bergambar (sesuai 'illustratedCount' pilihan tipe soal), set 'hasIllustration' bernilai true.
   - Tuliskan 'illustrationPrompt' berupa instruksi deskripsi visual yang sangat detail (dalam bahasa Inggris, style: "cute cartoon hand-drawn flat illustration, vivid colors, educational book style") yang menggambarkan skenario/kasus di soal tersebut. Jangan tampilkan teks gambar di lembar soal siswa, ini akan divisualisasikan nanti.

PANDUAN STANDAR KAIDAH PENULISAN SOAL KURIKULUM NASIONAL (KEMENDIKDASMEN):
Anda WAJIB mematuhi seluruh kaidah perumusan soal dari dokumen resmi berikut:
1. KETENTUAN POKOK SOAL (STEM):
   - Harus dirumuskan secara Jelas, Tegas, dan Spesifik. Hindari pokok soal yang menggantung. Harus memperlihatkan apa yang ditanyakan secara utuh.
   - Wajib memiliki struktur tata bahasa yang lengkap: Memenuhi unsur SUBJEK dan PREDIKAT yang jelas.
   - Keras menghindari pokok soal yang hanya berwujud Anak Kalimat (Klausa Dependen). Jika berupa kalimat rumpang, pastikan itu berupa struktur kalimat yang utuh.
   - Hindari penggunaan kata depan yang menutup Subjek di awal kalimat (misal: "Di dalam perkembangan...", "Untuk mewujudkan..."). Hilangkan kata depan tersebut bila mengaburkan Subjek ("Perkembangan..." atau "Cara mewujudkan...").
   - DILARANG mengandung petunjuk tersembunyi (clue) yang mengarah secara langsung pada kunci jawaban yang benar (misalnya sebutan nama/istilah kunci yang tercantum di stem tapi juga diulang di kunci jawaban).
   - ANTI-BOCOR STIMULUS (SANGAT PENTING / CRITICAL): Teks stimulus/cerita/skenario pendukung yang diletakkan di awal soal DILARANG KERAS mengandung kalimat definisi langsung atau penjelasan harfiah yang membocorkan langsung kunci jawaban untuk pertanyaan di bawahnya. 
     * CONTOH YANG SANGAT SALAH (DILARANG): Stimulus menuliskan "Di dalam paru-paru, tepatnya di alveolus, terjadi pertukaran oksigen dan karbon dioksida", lalu pertanyaan di bawahnya "Organ pernapasan tempat pertukaran oksigen dan karbon dioksida adalah...". Ini adalah kebocoran fatal karena murid hanya perlu menyalin kata-kata dari teks tanpa berpikir kritis.
     * CONTOH YANG BENAR (REKOMENDASI): Stimulus menyajikan skenario klinis, eksperimentasi, atau deskripsi proses fungsional tanpa langsung menyebut nama spesifik organnya (misal: "Dokter mendeteksi adanya penumpukan cairan pada gelembung-gelembung udara kecil di ujung bronkiolus pasien. Kondisi ini secara langsung menghalangi lancarnya proses difusi gas oksigen ke sel darah merah..."), lalu pertanyaan menanyakan nama bagian tersebut atau dampak lebih lanjut ("Bagian paru-paru yang dimaksud pada kasus tersebut adalah..."). Hal ini memaksa siswa menghubungkan konsep fungsional (difusi gas pada gelembung kecil) untuk menyimpulkan jawabannya secara aktif dan bernalar kritis.
   - DILARANG mengandung pernyataan NEGATIF GANDA (e.g. "Berikut yang tidak termasuk ..., kecuali ..."). Bila ada pernyataan negatif, harus tunggal dan gunakan huruf kapital tegas (e.g. "yang BUKKAN merupakan...," "yang KECUALI...").
   - Setiap butir soal harus mandiri (IDEPENDEN) dan sama sekali tidak boleh bergantung pada jawaban butir soal sebelumnya.
   - Hindari kata yang bermakna tidak pasti seperti: "sebaiknya", "umumnya", "kadang-kadang".

2. KETENTUAN PILIHAN JAWABAN (OPSI MULTIPLE CHOICE) - Berlaku untuk Pilihan Ganda:
   - Harus HOMOGEN secara materi dan LOGIS dari segi substansi. Pengecoh (distractors) harus berfungsi dengan baik (sejenis dan setara dalam kategori teoritis yang sama).
   - Hanya boleh dan wajib memiliki SATU kunci jawaban yang mutlak benar atau paling benar.
   - Panjang rumusan pilihan jawaban (A, B, C, D, dst) harus relatif SAMA dan SEJAJAR. Jangan membuat kunci jawaban tampak lebih panjang, lebih rinci, atau lebih ilmiah daripada opsi pengecoh lainnya.
   - DILARANG menggunakan pilihan jawaban penyapu jagat seperti "Semua pilihan di atas benar" atau "Semua pilihan di atas salah".
   - Pilihan jawaban berbentuk ANGKA atau URUTAN WAKTU wajib disusun secara berurutan berurutan (dari yang terkecil ke terbesar, atau sebaliknya) atau urutan kronologis yang runtut (bukan acak).
   - Opsi pilihan ganda HARUS konsisten berjumlah ${mcqOptionsCount} (diawali A sampai ${mcqOptionsCount === 5 ? "E" : mcqOptionsCount === 4 ? "D" : "C"}) dan teks setiap opsi secara eksplisit HARUS diawali dengan abjad tersebut: "A. ", "B. ", "C. ", "D. ", "E. " dst (dengan titik dan spasi).
   - Opsi jawaban tidak boleh mengulang frasa yang bukan kesatuan pengertian. Jika semua opsi memiliki awal kata yang sama, pindahkan awal kata tersebut ke pokok soal (stem).
   - DILARANG KERAS mencatatkan / menyantumkan daftar pilihan jawaban (seperti "A. ..., B. ...") di dalam teks utama soal (lapisan 'text' / stem). Daftar pilihan jawaban HANYA boleh dicantumkan pada array 'options'. Parameter 'text' wajib murni hanya berisi stimulus dan butir pertanyaan saja tanpa pilihan ganda didalamnya. Jelas sekali bahwa pilihan jawaban tidak boleh ditulis ganda di dalam soal.

3. KETENTUAN SOAL PILIHAN GANDA KOMPLEKS (PGK):
   - Merupakan soal di mana murid dapat dan boleh memilih LEBIH DARI SATU jawaban yang benar (jawaban benar bisa minimal 2 atau beberapa pernyataan yang benar).
   - DILARANG KERAS membuat semua pilihan jawaban (A, B, C, D, dst) bernilai BENAR sekaligus. Selalu ada minimal 1-2 opsi yang SALAH/Pengecoh (distractor) yang logis namun tidak tepat. Pastikan terdapat kombinasi variatif (misal: "A dan C benar", atau "B, C, dan D benar", dll), bukan semuanya benar secara sepele.
   - "options" harus berisi pilihan jawaban sebanyak ${mcqOptionsCount} opsi dengan awalan abjad ("A. ", "B. ", "C. ", etc.). DILARANG KERAS menuliskan daftar pilihan tersebut di dalam teks utama soal ('text'). Teks utama 'text' hanya boleh berisi stimulus dan pertanyaan.
   - "correctAnswer" harus mencantumkan seluruh opsi/huruf yang benar secara eksplisit dan sangat jelas (misalnya: "Jawaban Benar: B dan D" atau "A, C, dan D benar").
   - Rubrik penilaian harus menjelaskan pedoman pemberian skor bertingkat jika siswa menjawab sebagian benar dengan tepat.

4. KETENTUAN SOAL MENJODOHKAN:
   - Siswa diminta memasangkan pernyataan (premis di sebelah kiri/atau daftar butir) dengan opsi jawaban (respons di sebelah kanan/atau daftar alternatif) yang paling tepat.
   - Pada bagian teks pokok soal ("text"), Anda wajib menyajikan dan menuliskan daftar premis (ditandai dengan angka 1, 2, 3...) dan rincian pilihan respon/jodohannya (ditandai dengan huruf kecil x, y, z...). Jangan buat terlalu panjang agar tidak bertele-tele.
   - Lapisan "options" diisi dengan array kosong [] secara mutlak.
   - "correctAnswer" harus berisi ringkasan pasangan jodoh yang tepat dan presisi (misalnya: "1-y, 2-x, 3-z") beserta ulasan kebenaran secara singkat.

5. KETENTUAN SOAL ISIAN / JAWABAN SINGKAT:
   - Jawaban yang dituntut harus sangat singkat, pasti (deterministik), dan sangat objektif, biasanya berupa SATU kata, nama tokoh, frasa pendek spesifik, angka, satuan, tempat, atau waktu historis yang sudah mutlak benarnya.
   - DILARANG menggunakan tipe Isian Singkat untuk pertanyaan analisis subjektif atau pemaknaan nilai moral (seperti "Nilai moral yang harus dihindari adalah ____________" atau "Amanat cerita adalah ____________"). Pertanyaan bernuansa analisis nilai, amanat, budi pekerti, atau interpretasi subjektif yang memiliki banyak sinonim WAJIB diserahkan ke tipe Pilihan Ganda, Pilihan Ganda Kompleks, atau Uraian (Essay), BUKAN Isian Singkat.
   - Preamble/stimulus pendukung pada rumpun soal Isian Singkat harus kongruen dan BEBAS dari kontradiksi logis atau kebocoran jawaban (clues) secara tidak sengaja.
   - Bagian yang dikosongkan MAKSIMUM DUA (2) rumpang untuk satu kalimat soal demi menjaga kejelasan konteks berpikir siswa.
   - Hindari menyalin langsung kalimat utuh dari buku paket/teks utama untuk mencegah siswa menghafal pasif.

6. KETENTUAN SOAL URAIAN (ESSAY):
   - Harus menggunakan kata tanya atau perintah yang menuntut jawaban analisis/terurai, contoh: "mengapa", "bagaimana", "jelaskan", "tuliskan dan jelaskan", "analisislah". Keras hindari pertanyaan uraian tertutup berbunyi "apakah" atau "berapa".
   - Harus memiliki batasan pertanyaan dan ruang lingkup jawaban yang diharapkan secara jelas agar guru dapat menilainya dengan objektif.
   - Wajib menyertakan pedoman penskoran atau kriteria rubrik penilaian secara bertingkat dan logis.

7. KAIDAH BAHASA & KELAYAKAN SOSIAL:
   - Gunakan bahasa Indonesia baku yang baik dan benar sesuai standar EYD/PUEBI.
   - Dilarang menggunakan bahasa lokal/daerah setempat jika soal ditujukan untuk skala provinsi atau nasional.
   - Rumusan soal TIDAK BOLEH menyinggung perasaan siswa atau bias (menghindari isi SARA, diskriminasi gender, status ekonomi/sosial seperti menyebut kemiskinan keluarga, status anak yatim/piatu, atau kecacatan fisik).

ATURAN STRUKTUR OUTPUT:
- Soal harus ditulis dalam bahasa Indonesia yang baik, ramah guru, menggunakan kalimat pembuka kasus/konteks (stimulus) yang menarik. Gantilah dengan narasi studi kasus aktual, diagram imajiner, atau skenario kehidupan sehari-hari.
- Sediakan Pedoman Penilaian / Rubrik Asesmen yang spesifik untuk setiap soal, terutama untuk uraian, agar guru mendapatkan contoh kriteria penilaian (e.g. jika jawaban murid di tahap Unistruktural / Memahami dapat poin X, tahap Relasional / Menganalisis dapat poin Y).
- Sediakan analisis untuk guru berupa alasan penetapan Level Taksonomi dan Dimensi Profil Lulusan yang terintegrasi pada soal tersebut.
- Pastikan total jumlah soal sama dengan total jumlah dari akumulasi tipe soal yang diminta. Urutkan soal secara logis.
- FORMULASI DATA KISI-KISI EVALUASI RESMI INDONESIA (DILARANG MENULIS ULANG SOAL):
  Untuk setiap soal, Anda WAJIB memisahkan dan menetapkan parameter kisi-kisi formal berikut secara ideal sesuai panduan evaluasi nasional Kemendikbudristek:
  1. materiTopik: Tuliskan lingkup materi pokok atau sub-bab spesifik yang diuji, bukan cuma nama mata pelajaran umum (contoh: "Hubungan Antar-regulasi di Indonesia" atau "Perhitungan Gaya Gesek Bidang Miring").
  2. stimulusAsesmen: Jelaskan bentuk stimulus pendukung soal secara deskriptif/objektif (contoh: "Tabel perbandingan data ekspor-impor", "Wacana deskripsi pencemaran lingkungan akibat detergen", atau "Kasus interaksi sosial warga kompleks"). DILARANG menulis ulang kalimat pertanyaan/butir soal di sini!
  3. indikatorSoal: Susun rumusan indikator soal formal yang diawali dengan kata kerja operasional (KKO) setingkat jenjang taksonominya dengan pola kalimat baku: "Disajikan [stimulusAsesmen], peserta didik dapat [KKO] [materiTopik] dengan tepat/benar."
     Contoh: "Disajikan skenario kasus jual-beli dalam kehidupan warga desa, peserta didik dapat menganalisis hak-kewajiban pelaku ekonomi secara gotong royong dengan tepat."
     DILARANG keras menulis ulang atau menyalin kalimat butir soal pada bagian ini!
`;

    const qProps: any = {
      number: { type: Type.INTEGER },
      type: { type: Type.STRING, description: "Tipe soal, harus persis salah satu: 'Pilihan Ganda', 'Pilihan Ganda Kompleks', 'Menjodohkan', 'Isian Singkat', atau 'Uraian'" },
      hasIllustration: { type: Type.BOOLEAN, description: "True jika ini diatur sebagai soal bergambar/ilustrasi." },
      illustrationPrompt: { type: Type.STRING, description: "Prompt gambar bahasa inggris deskriptif bergaya 'cute cartoon hand-drawn, educational kids style'." }
    };
    const qReq = ["number", "type", "hasIllustration", "illustrationPrompt"];

    if (genOpts.soal) {
      qProps.text = { type: Type.STRING, description: "Teks lengkap soal beserta stimulus (studi kasus / cerita konteks di awal soal). JIKA tipe Pilihan Ganda atau Pilihan Ganda Kompleks, DILARANG KERAS mencatatkan / menyisipkan pilihan-pilihan jawaban (A, B, C, D) di dalam deskripsi teks ini, karena pilihan jawaban harus dimasukkan secara terpisah di parameter 'options' saja." };
      qProps.options = {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: `Opsi jawaban jika tipe soal Pilihan Ganda atau Pilihan Ganda Kompleks. Wajib terdiri dari persis ${mcqOptionsCount} opsi (dimulai dari A sampai ${mcqOptionsCount === 5 ? "E" : mcqOptionsCount === 4 ? "D" : "C"}). Setiap teks pilihan secara utuh wajib diawali dengan abjadnya (contoh: 'A. ...'). Jika tipe Menjodohkan/Isian/Uraian, isi dengan array kosong [] secara mutlak.`
      };
      qReq.push("text", "options");
    }

    if (genOpts.kunci) {
      qProps.correctAnswer = { type: Type.STRING, description: "Pilihan abjad kunci jawaban yang benar (misalnya 'A. ...' atau 'B. ...') jika tipe soal Pilihan Ganda. Jika Pilihan Ganda Kompleks, sebutkan opsi-opsi yang benar (misal 'A dan C'). Jika Menjodohkan, berikan rincian pasangan yang betul (misal '1-y, 2-x, 3-z'). Jika Isian/Uraian, isi dengan penjelasan solusi model ideal secara rinci." };
      qProps.rubrikAsesmen = { type: Type.STRING, description: includeMcqExplanation ? "Untuk Pilihan Ganda/Kompleks/Menjodohkan, wajib diisi dengan Penjelasan, Pembahasan mendalam, analisis distraktor, atau kunci pencocokan lengkap. Untuk Isian/Uraian, diisi dengan pedoman penskoran kriteria rubrik asesmen lengkap menentukan poin berdasarkan jawaban siswa." : "Untuk Pilihan Ganda/Kompleks/Menjodohkan, CUKUP diisi dengan pedoman penskoran singkat saja tanpa ulasan penjelasan/pembahasan opsi (misalnya: '+1 poin jika benar, 0 jika salah'). Untuk Isian/Uraian, diisi dengan pedoman penskoran kriteria rubrik asesmen lengkap menentukan poin berdasarkan jawaban siswa." };
      qReq.push("correctAnswer", "rubrikAsesmen");
    }

    if (genOpts.analisis) {
      qProps.taxonomyLevel = { type: Type.STRING, description: "Level Taksonomi terpilih (contoh SOLO: 'Relasional' / 'Abstrak Diperluas' atau BLOOM: 'Menganalisis' / 'Mengevaluasi')" };
      qProps.taxonomyAnalysis = { type: Type.STRING, description: "Analisis singkat mengapa soal ini masuk kategori tersebut dan apa yang diuji pada progres berfikir siswa." };
      qProps.profilLulusanDimensi = { type: Type.STRING, description: "Dimensi Profil Lulusan yang disasar, contoh: 'Penalaran Kritis & Kemandirian'" };
      qProps.prinsipPM = { type: Type.STRING, description: "Analisis deskriptif mendalam terkait penerapan Dimensi Profil Lulusan yang digunakan pada soal ini. Penjelasan wajib murni menceritakan bagaimana dimensi Profil Lulusan tersebut dilatih, ditunjukkan, dan diukur melalui pengerjaan soal ini oleh siswa. DILARANG keras menyangkutkan, menyebut, atau mengawalinya dengan kata/frasa prinsip 'Bermakna:', 'Berkesadaran:', atau 'Menggembirakan:'." };
      qReq.push("taxonomyLevel", "taxonomyAnalysis", "profilLulusanDimensi", "prinsipPM");
    }

    if (genOpts.kisi) {
      qProps.materiTopik = { type: Type.STRING, description: "Sub-materi/topik pokok bahasan spesifik yang diuji." };
      qProps.stimulusAsesmen = { type: Type.STRING, description: "Deskripsi stimulus ringkas dan objektif (contoh: 'Gambar...', 'Tabel...', atau 'Skenario...'). Jangan ulangi soal." };
      qProps.indikatorSoal = { type: Type.STRING, description: "Rumusan indikator soal baku: 'Disajikan [stimulus], peserta didik dapat [KKO] [materi] dengan tepat/benar.' Jangan ulangi soal." };
      qReq.push("materiTopik", "stimulusAsesmen", "indikatorSoal");
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: "You are an expert assessment designer for Indonesian Schools under the national curriculum. You must output RAW JSON ONLY matching the provided responseSchema. No markdown wrappers (like ```json), no conversational opening, no notes, no fillers, and no trailers.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["title", "subject", "fase", "kelas", "questions"],
          properties: {
            title: {
              type: Type.STRING,
              description: "Judul paket soal ujian, contoh: Soal Asesmen Sumatif IPAS Kelas 5 SD - Ekosistem Danau"
            },
            subject: { type: Type.STRING },
            fase: { type: Type.STRING },
            kelas: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: qReq,
                properties: qProps
              }
            }
          }
        }
      }
    });

    const textOutput = response.text;
    if (!textOutput) {
      return NextResponse.json(
        { error: "Gagal memproses pembuatan soal dari model AI." },
        { status: 500 }
      );
    }

    const data = JSON.parse(textOutput.trim());
    return NextResponse.json({
      ...data,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount || Math.round(prompt.length / 3.8),
        outputTokens: response.usageMetadata?.candidatesTokenCount || Math.round(textOutput.length / 3.4)
      }
    });
  } catch (error: any) {
    console.error("Generate Questions Error:", error);
    return NextResponse.json(
      { error: error?.message || "Terjadi kesalahan internal ketika menghubungi Gemini API." },
      { status: 500 }
    );
  }
}
