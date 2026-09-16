"use client";

import React, { useState, useEffect } from "react";
import {
  Sparkles,
  BookOpen,
  GraduationCap,
  Layers,
  Settings,
  PlusCircle,
  Copy,
  Printer,
  Download,
  History,
  Info,
  CheckCircle2,
  Cpu,
  Trash2,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Edit2,
  FileText,
  Bookmark,
  Share2,
  HelpCircle,
  AlertCircle,
  Heart,
  Undo2,
  Search,
  Check,
  Award,
  Plus,
  MapPin,
  Image as ImageIcon,
  CheckSquare,
  HelpCircle as HelpIcon,
  RefreshCw,
  FileSpreadsheet,
  Upload,
  Key,
  Eye,
  EyeOff,
  Sliders,
  Languages,
  Facebook,
  Youtube,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type SibiBook, type SibiChapter } from "./bookTypes";
import { SIBI_BOOKS } from "./sibiBooksData";
import { PANDUAN_BOOKS as BASE_PANDUAN_BOOKS } from "./panduanBooksData";
import { NEW_PANDUAN_BOOKS } from "./panduanNewBooksData";
import TaxonomyChart from "./TaxonomyChart";

const PANDUAN_BOOKS = [...BASE_PANDUAN_BOOKS, ...NEW_PANDUAN_BOOKS];

// Interface definitions matches latest Kemendikbud 2026 Deep Learning standards
interface Question {
  number: number;
  text?: string;
  type: string; // "Pilihan Ganda" | "Isian Singkat" | "Uraian"
  options?: string[]; // Only for Pilihan Ganda
  correctAnswer?: string;
  rubrikAsesmen?: string;
  taxonomyLevel?: string;
  taxonomyAnalysis?: string;
  profilLulusanDimensi?: string;
  prinsipPM?: string;
  hasIllustration: boolean;
  illustrationPrompt: string;
  renderedSvg?: string; // Loaded dynamically via button
  indikatorSoal?: string;
  stimulusAsesmen?: string;
  materiTopik?: string;
}

interface QuestionPackage {
  id: string;
  title: string;
  subject: string;
  fase: string;
  kelas: string;
  timestamp: string;
  questions: Question[];
  taksonomi?: "SOLO" | "BLOOM";
}

interface QuestionBlock {
  type: "text" | "table";
  content: string | string[][];
}

function parseTextWithTables(text: string): QuestionBlock[] {
  if (!text) return [];
  
  // 1. Normalize line endings and escaped newlines
  let normalized = text
    .replace(/\\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n");

  // 2. Heat-fix missing newlines in concatenated table rows
  // Specifically target lowercase followed by capitalized words (camelCase row start transition e.g., "TerjualNasi")
  // and digits followed by capitalized words (column value to row start transition e.g., "45Gado")
  // MUST NOT match class names like "1A", "2B", "Kelas 10A" or units like "30porsi", "100ml".
  if (normalized.includes("|")) {
    normalized = normalized
      .replace(/([a-z])([A-Z][a-z])/g, "$1\n$2") // camelCase transition: e.g. "TerjualNasi"
      .replace(/(\d+)([A-Z][a-z])/g, "$1\n$2")  // number/letter transition: e.g. "45Gado"
      .replace(/:([A-Z][a-z])/g, ":\n$1");      // colon/capital transition: e.g. "sehari:Menu"
  }

  const lines = normalized.split("\n");
  const blocks: QuestionBlock[] = [];
  
  let currentTableRows: string[][] = [];
  let textBuffer: string[] = [];

  const flushTextBuffer = () => {
    if (textBuffer.length > 0) {
      blocks.push({
        type: "text",
        content: textBuffer.join("\n")
      });
      textBuffer = [];
    }
  };

  const flushTable = () => {
    if (currentTableRows.length > 0) {
      if (currentTableRows.length < 2) {
        // Not enough rows to be a table, turn back into text lines
        currentTableRows.forEach((row) => {
          textBuffer.push(row.join(" | "));
        });
        currentTableRows = [];
      } else {
        // Flush any existing buffered text first before displaying the table
        flushTextBuffer();
        
        const cleanedRows = currentTableRows.filter((row, idx) => {
          if (idx === 1) {
            const isSep = row.every(cell => /^[-\s:|]+$/.test(cell.trim()) && cell.trim().length > 0);
            if (isSep) return false;
          }
          return true;
        });
        
        blocks.push({
          type: "table",
          content: cleanedRows
        });
        currentTableRows = [];
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    const isTableRow = trimmed.includes("|") && trimmed.length > 2;

    if (isTableRow) {
      const cells = line.split("|").map(c => c.trim());
      if (line.trim().startsWith("|")) cells.shift();
      if (line.trim().endsWith("|")) cells.pop();
      currentTableRows.push(cells);
    } else {
      flushTable();
      textBuffer.push(line);
    }
  }

  flushTable();
  flushTextBuffer();

  return blocks;
}

interface MenjodohkanData {
  introduction: string;
  premis: { key: string; text: string }[];
  responses: { key: string; text: string }[];
  premisHeader: string;
  responsesHeader: string;
}

function parseMenjodohkan(text: string): MenjodohkanData {
  const lines = text.split("\n");
  const premis: { key: string; text: string }[] = [];
  const responses: { key: string; text: string }[] = [];
  const introductionLines: string[] = [];
  
  let premisHeader = "Pernyataan / Premis (Kanan)";
  let responsesHeader = "Pilihan Jawaban (Kiri)";

  let inPremisSection = false;
  let inResponsesSection = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const lower = trimmed.toLowerCase();
    
    // Check if we hit specific dividers/headers
    if (lower.includes("premis") || lower.includes("pernyataan") || lower.includes("kolom a") || lower.includes("kiri")) {
      inPremisSection = true;
      inResponsesSection = false;
      const cleanHeader = trimmed.replace(/[\*\_]+/g, "").trim();
      if (cleanHeader) {
        premisHeader = cleanHeader;
      }
      continue;
    }
    if (lower.includes("pilihan") || lower.includes("respon") || lower.includes("jawaban") || lower.includes("kolom b") || lower.includes("kanan")) {
      inPremisSection = false;
      inResponsesSection = true;
      const cleanHeader = trimmed.replace(/[\*\_]+/g, "").trim();
      if (cleanHeader) {
        responsesHeader = cleanHeader;
      }
      continue;
    }

    // Matching:
    // 1-3 digits followed by punctuation and text
    const numMatch = trimmed.match(/^(\d{1,3})\s*[\.\)\]]\s*(.+)$/);
    // Single letter followed by punctuation and text
    const charMatch = trimmed.match(/^([a-zA-Z])\s*[\.\)\]]\s*(.+)$/);

    if (numMatch && (inPremisSection || !inResponsesSection)) {
      premis.push({ key: numMatch[1], text: numMatch[2].trim() });
    } else if (charMatch && (inResponsesSection || /^[a-zA-Z]$/.test(charMatch[1]))) {
      responses.push({ key: charMatch[1].toUpperCase(), text: charMatch[2].trim() });
    } else {
      introductionLines.push(line);
    }
  }

  // Fallback if structured section tags didn't help or returned 0 items:
  if (premis.length === 0 || responses.length === 0) {
    premis.length = 0;
    responses.length = 0;
    introductionLines.length = 0;

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const numMatch = trimmed.match(/^(\d{1,3})\s*[\.\)\]]\s*(.+)$/);
      const charMatch = trimmed.match(/^([a-zA-Z])\s*[\.\)\]]\s*(.+)$/);

      if (numMatch) {
         premis.push({ key: numMatch[1], text: numMatch[2].trim() });
      } else if (charMatch) {
         responses.push({ key: charMatch[1].toUpperCase(), text: charMatch[2].trim() });
      } else {
         introductionLines.push(line);
      }
    }
  }

  // Clean trailing colons or punctuation from the headers
  const sanitizeHeader = (h: string) => {
    return h.replace(/^[:\-\s]+|[:\-\s]+$/g, "").trim();
  };

  return {
    introduction: introductionLines.join("\n"),
    premis,
    responses,
    premisHeader: sanitizeHeader(premisHeader),
    responsesHeader: sanitizeHeader(responsesHeader)
  };
}

// Class configs for table sizing options
const tableClasses = {
  kecil: {
    font: "text-[9px]",
    padding: "p-1 md:p-1.5",
    margin: "my-1.5",
  },
  sedang: {
    font: "text-[10.5px]",
    padding: "p-2",
    margin: "my-3",
  },
  besar: {
    font: "text-xs md:text-sm",
    padding: "p-3.5",
    margin: "my-5",
  }
};

const QuestionTextRenderer = ({ text, tableSize = "sedang" }: { text: string, tableSize?: "kecil" | "sedang" | "besar" }) => {
  if (!text) return null;
  const blocks = parseTextWithTables(text);
  
  const sizeConfig = tableClasses[tableSize] || tableClasses.sedang;

  return (
    <div className="space-y-2">
      {blocks.map((block, idx) => {
        if (block.type === "text") {
          return (
            <p key={idx} className="text-slate-900 text-sm font-semibold leading-relaxed whitespace-pre-line pr-4">
              {block.content as string}
            </p>
          );
        } else {
          const rows = block.content as string[][];
          if (rows.length === 0) return null;

          // Symmetrically pad shorter table rows to match column max
          const maxCols = Math.max(...rows.map(r => r.length), 1);
          const paddedRows = rows.map(r => {
            const copy = [...r];
            while (copy.length < maxCols) {
              copy.push("");
            }
            return copy;
          });

          const headers = paddedRows[0];
          const bodyRows = paddedRows.slice(1);
          return (
            <div key={idx} className={cn("overflow-x-auto border-2 border-slate-950 rounded-lg bg-white shadow-xs max-w-full", sizeConfig.margin)}>
              <table className={cn("w-full text-left border-collapse font-sans", sizeConfig.font)}>
                <thead>
                  <tr className="bg-slate-50 border-b-2 border-slate-950 text-slate-900 font-extrabold uppercase">
                    {headers.map((cell, cIdx) => (
                      <th key={cIdx} className={cn("border-r border-slate-300 last:border-r-0", sizeConfig.padding)}>
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 text-slate-800 bg-white">
                  {bodyRows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className={cn("border-r border-slate-300 last:border-r-0 font-medium", sizeConfig.padding)}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
      })}
    </div>
  );
};

interface ContentSourceItem {
  id: string;
  type: "Tujuan Pembelajaran (TP)" | "Lingkup Materi";
  text: string;
}

interface QuestionTypeRow {
  id: string;
  type: "Pilihan Ganda" | "Pilihan Ganda Kompleks" | "Menjodohkan" | "Isian Singkat" | "Uraian";
  count: number | string;
  illustratedCount: number | string;
}

const LIST_MAPEL = [
  "Ilmu Pengetahuan Alam dan Sosial (IPAS)",
  "Matematika",
  "Pendidikan Pancasila",
  "Bahasa Indonesia",
  "Bahasa Inggris",
  "Seni Rupa",
  "Seni Musik",
  "Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)"
];

const MAPEL_BY_JENJANG: Record<string, string[]> = {
  SD: [
    "Ilmu Pengetahuan Alam dan Sosial (IPAS)",
    "Matematika",
    "Pendidikan Pancasila",
    "Bahasa Indonesia",
    "Bahasa Inggris",
    "Seni Rupa",
    "Seni Musik",
    "Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)",
    "Lainnya..."
  ],
  SMP: [
    "Ilmu Pengetahuan Alam (IPA)",
    "Ilmu Pengetahuan Sosial (IPS)",
    "Matematika",
    "Pendidikan Pancasila",
    "Bahasa Indonesia",
    "Bahasa Inggris",
    "Informatika",
    "Pendidikan Jasmani, Olahraga, dan Kesehatan (PJOK)",
    "Seni dan Prakarya",
    "Lainnya..."
  ],
  SMA: [
    "Fisika",
    "Kimia",
    "Biologi",
    "Matematika",
    "Bahasa Indonesia",
    "Bahasa Inggris",
    "Sejarah",
    "Sosiologi",
    "Ekonomi",
    "Geografi",
    "Pendidikan Pancasila",
    "Informatika",
    "Lainnya..."
  ],
  SMK: [
    "Dasar-Dasar Program Keahlian",
    "Informatika",
    "Matematika",
    "Bahasa Indonesia",
    "Bahasa Inggris",
    "Pendidikan Pancasila",
    "Proyek Kreatif dan Kewirausahaan",
    "Praktik Kerja Lapangan (PKL)",
    "Lainnya..."
  ]
};

const LIST_JENJANG = [
  { id: "SD", label: "Sekolah Dasar (SD)", active: true },
  { id: "SMP", label: "Sekolah Menengah Pertama (SMP)", active: true },
  { id: "SMA", label: "Sekolah Menengah Atas (SMA)", active: true },
  { id: "SMK", label: "Sekolah Menengah Kejuruan (SMK)", active: true }
];

const LIST_FASE = [
  { id: "Fase A", label: "Fase A (Kelas 1-2 SD)", kelas: ["Kelas 1", "Kelas 2"], level: "SD" },
  { id: "Fase B", label: "Fase B (Kelas 3-4 SD)", kelas: ["Kelas 3", "Kelas 4"], level: "SD" },
  { id: "Fase C", label: "Fase C (Kelas 5-6 SD)", kelas: ["Kelas 5", "Kelas 6"], level: "SD" },
  { id: "Fase D", label: "Fase D (Kelas 7-9 SMP)", kelas: ["Kelas 7", "Kelas 8", "Kelas 9"], level: "SMP" },
  { id: "Fase E", label: "Fase E (Kelas 10 SMA/SMK)", kelas: ["Kelas 10"], levels: ["SMA", "SMK"] },
  { id: "Fase F", label: "Fase F (Kelas 11-12 SMA/SMK)", kelas: ["Kelas 11", "Kelas 12"], levels: ["SMA", "SMK"] }
];

const LIST_DIMENSI_PROFIL = [
  { id: "Keimanan & Ketakwaan", label: "Keimanan, Ketakwaan terhadap Tuhan YME & Akhlak Mulia" },
  { id: "Kewargaan", label: "Kewargaan (Cinta Tanah Air, Global & Common Good)" },
  { id: "Penalaran Kritis", label: "Penalaran Kritis (Analitis, Berpikir Komputasional & Bukti)" },
  { id: "Kreativitas", label: "Kreativitas (Gagasan Orisinal & Solusi Unik)" },
  { id: "Kolaborasi", label: "Kolaborasi (Kerjasama Gotong Royong & Berbagi)" },
  { id: "Kemandirian", label: "Kemandirian (Regulasi Diri & Belajar Sepanjang Hayat)" },
  { id: "Kesehatan", label: "Kesehatan (Well-being Fisik & Jiwa)" },
  { id: "Komunikasi", label: "Komunikasi (Menyimak, Membaca & Diskusi Santun)" }
];

const LIST_PROVINSI = [
  "Aceh",
  "Sumatra Utara",
  "Sumatra Barat",
  "Riau",
  "DKI Jakarta",
  "Jawa Barat",
  "Jawa Tengah",
  "DI Yogyakarta",
  "Jawa Timur",
  "Bali",
  "Nusa Tenggara Barat",
  "Nusa Tenggara Timur",
  "Kalimantan Barat",
  "Kalimantan Selatan",
  "Kalimantan Timur",
  "Sulawesi Utara",
  "Sulawesi Selatan",
  "Maluku",
  "Papua"
];

// Pre-programmed high quality Indonesian lesson packages (drawn from G.02.2026 modules)
const SAMPLE_TEMPLATES: Omit<QuestionPackage, "id" | "timestamp">[] = [
  {
    title: "Asesmen Sumatif IPAS Tematik Ekosistem Danau (Fase C)",
    subject: "Ilmu Pengetahuan Alam dan Sosial (IPAS)",
    fase: "Fase C",
    kelas: "Kelas 5",
    questions: [
      {
        number: 1,
        text: "Perhatikan gambar sekumpulan bebek liar dan angsa yang sedang berenang riang mencari makan di bagian tengah Danau Toba, Sumatra Utara. Suhu air danau mengalami penurunan mendadak sebesar 4°C selama musim pancaroba, yang menyebabkan berkurangnya oksigen terlarut di daerah tepian danau yang dangkal. Ikan-ikan kecil pun terlihat lemas dan banyak yang mati terapung. Berdasarkan informasi tersebut, jelaskan perbedaan dampak perubahan ekosistem air danau ini secara relasional antara populasi ikan dan populasi bebek!",
        type: "Uraian",
        correctAnswer: "Jawaban Ideal:\n1. Populasi Ikan Kecil: Mengalami dampak merugikan langsung (kematian akibat hipoksia). Hal ini karena ikan bernapas dengan insang yang menyaring oksigen terlarut dalam air (yang kadarnya menurun akibat fluktuasi suhu).\n2. Populasi Bebek/Angsa: Tidak mati secara langsung karena bebek bernapas dengan paru-paru dan mengambil oksigen dari udara bebas, bukan di dalam air.\n3. Hubungan Relasional: Bebek tetap terdampak secara tidak langsung karena ikan kecil yang mati adalah sumber makanan utama mereka. Bebek harus berpindah ke tengah danau atau bermigrasi mencari ekosistem rawa lain untuk bertahan hidup.",
        rubrikAsesmen: "Rubrik Penilaian SOLO:\n- Level Relasional (Cakep/Skor 4): Mengaitkan hubungan sebab-akibat dengan lengkap antara berkurangnya oksigen air, sistem pernapasan ikan vs bebek, dan imbas rantai makanannya.\n- Level Multistruktural (Layak/Skor 3): Menjelaskan dampak pada ikan dan bebek secara terpisah dengan benar, namun tidak menyangkutkan rantai makanan.\n- Level Unistruktural (Baru Berkembang/Skor 2): Hanya menjawab satu hewan saja, misal ikan mati tanpa menganalisis nasib bebek.",
        taxonomyLevel: "Relasional",
        taxonomyAnalysis: "Siswa diminta menghubungkan perubahan komponen abiotik (suhu, gas terlarut) dengan kelangsungan hidup komponen biotik (populasi organisme) secara ekosistemik.",
        profilLulusanDimensi: "Penalaran Kritis",
        prinsipPM: "Siswa dilatih untuk mengolah informasi lingkungan ekosistem dan mengaitkan konsep abiotik dengan perubahan biotik secara kritis.",
        hasIllustration: true,
        illustrationPrompt: "Cute cartoon illustration of two ducks swimming in a clean blue lake with small fishes visible underwater, beautiful hills of Danau Toba on the background, soft shadows, kid-friendly flat vector style",
        materiTopik: "Komponen Ekosistem dan Rantai Makanan",
        stimulusAsesmen: "Ilustrasi sekumpulan bebek liar dan angsa yang berenang di Danau Toba serta deskripsi fluktuasi suhu air danau",
        indikatorSoal: "Disajikan stimulus berupa gambar dan deskripsi mengenai fluktuasi abiotik (suhu) pada ekosistem danau, peserta didik dapat menganalisis hubungan relasional dampak perubahan abiotik terhadap populasi ikan dan bebek dengan tepat."
      },
      {
        number: 2,
        text: "Saat sedang mengamati ekosistem danau, Udin melihat tumpukan botol plastik bekas terapung di dekat tanaman eceng gondok. Sebagai bentuk rasa sayang terhadap ciptaan Tuhan Yang Maha Esa (akhlak mulia kepada alam), tuliskan langkah konkret yang bisa diambil Udin bersama sahabatnya untuk mendaur ulang botul-botul tersebut menjadi pot tanaman hias kreatif sekolah!",
        type: "Isian Singkat",
        correctAnswer: "Jawaban Ideal:\nLangkah daur ulang botol plastik: (1) Mengumpulkan botol plastik secara gotong royong, (2) Memotong botol bagian tengah dan melubangi bagian bawah untuk jalur air, (3) Menghias botol dengan cat warna-warni yang menggembirakan, (4) Mengisi tanah subur dan menanam bunga hias.",
        rubrikAsesmen: "Poin 4: Menyebutkan seluruh langkah daur ulang secara runtut serta menyangkutkan aspek gotong royong dan kesadaran menjaga alam ciptaan Tuhan.\nPoin 2: Hanya menuliskan memotong botol saja tanpa ada keterkaitan dengan nilai spiritual akhlak mulia.",
        taxonomyLevel: "Multistruktural",
        taxonomyAnalysis: "Mengidentifikasi beberapa langkah operasional daur ulang yang berurutan tanpa memerlukan analisis teoritis yang tinggi.",
        profilLulusanDimensi: "Keimanan & Ketakwaan, Kolaborasi",
        prinsipPM: "Siswa mempraktikkan akhlak mulia kepada alam ciptaan Tuhan melalui aksi gotong royong mendaur ulang secara nyata bersama rekan sebaya.",
        hasIllustration: false,
        illustrationPrompt: "",
        materiTopik: "Daur Ulang Sampah Plastik (Cinta Lingkungan)",
        stimulusAsesmen: "Studi kasus penumpukan botol plastik bekas di dekat tanaman eceng gondok",
        indikatorSoal: "Disajikan stimulus berupa studi kasus pencemaran sampah plastik di danau, peserta didik dapat merumuskan langkah konkret kolaboratif daur ulang botol plastik bekas menjadi pot hias sebagai perwujudan akhlak mulia kepada alam secara gotong royong."
      }
    ]
  }
];;
// Re-using types and metadata imported from booksData.ts;

// Pure helper function to prevent rendering issues and maintain rule of React purity
function generateUniqueId(prefix: string): string {
  if (typeof window !== "undefined") {
    return `${prefix}-${Math.floor(Math.random() * 10000000)}-${Date.now()}`;
  }
  return `${prefix}-${Math.floor(Math.random() * 10000000)}`;
}

const DEFAULT_LEFT_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="46" fill="%23f8fafc" stroke="%230f172a" stroke-width="4"/><polygon points="50,15 80,75 20,75" fill="%231e293b" stroke="%230f172a" stroke-width="2"/><circle cx="50" cy="53" r="16" fill="%230ea5e9"/><path d="M50,15 L50,90" stroke="%23ffffff" stroke-dasharray="2,2"/><text x="50" y="88" font-family="sans-serif" font-size="9" font-weight="bold" text-anchor="middle" fill="%23a1a1aa">TUT WURI</text></svg>`;
const DEFAULT_RIGHT_LOGO_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="46" fill="%23f0fdf4" stroke="%2316a34a" stroke-width="4"/><path d="M30,50 L45,65 L70,35" stroke="%2316a34a" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/><text x="50" y="85" font-family="sans-serif" font-size="8" font-weight="bold" text-anchor="middle" fill="%2316a34a">KURIKULUM</text></svg>`;

function getCurrentTimestamp(suffix?: string): string {
  const timeStr = typeof window !== "undefined" ? new Date().toLocaleString("id-ID") : "29/05/2026, 15:40";
  return suffix ? `${timeStr} (${suffix})` : timeStr;
}

// Stored requests statistics tracking helpers
function getStoredRequestStats(): { count: number; now: number } {
  if (typeof window === "undefined") return { count: 0, now: 0 };
  try {
    const nowStr = localStorage.getItem("ngidesoal_last_req_time");
    const currentReqsStr = localStorage.getItem("ngidesoal_reqs_this_minute");
    const now = Date.now();
    let count = 0;
    if (nowStr && currentReqsStr) {
      const lastReqTime = parseInt(nowStr, 10);
      const diffMs = now - lastReqTime;
      if (diffMs < 60000) {
        count = parseInt(currentReqsStr, 10);
      }
    }
    return { count, now };
  } catch (e) {
    return { count: 0, now: Date.now() };
  }
}

function updateStoredRequestStats(): number {
  if (typeof window === "undefined") return 1;
  try {
    const { count, now } = getStoredRequestStats();
    const updatedCount = count + 1;
    localStorage.setItem("ngidesoal_last_req_time", now.toString());
    localStorage.setItem("ngidesoal_reqs_this_minute", updatedCount.toString());
    return updatedCount;
  } catch (e) {
    return 1;
  }
}

function generateMockTokens(): { inputTokens: number; outputTokens: number } {
  return {
    inputTokens: Math.round(200 + Math.random() * 100),
    outputTokens: Math.round(80 + Math.random() * 60)
  };
}

// Move pure functions to file scope
function generateStaticChartsHtml(questions: Question[], taksonomi: string, soloLevels: string[], bloomLevels: string[]) {
  const activeLevels = taksonomi === "SOLO" ? soloLevels : bloomLevels;
  let maxTaxonomyCount = 0;
  const taxonomyData = activeLevels.map(level => {
    const count = questions.filter(q => {
      if (!q.taxonomyLevel) return false;
      const levelNorm = level.toLowerCase().trim();
      const qNorm = q.taxonomyLevel.toLowerCase().trim();
      return qNorm === levelNorm || qNorm.includes(levelNorm) || levelNorm.includes(qNorm);
    }).length;
    if (count > maxTaxonomyCount) maxTaxonomyCount = count;

    let shortName = level;
    if (taksonomi === "BLOOM") {
      if (level.includes("Mengingat")) shortName = "C1 Mengingat";
      else if (level.includes("Memahami")) shortName = "C2 Memahami";
      else if (level.includes("Menerapkan")) shortName = "C3 Menerapkan";
      else if (level.includes("Menganalisis")) shortName = "C4 Menganalisis";
      else if (level.includes("Mengevaluasi")) shortName = "C5 Mengevaluasi";
      else if (level.includes("Mencipta")) shortName = "C6 Mencipta";
    }
    return { name: level, displayName: shortName, count };
  });

  const dimensiCounts: { [key: string]: number } = {};
  questions.forEach(q => {
    const dim = q.profilLulusanDimensi || "Mandiri";
    let cleanDim = dim.split(',')[0].split('&')[0].trim();
    if (cleanDim.length > 25) cleanDim = cleanDim.slice(0, 22) + '...';
    dimensiCounts[cleanDim] = (dimensiCounts[cleanDim] || 0) + 1;
  });

  const dimensiData = Object.entries(dimensiCounts).map(([name, count]) => ({
    name,
    count,
  }));

  const barColors = ["#0d9488", "#0f766e", "#14b8a6", "#0284c7", "#3b82f6", "#6366f1"];
  const dimColors = ['#0d9488', '#4f46e5', '#ca8a04', '#059669', '#db2777', '#7c3aed', '#2563eb', '#dc2626'];

  const staticBarChartHtml = `
    <div style="font-family: sans-serif;">
      <h4 style="font-size: 11px; font-weight: 800; margin-bottom: 12px; color: #1e293b; text-transform: uppercase;">📊 Sebaran Level Taksonomi (${taksonomi})</h4>
      <div style="display: flex; flex-direction: column; gap: 6px;">
        ${taxonomyData.map((d, i) => {
          const widthPct = maxTaxonomyCount > 0 ? (d.count / maxTaxonomyCount) * 100 : 0;
          return `
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 90px; font-size: 9.5px; font-weight: 600; color: #475569;">${d.displayName}</div>
            <div style="flex: 1; background: #f1f5f9; height: 16px; border-radius: 4px; overflow: hidden; position: relative; border: 1px solid #e2e8f0;">
              <div style="width: ${widthPct}%; height: 100%; background: ${barColors[i % barColors.length]}; border-radius: 3px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;"></div>
            </div>
            <div style="width: 20px; font-size: 10px; font-weight: 700; color: #1e293b; text-align: right;">${d.count}</div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  let conicGradientStops = "";
  let currentDegree = 0;
  const totalDimensi = dimensiData.reduce((acc, curr) => acc + curr.count, 0) || 1;
  
  const legendHtml = dimensiData.map((d, i) => {
    const percentage = (d.count / totalDimensi) * 100;
    const degrees = (percentage / 100) * 360;
    const startDeg = currentDegree;
    const endDeg = currentDegree + degrees;
    const c = dimColors[i % dimColors.length];
    
    conicGradientStops += `${c} ${startDeg}deg ${endDeg}deg, `;
    currentDegree = endDeg;

    return `
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
        <div style="width: 10px; height: 10px; background: ${c}; border-radius: 2px; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;"></div>
        <div style="font-size: 9.5px; font-weight: 600; color: #475569;">${d.name} (${d.count})</div>
      </div>
    `;
  }).join("");
  
  conicGradientStops = conicGradientStops.replace(/, $/, "");

  const staticDonutChartHtml = dimensiData.length > 0 ? `
    <div style="font-family: sans-serif;">
      <h4 style="font-size: 11px; font-weight: 800; margin-bottom: 15px; color: #1e293b; text-transform: uppercase;">🎯 Orientasi Dimensi Profil Lulusan</h4>
      <div style="display: flex; align-items: center; gap: 25px;">
        <div style="position: relative; width: 120px; height: 120px; border-radius: 50%; background: conic-gradient(${conicGradientStops}); border: 1px solid #cbd5e1; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;">
          <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 65px; height: 65px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; flex-direction: column;">
            <span style="font-size: 8px; color: #64748b; font-weight: bold;">TOTAL</span>
            <span style="font-size: 16px; font-weight: 900; color: #0f172a;">${questions.length}</span>
          </div>
        </div>
        <div>
          ${legendHtml}
        </div>
      </div>
    </div>
  ` : `<div style="font-size:10px; color:#94a3b8; font-style:italic;">Belum ada data Dimensi Profil Lulusan</div>`;

  return { staticBarChartHtml, staticDonutChartHtml };
}

export default function NgideSoalPage() {
  const [subject, setSubject] = useState("Ilmu Pengetahuan Alam dan Sosial (IPAS)");
  const [customSubject, setCustomSubject] = useState("");
  const [level, setLevel] = useState("SD"); // Only SD selectable
  const [activeFaseId, setActiveFaseId] = useState("Fase C");
  const [kelas, setKelas] = useState("Kelas 5");
  const [taksonomi, setTaksonomi] = useState<"SOLO" | "BLOOM">("SOLO");
  const [soalBahasaArab, setSoalBahasaArab] = useState<boolean>(false);
  const [mcqOptionsCount, setMcqOptionsCount] = useState<number>(4);

  // Taxonomy Levels States
  const [soloLevels, setSoloLevels] = useState<string[]>(["Unistruktural", "Multistruktural", "Relasional", "Abstrak Diperluas"]);
  const [bloomLevels, setBloomLevels] = useState<string[]>(["Mengingat", "Memahami", "Menerapkan", "Menganalisis", "Mengevaluasi", "Mencipta"]);

  // Local context state
  const [konteksLokalActive, setKonteksLokalActive] = useState(false);
  const [provinsi, setProvinsi] = useState("Jawa Barat");
  const [perintahTambahan, setPerintahTambahan] = useState("");

  // Custom API configuration (End-user own keys/models)
  const [customApiKey, setCustomApiKeyState] = useState<string>("");
  const [customTextModel, setCustomTextModel] = useState<string>("gemini-2.5-flash");
  const [customImageModel, setCustomImageModel] = useState<string>("gemini-3.5-flash");
  const [showApiKeySettings, setShowApiKeySettings] = useState(false);
  const [showApiKeyText, setShowApiKeyText] = useState(false);

  // Wrapper setter to sync with localStorage
  const setCustomApiKey = (val: string) => {
    setCustomApiKeyState(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("ngidesoal_custom_api_key", val);
    }
  };
  const updateCustomTextModel = (val: string) => {
    setCustomTextModel(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("ngidesoal_custom_text_model", val);
    }
  };
  const updateCustomImageModel = (val: string) => {
    setCustomImageModel(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("ngidesoal_custom_image_model", val);
    }
  };

  // Content Source build-up list
  const [contentType, setContentType] = useState<"Tujuan Pembelajaran (TP)" | "Lingkup Materi">("Tujuan Pembelajaran (TP)");
  const [inputTextContent, setInputTextContent] = useState("");
  const [contentList, setContentList] = useState<ContentSourceItem[]>([]);

  // Selected graduate profile dimensions
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>(["Penalaran Kritis", "Keimanan & Ketakwaan"]);

  // Question Type dynamic list rows
  const [qTypeRows, setQTypeRows] = useState<QuestionTypeRow[]>([
    { id: "r-1", type: "Pilihan Ganda", count: 3, illustratedCount: 1 },
    { id: "r-2", type: "Uraian", count: 2, illustratedCount: 1 }
  ]);

  // UI operational states
  const [activePackage, setActivePackage] = useState<QuestionPackage | null>(null);
  const [historyPackages, setHistoryPackages] = useState<QuestionPackage[]>([]);
  const [activeTab, setActiveTab] = useState<"lembar" | "kisi" | "kunci" | "analisis">("lembar");
  const [activeMainMenu, setActiveMainMenu] = useState<"konfigurasi" | "hasil" | "riwayat">("konfigurasi");
  const [isLoading, setIsLoading] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

  // Setting Kop & Lembar Soal states
  const [showKopSettings, setShowKopSettings] = useState(false);
  const [kopNamaSekolah, setKopNamaSekolah] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_nama_sekolah") || "PEMERINTAH KABUPATEN / KOTA ADMINISTRATIF";
    }
    return "PEMERINTAH KABUPATEN / KOTA ADMINISTRATIF";
  });
  const [kopNamaInstansi, setKopNamaInstansi] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_nama_instansi") || "SD NEGERI CONTOH UNGGULAN";
    }
    return "SD NEGERI CONTOH UNGGULAN";
  });
  const [kopAlamat, setKopAlamat] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_alamat") || "Jalan Raya Pendidikan No. 123, Kabupaten/Kota, Indonesia";
    }
    return "Jalan Raya Pendidikan No. 123, Kabupaten/Kota, Indonesia";
  });
  const [kopShowLeftLogo, setKopShowLeftLogo] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_show_left") === "true";
    }
    return false;
  });
  const [kopShowRightLogo, setKopShowRightLogo] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_show_right") === "true";
    }
    return false;
  });
  const [kopLeftLogo, setKopLeftLogo] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_left_logo") || "";
    }
    return "";
  });
  const [kopRightLogo, setKopRightLogo] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_right_logo") || "";
    }
    return "";
  });
  const [kopBarisTambahan1, setKopBarisTambahan1] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_baris_tambahan_1") || "";
    }
    return "";
  });
  const [kopBarisTambahan2, setKopBarisTambahan2] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_baris_tambahan_2") || "";
    }
    return "";
  });
  const [tableSize, setTableSize] = useState<"kecil" | "sedang" | "besar">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ngidesoal_table_size") as "kecil" | "sedang" | "besar") || "sedang";
    }
    return "sedang";
  });
  const [customJudulAsesmen, setCustomJudulAsesmen] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_kop_judul_asesmen") || "";
    }
    return "";
  });

  // Checklist for student fields
  const [fieldNamaShow, setFieldNamaShow] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_field_nama") !== "false";
    }
    return true;
  });
  const [fieldNomorShow, setFieldNomorShow] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_field_nomor") !== "false";
    }
    return true;
  });
  const [fieldKelasShow, setFieldKelasShow] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_field_kelas") !== "false";
    }
    return true;
  });
  const [fieldMapelShow, setFieldMapelShow] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_field_mapel") !== "false";
    }
    return true;
  });
  const [fieldHariTanggalShow, setFieldHariTanggalShow] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_field_tanggal") !== "false";
    }
    return true;
  });
  const [fieldNilaiShow, setFieldNilaiShow] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("ngidesoal_field_nilai") !== "false";
    }
    return true;
  });

  const includeMcqExplanation = false;

  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState<boolean>(false);

  // New configuration states for printable sheet layout customizer
  const [layoutMcq, setLayoutMcq] = useState<"vertical" | "grid-2" | "horizontal">("vertical");
  const [fontSize, setFontSize] = useState<"xs" | "sm" | "base" | "lg">("sm");
  const [lineSpacing, setLineSpacing] = useState<"tight" | "normal" | "relaxed">("normal");
  const [imageSize, setImageSize] = useState<"small" | "medium" | "large">("medium");
  const [marginPdf, setMarginPdf] = useState<"small" | "medium" | "large">("medium");
  const [previewZoom, setPreviewZoom] = useState<number>(100);

  // States to choose which sections to print/download
  const [printSelectSoal, setPrintSelectSoal] = useState<boolean>(true);
  const [printSelectKisi, setPrintSelectKisi] = useState<boolean>(false);
  const [printSelectKunci, setPrintSelectKunci] = useState<boolean>(false);
  const [printSelectAnalisis, setPrintSelectAnalisis] = useState<boolean>(false);

  // States to choose which sections to generate to save tokens (default empty)
  const [genOptSoal, setGenOptSoal] = useState<boolean>(false);
  const [genOptKisi, setGenOptKisi] = useState<boolean>(false);
  const [genOptKunci, setGenOptKunci] = useState<boolean>(false);
  const [genOptAnalisis, setGenOptAnalisis] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (showPrintPreviewModal) {
        document.body.classList.add("preview-modal-active");
        
        // Auto-scale to fit available width
        const autoScale = () => {
          const isMobile = window.innerWidth < 768;
          // Mobile padding is roughly 32px. Desktop sidebar 320px + padding 64px
          const availableWidth = isMobile ? window.innerWidth - 32 : window.innerWidth - 320 - 64;
          const a4WidthPx = 794; // approx A4 width in pixels (210mm at 96dpi)
          
          if (availableWidth < a4WidthPx) {
            const idealZoom = Math.max(30, Math.floor((availableWidth / a4WidthPx) * 100));
            setPreviewZoom(idealZoom);
          } else {
            setPreviewZoom(100);
          }
        };
        autoScale();
        
        // Optional: listen to resize for auto-adjusting
        window.addEventListener("resize", autoScale);
        return () => {
          document.body.classList.remove("preview-modal-active");
          window.removeEventListener("resize", autoScale);
        };
      } else {
        document.body.classList.remove("preview-modal-active");
      }
    }
    return () => {
      if (typeof window !== "undefined") {
        document.body.classList.remove("preview-modal-active");
      }
    };
  }, [showPrintPreviewModal]);

  const updateKopNamaSekolah = (val: string) => {
    setKopNamaSekolah(val);
    localStorage.setItem("ngidesoal_kop_nama_sekolah", val);
  };
  const updateKopBarisTambahan1 = (val: string) => {
    setKopBarisTambahan1(val);
    localStorage.setItem("ngidesoal_kop_baris_tambahan_1", val);
  };
  const updateKopBarisTambahan2 = (val: string) => {
    setKopBarisTambahan2(val);
    localStorage.setItem("ngidesoal_kop_baris_tambahan_2", val);
  };
  const updateTableSize = (val: "kecil" | "sedang" | "besar") => {
    setTableSize(val);
    localStorage.setItem("ngidesoal_table_size", val);
  };
  const updateKopNamaInstansi = (val: string) => {
    setKopNamaInstansi(val);
    localStorage.setItem("ngidesoal_kop_nama_instansi", val);
  };
  const updateKopAlamat = (val: string) => {
    setKopAlamat(val);
    localStorage.setItem("ngidesoal_kop_alamat", val);
  };
  const updateKopShowLeftLogo = (val: boolean) => {
    setKopShowLeftLogo(val);
    localStorage.setItem("ngidesoal_kop_show_left", String(val));
  };
  const updateKopShowRightLogo = (val: boolean) => {
    setKopShowRightLogo(val);
    localStorage.setItem("ngidesoal_kop_show_right", String(val));
  };
  const updateCustomJudulAsesmen = (val: string) => {
    setCustomJudulAsesmen(val);
    localStorage.setItem("ngidesoal_kop_judul_asesmen", val);
  };
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, position: "left" | "right") => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      if (position === "left") {
        setKopLeftLogo(base64);
        localStorage.setItem("ngidesoal_kop_left_logo", base64);
      } else {
        setKopRightLogo(base64);
        localStorage.setItem("ngidesoal_kop_right_logo", base64);
      }
      showToast(`Logo ${position === "left" ? "Kiri" : "Kanan"} berhasil diupload & disimpan.`);
    };
    reader.readAsDataURL(file);
  };
  const resetLogo = (position: "left" | "right") => {
    if (position === "left") {
      setKopLeftLogo("");
      localStorage.removeItem("ngidesoal_kop_left_logo");
    } else {
      setKopRightLogo("");
      localStorage.removeItem("ngidesoal_kop_right_logo");
    }
    showToast(`Logo ${position === "left" ? "Kiri" : "Kanan"} direset ke bawaan.`);
  };

  const updateFieldNamaShow = (val: boolean) => {
    setFieldNamaShow(val);
    localStorage.setItem("ngidesoal_field_nama", String(val));
  };
  const updateFieldNomorShow = (val: boolean) => {
    setFieldNomorShow(val);
    localStorage.setItem("ngidesoal_field_nomor", String(val));
  };
  const updateFieldKelasShow = (val: boolean) => {
    setFieldKelasShow(val);
    localStorage.setItem("ngidesoal_field_kelas", String(val));
  };
  const updateFieldMapelShow = (val: boolean) => {
    setFieldMapelShow(val);
    localStorage.setItem("ngidesoal_field_mapel", String(val));
  };
  const updateFieldHariTanggalShow = (val: boolean) => {
    setFieldHariTanggalShow(val);
    localStorage.setItem("ngidesoal_field_tanggal", String(val));
  };
  const updateFieldNilaiShow = (val: boolean) => {
    setFieldNilaiShow(val);
    localStorage.setItem("ngidesoal_field_nilai", String(val));
  };
  const [loadingQuote, setLoadingQuote] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(true);
  const [showApiKeySettingsModal, setShowApiKeySettingsModal] = useState(false);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{ inputTokens: number; outputTokens: number } | null>(null);
  const [requestsThisMinute, setRequestsThisMinute] = useState<number>(() => getStoredRequestStats().count);

  // SIBI Book Browser pop-up integration states
  const [showSibiModal, setShowSibiModal] = useState(false);
  const [sibiJenjang, setSibiJenjang] = useState<string>("SD/MI");
  const [sibiKelas, setSibiKelas] = useState<string>("Kelas IV");
  const [sibiMapel, setSibiMapel] = useState<string>("Bahasa Indonesia");
  const [sibiSelectedBookId, setSibiSelectedBookId] = useState<string | null>(null);
  const [sibiSelectedTopics, setSibiSelectedTopics] = useState<string[]>([]);
  const [bookCoverErrors, setBookCoverErrors] = useState<Record<string, boolean>>({});

  // Buku Panduan Guru Browser pop-up integration states
  const [showPanduanModal, setShowPanduanModal] = useState(false);
  const [panduanSelectedFaseId, setPanduanSelectedFaseId] = useState<string>("Fase A");
  const [panduanMapel, setPanduanMapel] = useState<string>("Bahasa Indonesia");
  const [panduanSelectedBookId, setPanduanSelectedBookId] = useState<string | null>(null);
  const [panduanSelectedTopics, setPanduanSelectedTopics] = useState<string[]>([]);

  // For loading state during SVG generation per question
  const [visualizingNum, setVisualizingNum] = useState<number | null>(null);

  // EDIT QUESTION ENGINE STATES & HELPERS
  const [editingQNumber, setEditingQNumber] = useState<number | null>(null);
  const [editQText, setEditQText] = useState("");
  const [editQType, setEditQType] = useState<"Pilihan Ganda" | "Pilihan Ganda Kompleks" | "Menjodohkan" | "Isian Singkat" | "Uraian">("Pilihan Ganda");
  const [editQOptions, setEditQOptions] = useState<string[]>([]);
  const [editQAnswer, setEditQAnswer] = useState("");
  const [editQRubrik, setEditQRubrik] = useState("");
  const [editQTaxonomyLevel, setEditQTaxonomyLevel] = useState("");
  const [editQDimension, setEditQDimension] = useState("");
  const [editQPrinsip, setEditQPrinsip] = useState("");
  const [editQIllustrationPrompt, setEditQIllustrationPrompt] = useState("");
  const [editQHasIllustration, setEditQHasIllustration] = useState(false);

  const startEditingQuestion = (q: Question) => {
    setEditingQNumber(q.number);
    setEditQText(q.text || "");
    setEditQType(q.type as any);
    const initialOptions = q.options && q.options.length > 0
      ? q.options
      : Array.from({ length: mcqOptionsCount }, (_, i) => `${"ABCDE"[i]}. `);
    setEditQOptions(initialOptions);
    setEditQAnswer(q.correctAnswer || "");
    setEditQRubrik(q.rubrikAsesmen || "");
    setEditQTaxonomyLevel(q.taxonomyLevel || "");
    setEditQDimension(q.profilLulusanDimensi || "");
    setEditQPrinsip(q.prinsipPM || "");
    setEditQIllustrationPrompt(q.illustrationPrompt || "");
    setEditQHasIllustration(q.hasIllustration || false);
  };

  const saveUpdatedQuestions = (updatedQs: Question[]) => {
    if (!activePackage) return;
    
    // Group questions by type: first Pilihan Ganda, then Pilihan Ganda Kompleks, then Menjodohkan, then Isian Singkat, then Uraian
    const pg = updatedQs.filter(q => q.type === "Pilihan Ganda");
    const pgk = updatedQs.filter(q => q.type === "Pilihan Ganda Kompleks");
    const jodoh = updatedQs.filter(q => q.type === "Menjodohkan");
    const isian = updatedQs.filter(q => q.type === "Isian Singkat");
    const uraian = updatedQs.filter(q => q.type === "Uraian");
    
    const sorted = [...pg, ...pgk, ...jodoh, ...isian, ...uraian];
    const renumbered = sorted.map((q, idx) => ({
      ...q,
      number: idx + 1
    }));
    
    const updatedPkg = {
       ...activePackage,
       questions: renumbered
    };
    
    setActivePackage(updatedPkg);
    
    const updatedHistory = historyPackages.map((pkg) => pkg.id === updatedPkg.id ? updatedPkg : pkg);
    safeSaveHistory(updatedHistory);
  };

  const handleSaveEditQuestion = () => {
    if (!activePackage || editingQNumber === null) return;
    
    const updated = activePackage.questions.map((q, idx) => {
      if (q.number === editingQNumber) {
        return {
          ...q,
          text: editQText,
          type: editQType,
          options: (editQType === "Pilihan Ganda" || editQType === "Pilihan Ganda Kompleks") ? editQOptions : undefined,
          correctAnswer: editQAnswer,
          rubrikAsesmen: editQRubrik,
          taxonomyLevel: editQTaxonomyLevel,
          profilLulusanDimensi: editQDimension,
          prinsipPM: editQPrinsip,
          illustrationPrompt: editQIllustrationPrompt,
          hasIllustration: editQHasIllustration,
          renderedSvg: editQHasIllustration === q.hasIllustration && editQIllustrationPrompt === q.illustrationPrompt ? q.renderedSvg : undefined
        };
      }
      return q;
    });
    
    saveUpdatedQuestions(updated);
    setEditingQNumber(null);
    showToast(`Perubahan soal nomor ${editingQNumber} berhasil disimpan.`);
  };

  const handleDeleteQuestion = (qNumber: number) => {
    if (!activePackage) return;
    const filtered = activePackage.questions.filter(q => q.number !== qNumber);
    saveUpdatedQuestions(filtered);
    showToast(`Soal nomor ${qNumber} berhasil dihapus.`);
  };

  const handleChangeQuestionNumber = (qNumber: number, targetNumber: number) => {
    if (!activePackage) return;
    const questions = [...activePackage.questions];
    const currentIndex = questions.findIndex(q => q.number === qNumber);
    if (currentIndex === -1) return;
    
    const targetIndex = Math.min(questions.length - 1, Math.max(0, targetNumber - 1));
    if (currentIndex === targetIndex) return;
    
    const [removed] = questions.splice(currentIndex, 1);
    questions.splice(targetIndex, 0, removed);
    
    saveUpdatedQuestions(questions);
    showToast(`Mengatur posisi soal nomor ${qNumber} menjadi nomor ${targetNumber}.`);
  };

  // Dynamic Class Listing corresponding to Selected Fase
  const classesForFase = LIST_FASE.find((f) => f.id === activeFaseId)?.kelas || [];

  const availablePhases = LIST_FASE.filter((f) => {
    if (f.levels) return f.levels.includes(level);
    return f.level === level;
  });

  const handleLevelChange = (newLevel: string) => {
    setLevel(newLevel);
    const mapels = MAPEL_BY_JENJANG[newLevel] || MAPEL_BY_JENJANG["SD"];
    setSubject(mapels[0]);
    
    const validPhases = LIST_FASE.filter((f) => f.level === newLevel || (f.levels && f.levels.includes(newLevel)));
    if (validPhases.length > 0) {
      const firstPhase = validPhases[0];
      setActiveFaseId(firstPhase.id);
      setKelas(firstPhase.kelas[0]);
    }
  };

  // Load Initial History
  useEffect(() => {
    // Load custom API configuration on client mount safely
    if (typeof window !== "undefined") {
      const savedApiKey = localStorage.getItem("ngidesoal_custom_api_key");
      const savedTextModel = localStorage.getItem("ngidesoal_custom_text_model");
      const savedImageModel = localStorage.getItem("ngidesoal_custom_image_model");
      
      const apiTimer = setTimeout(() => {
        if (savedApiKey) setCustomApiKeyState(savedApiKey);
        if (savedTextModel) setCustomTextModel(savedTextModel);
        if (savedImageModel) setCustomImageModel(savedImageModel);
      }, 0);
    }

    const saved = localStorage.getItem("ngidesoal_history_v2");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const timer = setTimeout(() => {
          setHistoryPackages(parsed);
          // Don't set activePackage automatically so that preview does not show immediately on load
        }, 0);
        return () => clearTimeout(timer);
      } catch (e) {
        console.error("Failed to parsed stored history", e);
      }
    } else {
      // Setup initial default
      const mockInitial: QuestionPackage = {
        id: generateUniqueId("initial-pkg"),
        ...SAMPLE_TEMPLATES[0],
        timestamp: getCurrentTimestamp()
      };
      const timer = setTimeout(() => {
        setHistoryPackages([mockInitial]);
        // Don't set activePackage automatically so that preview does not show immediately on load
      }, 0);
      return () => clearTimeout(timer);
    }
  }, []);

  const safeSaveHistory = (historyList: QuestionPackage[]) => {
    try {
      localStorage.setItem("ngidesoal_history_v2", JSON.stringify(historyList));
      setHistoryPackages(historyList);
    } catch (e: any) {
      console.warn("Storage quota exceeded! Retrying with self-healing compression...", e);
      
      // Strategy 1: Clear SVG rendering data from packages that are older (index >= 1)
      const healed = historyList.map((pkg, idx) => {
        if (idx >= 1) {
          return {
            ...pkg,
            questions: pkg.questions.map(q => ({
              ...q,
              renderedSvg: undefined
            }))
          };
        }
        return pkg;
      });

      try {
        localStorage.setItem("ngidesoal_history_v2", JSON.stringify(healed));
        setHistoryPackages(healed);
        showToast("⚠️ Penyimpanan penuh! Gambar pada riwayat lama dikosongkan.");
        return;
      } catch (e1) {
        console.warn("Strategy 1 failed, trying Strategy 2 (pruning history packages count)...", e1);
      }

      // Strategy 2: Remove oldest packages entirely until it fits (down to 1 items remaining)
      let pruneCount = healed.length;
      while (pruneCount > 1) {
        pruneCount--;
        const pruned = healed.slice(0, pruneCount);
        try {
          localStorage.setItem("ngidesoal_history_v2", JSON.stringify(pruned));
          setHistoryPackages(pruned);
          showToast("⚠️ Penyimpanan penuh! Otomatis menghapus paket riwayat terlama.");
          return;
        } catch (e2) {
          // Keep pruning
        }
      }

      // Strategy 3: Strip ALL SVG rendering data including active one
      const minimalHealed = healed.map(pkg => ({
        ...pkg,
        questions: pkg.questions.map(q => ({
          ...q,
          renderedSvg: undefined
        }))
      }));

      try {
        localStorage.setItem("ngidesoal_history_v2", JSON.stringify(minimalHealed));
        setHistoryPackages(minimalHealed);
        showToast("⚠️ Penyimpanan penuh! Semua gambar dinonaktifkan.");
        return;
      } catch (e3) {
        console.error("Critical storage failure, clearing old history completely to store active one", e3);
      }

      // Strategy 4: Save active only with no images
      if (activePackage) {
        const activeMinimal = {
          ...activePackage,
          questions: activePackage.questions.map(q => ({ ...q, renderedSvg: undefined }))
        };
        try {
          localStorage.setItem("ngidesoal_history_v2", JSON.stringify([activeMinimal]));
          setHistoryPackages([activeMinimal]);
          showToast("⚠️ Hanya menyimpan paket aktif tanpa gambar.");
          return;
        } catch (e4) {
          showToast("❌ Gagal menyimpan riwayat (Penyimpanan browser penuh).");
        }
      }
    }
  };

  const saveToHistory = (newPkg: QuestionPackage) => {
    const updated = [newPkg, ...historyPackages.filter((p) => p.id !== newPkg.id)];
    safeSaveHistory(updated);
  };

  const deletePackage = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = historyPackages.filter((p) => p.id !== id);
    safeSaveHistory(updated);
    if (activePackage?.id === id) {
      setActivePackage(updated.length > 0 ? updated[0] : null);
    }
    showToast("Paket soal berhasil dihapus dari riwayat.");
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Add Row of Question Type row config
  const addQuestionTypeRow = () => {
    const newRow: QuestionTypeRow = {
      id: generateUniqueId("row"),
      type: "Pilihan Ganda",
      count: 2,
      illustratedCount: 0
    };
    setQTypeRows([...qTypeRows, newRow]);
  };

  // Remove Row of Question Type row config
  const removeQuestionTypeRow = (id: string) => {
    if (qTypeRows.length <= 1) {
      showToast("Harus ada minimal satu konfigurasi tipe soal.");
      return;
    }
    setQTypeRows(qTypeRows.filter((r) => r.id !== id));
  };

  // Update specific row of config
  const updateQuestionTypeRow = (id: string, field: keyof QuestionTypeRow, value: any) => {
    setQTypeRows(
      qTypeRows.map((row) => {
        if (row.id === id) {
          const updated = { ...row, [field]: value };
          // Keep illustrated count bound to maximum question count
          if (field === "count") {
            const numericCount = parseInt(value) || 0;
            const numericIll = parseInt(updated.illustratedCount as string) || 0;
            if (numericIll > numericCount) {
              updated.illustratedCount = numericCount;
            }
          }
          if (field === "illustratedCount") {
            const numericCount = parseInt(updated.count as string) || 0;
            const numericValue = parseInt(value) || 0;
            if (numericValue > numericCount) {
              updated.illustratedCount = numericCount;
            }
          }
          return updated;
        }
        return row;
      })
    );
  };

  // Content source operational functions
  const addContentItem = () => {
    if (!inputTextContent.trim()) return;
    const newItem: ContentSourceItem = {
      id: generateUniqueId("content"),
      type: contentType,
      text: inputTextContent.trim()
    };
    setContentList([...contentList, newItem]);
    setInputTextContent("");
    showToast("Sasaran pembelajaran ditambahkan!");
  };

  const removeContentItem = (id: string) => {
    setContentList(contentList.filter((item) => item.id !== id));
  };

  // Toggle single graduate profile dimensions
  const toggleDimension = (dim: string) => {
    if (selectedDimensions.includes(dim)) {
      setSelectedDimensions(selectedDimensions.filter((d) => d !== dim));
    } else {
      setSelectedDimensions([...selectedDimensions, dim]);
    }
  };

  // Cycling reassurance phrases during deep learning generation
  const startLoadingAnimations = () => {
    const quotes = [
      "Mengintegrasikan sasaran kurikulum secara holistik...",
      "Menyusun stimulus cerita & kasus kontekstual nyata...",
      "Memetakan level taksonomi SOLO siswa secara teratur...",
      "Pencocokan kelas & Fase yang presisi...",
      "Merumuskan pedoman kriteria penskoran Guru...",
      "Menyelaraskan nilai-nilai Profil Lulusan...",
      "Hasil formulasi siap mencerahkan kelas Anda..."
    ];
    let idx = 0;
    setLoadingQuote(quotes[0]);
    const interval = setInterval(() => {
      idx = (idx + 1) % quotes.length;
      setLoadingQuote(quotes[idx]);
    }, 2500);
    return interval;
  };

  const callCustomGeminiAPI = async (
    apiKey: string,
    model: string,
    systemInstruction: string,
    promptText: string,
    schema: any
  ) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: promptText,
              }
            ]
          }
        ],
        systemInstruction: {
          parts: [
            {
              text: systemInstruction,
            }
          ]
        },
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
        }
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = `Terjadi kesalahan saat menghubungi API Gemini (${response.status}).`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errMsg;
      } catch {
        if (errText) {
          errMsg = `${errMsg} Detail: ${errText}`;
        }
      }
      throw new Error(errMsg);
    }

    const result = await response.json();
    const textOutput = result.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) {
      throw new Error("API Gemini tidak mengembalikan respon teks.");
    }

    const parsedData = JSON.parse(textOutput.trim());
    return {
      data: parsedData,
      usage: {
        inputTokens: result.usageMetadata?.promptTokenCount || 0,
        outputTokens: result.usageMetadata?.candidatesTokenCount || 0,
      }
    };
  };

  // Handle Complete Generation Request
  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!genOptSoal && !genOptKisi && !genOptKunci && !genOptAnalisis) {
      showToast("⚠️ Silakan pilih minimal satu opsi kelengkapan dokumen yang akan dibuat!");
      return;
    }

    let activeContentList = [...contentList];
    if (inputTextContent.trim() !== "") {
      const newItem: ContentSourceItem = {
        id: generateUniqueId("content"),
        type: contentType,
        text: inputTextContent.trim()
      };
      activeContentList = [...activeContentList, newItem];
      setContentList(activeContentList);
      setInputTextContent("");
      showToast(`📝 Otomatis menambahkan "${inputTextContent.trim()}" ke daftar sasaran pembelajaran!`);
    }

    if (activeContentList.length === 0) {
      showToast("Harap masukkan minimal satu Sumber Konten (TP / Lingkup materi) terlebih dahulu.");
      return;
    }

    if (!customApiKey || customApiKey.trim() === "") {
      showToast("⚠️ API Key wajib diisi! Silakan siapkan API Key Gemini Anda terlebih dahulu.");
      setShowApiKeySettingsModal(true);
      return;
    }

    setIsLoading(true);
    const intervalId = startLoadingAnimations();

    try {
      const sanitizedQTypeRows = qTypeRows.map((r) => ({
        ...r,
        count: parseInt(r.count as string) || 1,
        illustratedCount: parseInt(r.illustratedCount as string) || 0
      }));

      let rawData: any;
      if (customApiKey && customApiKey.trim() !== "") {
        // Direct Client-side call to Google Gemini to relieve server load
        const formattedSumberKonten = activeContentList.map((item, i) => `${i + 1}. [${item.type}] ${item.text}`).join("\n");
        const formattedTipeSoal = sanitizedQTypeRows.map((t) => `- Tipe: ${t.type}, Jumlah: ${t.count} soal (dari jumlah tersebut, ${t.illustratedCount} soal harus bergambar/memiliki ilustrasi)`).join("\n");
        const actLevels = taksonomi === "SOLO" ? soloLevels : bloomLevels;

        const totalSoal = sanitizedQTypeRows.reduce((acc, cur) => acc + (cur.count || 0), 0);

        const mainPromptText = `
Anda adalah ahli perumus soal ujian (asesmen) kurikulum nasional (Pedoman Perencanaan Asesmen Kemendikdasmen).
Tugas Anda adalah merumuskan sekelompok soal ujian berkualitas premium dan aplikatif untuk guru tingkat SD, SMP, SMA, atau SMK di Indonesia yang diberi nama platform "Ngide Soal".

### CONSTRAINT JUMLAH SOAL YANG SANGAT KETAT (MANDATORI / CRITICAL):
- TOTAL JAWABAN SOAL YANG HARUS DIHASILKAN WAJIB TEPAT PERSIS: ${totalSoal} SOAL.
- Array 'questions' dalam format JSON hasil kembalian Anda harus berisi TEPAT ${totalSoal} objek soal (tidak boleh kurang dari ${totalSoal}, tidak boleh lebih dari ${totalSoal}).
- Rincian per tipe soal yang harus dibuat wajib sesuka hati/teratur:
${sanitizedQTypeRows.map((t) => `  * Tipe '${t.type}' harus dibuat TEPAT SEKALI ${t.count} butir soal.`).join("\n")}

PERINGATAN KERAS: Kegagalan mengembalikan tepat ${totalSoal} soal adalah kesalahan fatal! Jangan tambahkan soal bonus, soal variasi, atau alternatif. Hitung ulang jumlah objek dalam array 'questions' sebelum mengirim jawaban Anda untuk memastikan totalnya tepat ${totalSoal}!

INFORMASI SPESIFIK ARTIFAK SOAL:
- Mata Pelajaran: ${subject === "Lainnya..." ? customSubject : subject}
- Jenjang: ${level}
- Fase: ${activeFaseId}
- Kelas: ${kelas}
- Sumber Konten / Sasaran Pembelajaran:
${formattedSumberKonten}

- Rencana Tipe Soal & Porsi Bergambar:
${formattedTipeSoal}

- Dimensi Profil Lulusan yang difokuskan: ${selectedDimensions && selectedDimensions.length > 0 ? selectedDimensions.join(", ") : "Semua Dimensi"}
- Kerangka Taksonomi Utama: ${taksonomi} ${actLevels && actLevels.length > 0 ? `(HANYA pilih tingkatan/level dari daftar ini: ${actLevels.join(", ")})` : `(Gunakan level ${taksonomi === "SOLO" ? "Taksonomi SOLO: Unistruktural, Multistruktural, Relasional, Abstrak Diperluas" : "Taksonomi BLOOM: Mengingat, Memahami, Menerapkan, Menganalisis, Mengevaluasi, Mencipta"})`}

- Integrasi Konteks Lokal Indonesia (WAJIB JIKA AKTIF): ${konteksLokalActive ? `AKTIF di Provinsi ${provinsi}. Anda HARUS SEKSAMA memastikan soal-soal menggunakan nama orang lokal khas daerah, tradisi/budaya, lanskap geografis, tata niaga, kesenian, atau kearifan lokal yang secara spesifik ada di ${provinsi}. WAJIB buat stimulus cerita yang berlokasi di ${provinsi}. Perintah tambahan: ${perintahTambahan || "Tidak ada"}` : "Tidak aktif"}
- Opsi Penjelasan Pilihan Ganda: ${includeMcqExplanation ? "Aktif" : "Tidak Aktif"}. ${includeMcqExplanation ? "Wajib memberikan pembahasan detail dan analisis distraktor di bagian rubrikAsesmen untuk soal Pilihan Ganda." : "DILARANG menuliskan penjelasan atau pembahasan panjang untuk soal Pilihan Ganda pada correctAnswer maupun rubrikAsesmen, melainkan CUKUP berikan jawaban singkat dan pedoman penskoran sederhana (misalnya 'Benar diberi 1 poin, salah 0') secara ringkas guna menghemat token."}
- Bahasa & Penulisan Arab: ${soalBahasaArab ? "WAJIB menyertakan tulisan Arab asli (lengkap dengan harakat/tanda baca/syakal yang tepat dan rapi) pada teks stimulus, kisah, ayat, kutipan, atau butir pertanyaan utama, bersandingan dengan transliterasi atau terjemahan Bahasa Indonesia yang lurus, agar sesuai untuk pengajaran Bahasa Arab / Pendidikan Agama Islam di sekolah Indonesia." : "Bahasa Indonesia standar."}
- Jumlah Opsi Jawaban Pilihan Ganda: Untuk setiap soal Pilihan Ganda (MCQ) maupun Pilihan Ganda Kompleks, Anda wajib menyajikan persis ${mcqOptionsCount} opsi pilihan jawaban (dimulai dari A sampai ${mcqOptionsCount === 5 ? "E" : mcqOptionsCount === 4 ? "D" : "C"}). Teks pilihan jawaban harus diawali dengan abjad tersebut secara konsisten (contoh: "A. ", "B. ", "C. ", ...).

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
   - Harus dirumuskan secara Jelas, Tegas, dan Spesifik. Hindari pokok soal yang menggantung. Harus memperlihatkan apa yang ditanyakan.
   - Wajib memiliki struktur tata bahasa yang lengkap: Memenuhi unsur SUBJEK dan PREDIKAT yang jelas.
   - Keras menghindari pokok soal yang hanya berwujud Anak Kalimat (Klausa Dependen).
   - Hindari penggunaan kata depan yang menutup Subjek di awal kalimat.
   - DILARANG mengandung petunjuk tersembunyi (clue) yang mengarah secara langsung pada kunci jawaban yang benar.
   - ANTI-BOCOR STIMULUS (SANGAT PENTING / CRITICAL): Teks stimulus/cerita/skenario pendukung yang diletakkan di awal soal DILARANG KERAS mengandung kalimat definisi langsung atau penjelasan harfiah yang membocorkan langsung kunci jawaban untuk pertanyaan di bawahnya. 
     * CONTOH YANG SANGAT SALAH (DILARANG): Stimulus menuliskan "Di dalam paru-paru, tepatnya di alveolus, terjadi pertukaran oksigen dan karbon dioksida", lalu pertanyaan di bawahnya "Organ pernapasan tempat pertukaran oksigen dan karbon dioksida adalah...". Ini adalah kebocoran fatal karena murid hanya perlu menyalin kata-kata dari teks tanpa berpikir kritis.
     * CONTOH YANG BENAR (REKOMENDASI): Stimulus menyajikan skenario klinis, eksperimentasi, atau deskripsi proses fungsional tanpa langsung menyebut nama spesifik organnya (misal: "Dokter mendeteksi adanya penumpukan cairan pada gelembung-gelembung udara kecil di ujung bronkiolus pasien. Kondisi ini secara langsung menghalangi lancarnya proses difusi gas oksigen ke sel darah merah..."), lalu pertanyaan menanyakan nama bagian tersebut atau dampak lebih lanjut ("Bagian paru-paru yang dimaksud pada kasus tersebut adalah..."). Hal ini memaksa siswa menghubungkan konsep fungsional (difusi gas pada gelembung kecil) untuk menyimpulkan jawabannya secara aktif dan bernalar kritis.
   - DILARANG mengandung pernyataan NEGATIF GANDA (e.g. "Berikut yang tidak termasuk ..., kecuali ...").
   - Setiap butir soal harus mandiri (IDEPENDEN) dan sama sekali tidak boleh bergantung pada jawaban butir soal sebelumnya.
   - Hindari kata yang bermakna tidak pasti seperti: "sebaiknya", "umumnya", "kadang-kadang".

2. KETENTUAN PILIHAN JAWABAN (OPSI MULTIPLE CHOICE):
   - Harus HOMOGEN secara materi dan LOGIS dari segi substansi. Pengecoh (distractors) harus sejenis dan setara.
   - Hanya boleh dan wajib memiliki SATU kunci jawaban yang mutlak benar atau paling benar.
   - Panjang rumusan pilihan jawaban (A, B, C, D) harus relatif SAMA dan SEJAJAR.
   - DILARANG menggunakan pilihan jawaban penyapu jagat seperti "Semua pilihan di atas benar" atau "Semua pilihan di atas salah".
   - Pilihan jawaban berbentuk ANGKA atau URUTAN WAKTU wajib disusun secara berurutan.
   - Opsi pilihan ganda HARUS konsisten berjumlah ${mcqOptionsCount} (diawali A sampai ${mcqOptionsCount === 5 ? "E" : mcqOptionsCount === 4 ? "D" : "C"}) dan teks setiap opsi secara eksplisit HARUS diawali dengan abjad tersebut: "A. ", "B. ", "C. ", "D. ", "E. " dst (dengan titik dan spasi).
   - Opsi jawaban tidak boleh mengulang frasa yang bukan kesatuan pengertian.
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

5. KETENTUAN SOAL URAIAN (ESSAY):
   - Harus menggunakan kata tanya atau perintah yang menuntut jawaban analisis/terurai, contoh: "mengapa", "bagaimana", "jelaskan", "analisislah". Keras hindari "apakah" atau "berapa".
   - Harus memiliki batasan pertanyaan dan ruang lingkup jawaban yang diharapkan secara jelas.
   - Wajib menyertakan pedoman penskoran atau kriteria rubrik penilaian secara bertingkat dan logis.

6. KETENTUAN SOAL ISIAN / JAWABAN SINGKAT:
   - Jawaban yang dituntut harus sangat singkat, pasti (deterministik), dan sangat objektif, biasanya berupa SATU kata, nama tokoh, frasa pendek spesifik, angka, satuan, tempat, atau waktu historis yang sudah mutlak benarnya.
   - DILARANG menggunakan tipe Isian Singkat untuk pertanyaan analisis subjektif atau pemaknaan nilai moral (seperti "Nilai moral yang harus dihindari adalah ____________" atau "Amanat cerita adalah ____________"). Pertanyaan bernuansa analisis nilai, amanat, budi pekerti, atau interpretasi subjektif yang memiliki banyak sinonim WAJIB diserahkan ke tipe Pilihan Ganda atau Uraian (Essay), BUKAN Isian Singkat.
   - Preamble/stimulus pendukung pada rumpun soal Isian Singkat harus kongruen dan BEBAS dari kontradiksi logis atau kebocoran jawaban (clues) secara tidak sengaja (misalnya: dilarang menuliskan "Pantun nasihat menyuarakan moral..." lalu menanyakan bentuk pantunnya padahal isi pantunya adalah pantun cinta).
   - Bagian yang dikosongkan MAKSIMUM DUA (2) rumpang untuk satu kalimat soal demi menjaga kejelasan konteks kalimat rumpang.
   - Hindari menyalin langsung kalimat utuh dari buku paket/teks utama untuk mencegah hafalan membabi buta.

7. KAIDAH BAHASA & KELAYAKAN SOSIAL:
   - Gunakan bahasa Indonesia baku yang baik dan benar sesuai standar EYD/PUEBI.
   - Dilarang menggunakan bahasa lokal/daerah setempat.
   - Rumusan soal TIDAK BOLEH menyinggung perasaan siswa atau bias (menghindari isi SARA, diskriminasi gender, status ekonomi/social).

ATURAN STRUKTUR OUTPUT:
- Soal harus ditulis dalam bahasa Indonesia yang baik, ramah guru, menggunakan kalimat pembuka kasus/konteks (stimulus) yang menarik.
- Untuk soal Pilihan Ganda (MCQ) maupun Pilihan Ganda Kompleks, sediakan ${mcqOptionsCount} opsi (diawali A sampai ${mcqOptionsCount === 5 ? "E" : mcqOptionsCount === 4 ? "D" : "C"}). Untuk Isian Singkat atau Uraian, berikan solusi model ideal.
- Sediakan Pedoman Penilaian / Rubrik Asesmen yang spesifik untuk setiap soal.
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

        const systemInstruction = "You are an expert assessment designer for Indonesian Schools under the national curriculum. You must output RAW JSON ONLY matching the provided responseSchema. No markdown wrappers (like ```json), no conversational opening, no notes, no fillers, and no trailers.";

        const qProps: any = {
          number: { type: "INTEGER" },
          type: { type: "STRING", description: "Tipe soal, harus persis salah satu: 'Pilihan Ganda', 'Pilihan Ganda Kompleks', 'Menjodohkan', 'Isian Singkat', atau 'Uraian'" },
          hasIllustration: { type: "BOOLEAN", description: "True jika ini diatur sebagai soal bergambar/ilustrasi." },
          illustrationPrompt: { type: "STRING", description: "Prompt gambar bahasa inggris deskriptif bergaya 'cute cartoon hand-drawn, educational kids style'." }
        };
        const qReq = ["number", "type", "hasIllustration", "illustrationPrompt"];

        if (genOptSoal) {
          qProps.text = { 
            type: "STRING", 
            description: "Teks lengkap soal beserta stimulus (studi kasus / cerita konteks di awal soal). JIKA tipe Pilihan Ganda atau Pilihan Ganda Kompleks, DILARANG KERAS mencatatkan / menyisipkan pilihan-pilihan jawaban (A, B, C, D) di dalam deskripsi teks ini, karena pilihan jawaban harus dimasukkan secara terpisah di parameter 'options' saja. JIKA Anda menyisipkan data berbentuk tabel, buatlah tabel menggunakan format standar markdown yang rapi (misal: | Menu | Jumlah |\\n|---|---|\\n| Nasi | 45 |). Setiap baris tabel WAJIB berada di baris baru tersendiri yang sangat jelas (dipisah dengan '\\n') dan bukan digabung dalam satu baris, agar ter-render sempurna." 
          };
          qProps.options = {
            type: "ARRAY",
            items: { type: "STRING" },
            description: `Opsi jawaban jika tipe soal Pilihan Ganda atau Pilihan Ganda Kompleks. Wajib terdiri dari persis ${mcqOptionsCount} opsi (dimulai dari A sampai ${mcqOptionsCount === 5 ? "E" : mcqOptionsCount === 4 ? "D" : "C"}). Setiap teks pilihan secara utuh wajib diawali dengan abjadnya (contoh: 'A. ...'). Jika tipe Menjodohkan/Isian/Uraian, isi dengan array kosong [] secara mutlak.`
          };
          qReq.push("text", "options");
        }

        if (genOptKunci) {
          qProps.correctAnswer = { type: "STRING", description: "Pilihan abjad kunci jawaban yang benar (misalnya 'A. ...' atau 'B. ...') jika tipe soal Pilihan Ganda. Jika Pilihan Ganda Kompleks, sebutkan opsi-opsi yang benar (misal 'A dan C'). Jika Menjodohkan, berikan rincian pasangan yang betul (misal '1-y, 2-x, 3-z'). Jika Isian/Uraian, isi dengan penjelasan solusi model ideal secara rinci." };
          qProps.rubrikAsesmen = { type: "STRING", description: includeMcqExplanation ? "Untuk Pilihan Ganda/Kompleks/Menjodohkan, wajib diisi dengan Penjelasan, Pembahasan mendalam, analisis distraktor, atau kunci pencocokan lengkap. Untuk Isian/Uraian, diisi dengan pedoman penskoran kriteria rubrik asesmen lengkap menentukan poin berdasarkan jawaban siswa." : "Untuk Pilihan Ganda/Kompleks/Menjodohkan, CUKUP diisi dengan pedoman penskoran singkat saja tanpa ulasan penjelasan/pembahasan opsi (misalnya: '+1 poin jika benar, 0 jika salah'). Untuk Isian/Uraian, diisi dengan pedoman penskoran kriteria rubrik asesmen lengkap menentukan poin berdasarkan jawaban siswa." };
          qReq.push("correctAnswer", "rubrikAsesmen");
        }

        if (genOptAnalisis) {
          qProps.taxonomyLevel = { type: "STRING", description: "Level Taksonomi terpilih (SOLO atau BLOOM)" };
          qProps.taxonomyAnalysis = { type: "STRING", description: "Analisis singkat level taksonomi." };
          qProps.profilLulusanDimensi = { type: "STRING", description: "Dimensi Profil Lulusan yang disasar." };
          qProps.prinsipPM = { type: "STRING", description: "Analisis deskriptif mendalam terkait penerapan Dimensi Profil Lulusan yang digunakan pada soal ini. Penjelasan wajib murni menceritakan bagaimana dimensi Profil Lulusan tersebut dilatih, ditunjukkan, dan diukur melalui pengerjaan soal ini oleh siswa. DILARANG keras menyangkutkan, menyebut, atau mengawalinya dengan kata/frasa prinsip 'Bermakna:', 'Berkesadaran:', atau 'Menggembirakan:'." };
          qReq.push("taxonomyLevel", "taxonomyAnalysis", "profilLulusanDimensi", "prinsipPM");
        }

        if (genOptKisi) {
          qProps.materiTopik = { type: "STRING", description: "Sub-materi/topik pokok bahasan spesifik yang diuji." };
          qProps.stimulusAsesmen = { type: "STRING", description: "Deskripsi stimulus ringkas dan objektif (contoh: 'Gambar...', 'Tabel...', atau 'Skenario...'). Jangan ulangi soal." };
          qProps.indikatorSoal = { type: "STRING", description: "Rumusan indikator soal baku: 'Disajikan [stimulus], peserta didik dapat [KKO] [materi] dengan tepat/benar.' Jangan ulangi soal." };
          qReq.push("materiTopik", "stimulusAsesmen", "indikatorSoal");
        }

        const QUESTION_SCHEMA = {
          type: "OBJECT",
          required: ["title", "subject", "fase", "kelas", "questions"],
          properties: {
            title: {
              type: "STRING",
              description: "Judul paket soal ujian, contoh: Soal Asesmen Sumatif IPAS Kelas 5 SD - Ekosistem Danau"
            },
            subject: { type: "STRING" },
            fase: { type: "STRING" },
            kelas: { type: "STRING" },
            questions: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                required: qReq,
                properties: qProps
              }
            }
          }
        };

        const result = await callCustomGeminiAPI(
          customApiKey,
          customTextModel,
          systemInstruction,
          mainPromptText,
          QUESTION_SCHEMA
        );
        rawData = result.data;
        rawData.usage = result.usage;
      } else {
        const response = await fetch("/api/gemini/generate-questions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subject: subject === "Lainnya..." ? customSubject : subject,
            level,
            fase: activeFaseId,
            kelas,
            sumberKonten: activeContentList.map((c) => `[${c.type}] ${c.text}`),
            dimensiProfil: selectedDimensions,
            tipeSoalList: sanitizedQTypeRows,
            taksonomi,
            taksonomiLevels: taksonomi === "SOLO" ? soloLevels : bloomLevels,
            konteksLokal: {
              active: konteksLokalActive,
              provinsi,
              perintahTambahan
            },
            includeMcqExplanation,
            soalBahasaArab,
            mcqOptionsCount,
            genOpts: {
              soal: genOptSoal,
              kisi: genOptKisi,
              kunci: genOptKunci,
              analisis: genOptAnalisis
            }
          })
        });

        if (!response.ok) {
          const errJson = await response.json();
          throw new Error(errJson.error || "Gagal merumuskan sirkuit AI.");
        }

        rawData = await response.json();
      }

      const finalSubject = subject === "Lainnya..." ? customSubject : subject;
      const newPkg: QuestionPackage = {
        id: generateUniqueId("pkg"),
        title: rawData.title || `Soal Asesmen ${finalSubject} - ${kelas}`,
        subject: rawData.subject || finalSubject,
        fase: rawData.fase || activeFaseId,
        kelas: rawData.kelas || kelas,
        timestamp: getCurrentTimestamp(),
        questions: rawData.questions || [],
        taksonomi: taksonomi
      };

      setActivePackage(newPkg);
      saveToHistory(newPkg);
      setActiveTab("lembar");
      setActiveMainMenu("hasil");
      
      // Update requests count in the current minute window using helper
      const updatedCount = updateStoredRequestStats();
      setRequestsThisMinute(updatedCount);

      if (rawData.usage) {
        setTokenInfo({
          inputTokens: rawData.usage.inputTokens,
          outputTokens: rawData.usage.outputTokens
        });
      } else {
        const mockTokens = generateMockTokens();
        setTokenInfo(mockTokens);
      }
      setShowTokenModal(true);
      showToast(customApiKey ? "Penjanaan berhasil melalui API Key Mandiri Anda!" : "Penjanaan berhasil! Paket asesmen siap diajarkan.");
    } catch (err: any) {
      console.error(err);
      alert(`Gagal membuat soal: ${err?.message || "Koneksi terputus. Mohon coba sesaat lagi."}`);
    } finally {
      clearInterval(intervalId);
      setIsLoading(false);
    }
  };

  // Visualize single illustration dynamically inside client
  const triggerIllustrationSvg = async (qNum: number, prompt: string) => {
    console.log("AI visualization disabled:", qNum, prompt.substring(0, 15));
    showToast("⚠️ Untuk pengguna API key gratis gunakan salin prompt lalu unggah pada soal");
  };

  // Update specific question prompt in state & local storage
  const updateQuestionIllustrationPrompt = (qNum: number, newPrompt: string) => {
    if (!activePackage) return;
    const updatedQuestions = activePackage.questions.map((q, idx) => {
      if (q.number === qNum) {
        return { ...q, illustrationPrompt: newPrompt };
      }
      return q;
    });

    const updatedPackage = { ...activePackage, questions: updatedQuestions };
    setActivePackage(updatedPackage);

    const updatedHistory = historyPackages.map((p) => {
      if (p.id === activePackage.id) {
        return updatedPackage;
      }
      return p;
    });
    safeSaveHistory(updatedHistory);
  };

  // Directly set or clear the rendered image of a question
  const updateQuestionRenderedSvg = (qNum: number, imageHtml: string | undefined) => {
    if (!activePackage) return;
    const updatedQuestions = activePackage.questions.map((q, idx) => {
      if (q.number === qNum) {
        return { ...q, renderedSvg: imageHtml };
      }
      return q;
    });

    const updatedPackage = { ...activePackage, questions: updatedQuestions };
    setActivePackage(updatedPackage);

    const updatedHistory = historyPackages.map((p) => {
      if (p.id === activePackage.id) {
        return updatedPackage;
      }
      return p;
    });
    safeSaveHistory(updatedHistory);
  };

  // Process custom image upload to base64
  const handleCustomImageUpload = (qNum: number, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activePackage) return;
    const file = event.target.files?.[0];
    if (!file) return;

    // Fast check image size (keep it reasonable)
    if (file.size > 8 * 1024 * 1024) {
      showToast("Ukuran gambar maksimal 8MB!");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      if (!base64) return;

      const htmlImg = `<img src="${base64}" alt="Ilustrasi Unggahan Mandiri" class="w-full h-full object-contain rounded-xl" style="max-height: 100%; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;" referrerPolicy="no-referrer" />`;
      
      updateQuestionRenderedSvg(qNum, htmlImg);
      showToast("Gambar berhasil diunggah!");
    };
    reader.readAsDataURL(file);
  };

  // Apply Pre-configured Template
  const applyTemplate = (tpl: Omit<QuestionPackage, "id" | "timestamp">) => {
    setSubject(tpl.subject);
    setActiveFaseId(tpl.fase);
    setKelas(tpl.kelas);
    
    // Auto populate objectives
    setContentList([
      { id: "tpl-c-1", type: "Tujuan Pembelajaran (TP)", text: "Menganalisis fenomena alam berbasis ekosistem perairan lokal." }
    ]);
    
    // Auto populate types rows
    const pgCount = tpl.questions.filter((q, idx) => q.type === "Pilihan Ganda").length;
    const pgkCount = tpl.questions.filter((q, idx) => q.type === "Pilihan Ganda Kompleks").length;
    const jodohCount = tpl.questions.filter((q, idx) => q.type === "Menjodohkan").length;
    const shortCount = tpl.questions.filter((q, idx) => q.type === "Isian Singkat").length;
    const essayCount = tpl.questions.filter((q, idx) => q.type === "Uraian").length;

    const rows: QuestionTypeRow[] = [];
    if (pgCount > 0) {
      rows.push({ id: "tr-1", type: "Pilihan Ganda", count: pgCount, illustratedCount: tpl.questions.filter((q, idx) => q.type === "Pilihan Ganda" && q.hasIllustration).length });
    }
    if (pgkCount > 0) {
      rows.push({ id: "tr-pgk", type: "Pilihan Ganda Kompleks", count: pgkCount, illustratedCount: tpl.questions.filter((q, idx) => q.type === "Pilihan Ganda Kompleks" && q.hasIllustration).length });
    }
    if (jodohCount > 0) {
      rows.push({ id: "tr-jodoh", type: "Menjodohkan", count: jodohCount, illustratedCount: tpl.questions.filter((q, idx) => q.type === "Menjodohkan" && q.hasIllustration).length });
    }
    if (shortCount > 0) {
      rows.push({ id: "tr-2", type: "Isian Singkat", count: shortCount, illustratedCount: tpl.questions.filter((q, idx) => q.type === "Isian Singkat" && q.hasIllustration).length });
    }
    if (essayCount > 0) {
      rows.push({ id: "tr-3", type: "Uraian", count: essayCount, illustratedCount: tpl.questions.filter((q, idx) => q.type === "Uraian" && q.hasIllustration).length });
    }
    setQTypeRows(rows.length > 0 ? rows : [{ id: "tr-1", type: "Pilihan Ganda", count: 2, illustratedCount: 0 }]);

    const newPkg: QuestionPackage = {
      id: generateUniqueId("tpl"),
      ...tpl,
      timestamp: getCurrentTimestamp("Template Resmi")
    };
    setActivePackage(newPkg);
    saveToHistory(newPkg);
    setActiveTab("lembar");
    setActiveMainMenu("hasil");
    showToast("Template kurikulum resmi berhasil dimuat!");
  };

  const handleCopy = () => {
    if (!activePackage) return;
    let text = `=== ASESMEN ${activePackage.title.toUpperCase()} ===\nMata Pelajaran: ${activePackage.subject}\nFase: ${activePackage.fase}\nKelas: ${activePackage.kelas}\n\n`;
    
    activePackage.questions.forEach((q, idx) => {
      text += `${q.number}. ${q.text}\n`;
      if (q.options && q.options.length > 0) {
        q.options.forEach((opt) => text += `   ${opt}\n`);
      }
      text += `\n[Kunci & Pembahasan]:\n${q.correctAnswer}\n`;
      text += `\n[Rubrik Penilaian]:\n${q.rubrikAsesmen}\n`;
      text += `\n[Analisis Taksonomi]: ${q.taxonomyLevel} - ${q.taxonomyAnalysis}\n`;
      text += `\n[Dimensi Profil]: ${q.profilLulusanDimensi}\n`;
      text += `\n[Prinsip PM]: ${q.prinsipPM}\n`;
      text += `---------------------------------------------------\n\n`;
    });

    navigator.clipboard.writeText(text);
    showToast("Seluruh isi soal beserta rubrik disalin ke clipboard!");
  };

  const handlePrint = () => {
    window.print();
  };

  const downloadOfflineDocument = () => {
    if (!activePackage) return;

    if (!printSelectSoal && !printSelectKisi && !printSelectKunci && !printSelectAnalisis) {
      showToast("⚠️ Silakan pilih minimal satu bagian untuk diunduh!");
      return;
    }

    // Header Logo generation helper images
    const leftLogoImg = kopShowLeftLogo && kopLeftLogo 
      ? `<div style="width: 70px; height: 70px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;"><img src="${kopLeftLogo}" style="max-width: 100%; max-height: 100%; object-fit: contain;" referrerPolicy="no-referrer" /></div>`
      : "";
    const rightLogoImg = kopShowRightLogo && kopRightLogo 
      ? `<div style="width: 70px; height: 70px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;"><img src="${kopRightLogo}" style="max-width: 100%; max-height: 100%; object-fit: contain;" referrerPolicy="no-referrer" /></div>`
      : "";

    // Assemble dynamic list of questions
    const pgQuestions = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda");
    const pgkQuestions = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda Kompleks");
    const jodohQuestions = activePackage.questions.filter((q, idx) => q.type === "Menjodohkan");
    const isianQuestions = activePackage.questions.filter((q, idx) => q.type === "Isian Singkat");
    const uraianQuestions = activePackage.questions.filter((q, idx) => q.type === "Uraian");

    const renderHtmlQuestionText = (text: string) => {
      const blocks = parseTextWithTables(text);
      
      let tblMargin = "12px 0";
      let tblFontSize = "10px";
      let tblPadding = "6px 8px";

      if (tableSize === "kecil") {
        tblMargin = "6px 0";
        tblFontSize = "8.5px";
        tblPadding = "4px 6px";
      } else if (tableSize === "besar") {
        tblMargin = "20px 0";
        tblFontSize = "12px";
        tblPadding = "10px 12px";
      }

      return blocks.map(block => {
        if (block.type === 'text') {
          return `<p style="font-weight: 600; color: #0f172a; margin: 0; white-space: pre-line;">${block.content}</p>`;
        } else {
          const rows = block.content as string[][];
          if (rows.length === 0) return '';

          // Symmetrically pad shorter table rows to match column max
          const maxCols = Math.max(...rows.map(r => r.length), 1);
          const paddedRows = rows.map(r => {
            const copy = [...r];
            while (copy.length < maxCols) {
              copy.push("");
            }
            return copy;
          });

          const headers = paddedRows[0];
          const bodyRows = paddedRows.slice(1);
          return `
            <div class="table-container" style="overflow-x: auto; margin: ${tblMargin}; border: 2px solid #020617; border-radius: 6px; background-color: white;">
              <table style="width: 100%; border-collapse: collapse; font-size: ${tblFontSize}; font-family: sans-serif; text-align: left;">
                <thead>
                  <tr style="background-color: #f1f5f9; border-bottom: 2px solid #020617; text-transform: uppercase;">
                    ${headers.map(h => `<th style="padding: ${tblPadding}; font-weight: bold; border-right: 1px solid #cbd5e1;">${h}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${bodyRows.map(row => `
                    <tr style="border-bottom: 1px solid #cbd5e1;">
                      ${row.map(cell => `<td style="padding: ${tblPadding}; border-right: 1px solid #cbd5e1; color: #1e293b; font-weight: 500;">${cell}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }).join('');
    };

    const renderHtmlQuestion = (q: any, index: number) => {
      const imageHtml = q.hasIllustration && q.renderedSvg
        ? `<div class="custom-image-size" style="margin: 12px auto; text-align: center;">${q.renderedSvg}</div>`
        : "";

      if (q.type === "Menjodohkan") {
        const menjodohkanData = parseMenjodohkan(q.text || "");
        if (menjodohkanData.premis.length > 0 && menjodohkanData.responses.length > 0) {
          const maxRows = Math.max(menjodohkanData.premis.length, menjodohkanData.responses.length);
          const rowsHtml = Array.from({ length: maxRows }).map((_, i) => {
            const resp = menjodohkanData.responses[i];
            const prem = menjodohkanData.premis[i];

            const leftCell = resp ? `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-weight: bold; font-size: 10px; color: #0d9488; background-color: #ccfbf1; width: 18px; height: 18px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-family: monospace; border: 1px solid #99f6e4;">${resp.key}</span>
                  <span style="font-size: 10.5px; font-weight: 500; color: #1e293b; line-height: 1.35; font-family: sans-serif;">${resp.text}</span>
                </div>
                <div style="width: 8px; height: 8px; border-radius: 50%; background-color: #94a3b8; border: 1.5px solid white; box-shadow: 0 0 0 1px #cbd5e1; flex-shrink: 0;"></div>
              </div>` : '';

            const rightCell = prem ? `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <div style="width: 8px; height: 8px; border-radius: 50%; background-color: #94a3b8; border: 1.5px solid white; box-shadow: 0 0 0 1px #cbd5e1; flex-shrink: 0;"></div>
                <div style="display: flex; align-items: center; gap: 6px; flex-direction: row-reverse; width: 100%; justify-content: space-between;">
                  <span style="font-weight: bold; font-size: 10px; color: #475569; background-color: #f1f5f9; width: 18px; height: 18px; border-radius: 4px; display: inline-flex; align-items: center; justify-content: center; font-family: monospace; border: 1px solid #cbd5e1;">${prem.key}</span>
                  <span style="font-size: 10.5px; font-weight: 600; color: #1e293b; line-height: 1.35; text-align: right; flex-grow: 1; font-family: sans-serif;">${prem.text}</span>
                </div>
              </div>` : '';

            return `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px; width: 50%; border-right: 1px solid #cbd5e1; vertical-align: middle;">${leftCell}</td>
                <td style="padding: 10px; width: 50%; vertical-align: middle;">${rightCell}</td>
              </tr>
            `;
          }).join('');

          return `
            <div style="margin-bottom: 25px; page-break-inside: avoid;">
              <div style="display: flex; align-items: flex-start; gap: 8px;">
                <span style="font-weight: bold; color: #0f172a; min-width: 20px; font-size: 13px;">${q.number}.</span>
                <div style="flex: 1; min-width: 0;">
                  ${imageHtml}
                  ${renderHtmlQuestionText(menjodohkanData.introduction || "")}
                  
                  <div class="table-container" style="overflow-x: auto; margin: 12px 0; border: 1.5px solid #020617; border-radius: 6px; background-color: white;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 10px; font-family: sans-serif; text-align: left; table-layout: fixed;">
                      <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; text-transform: uppercase;">
                          <th style="padding: 8px 10px; font-weight: bold; border-right: 1px solid #cbd5e1; font-size: 9px; color: #475569;">${menjodohkanData.responsesHeader}</th>
                          <th style="padding: 8px 10px; font-weight: bold; font-size: 9px; color: #475569;">${menjodohkanData.premisHeader}</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${rowsHtml}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          `;
        }
      }

      // Manage options layout
      let optionsCss = "";
      if (layoutMcq === "vertical") {
        optionsCss = "display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 10px; padding-left: 5px;";
      } else if (layoutMcq === "grid-2") {
        optionsCss = "display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 10px; padding-left: 5px;";
      } else {
        optionsCss = "display: flex; flex-wrap: wrap; gap: 24px; margin-top: 10px; padding-left: 5px;";
      }

      const optionsHtml = q.options && q.options.length > 0
        ? `<div style="${optionsCss}">
            ${q.options.map((opt: string, optIdx: number) => `
              <div style="display: flex; align-items: center; gap: 10px; max-width: 100%;">
                <div style="width: 20px; height: 20px; border-radius: 50%; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 10px; color: #64748b; background-color: white; flex-shrink: 0; text-align: center; line-height: 20px;">
                  ${opt[0]}
                </div>
                <span style="font-weight: 500; color: #1e293b;">${opt.substring(2)}</span>
              </div>
            `).join("")}
          </div>`
        : "";

      return `
        <div style="margin-bottom: 20px; page-break-inside: avoid;">
          <div style="display: flex; align-items: flex-start; gap: 8px;">
            <span style="font-weight: bold; color: #0f172a; min-width: 20px; font-size: 13px;">${q.number}.</span>
            <div style="flex: 1; min-width: 0;">
              ${imageHtml}
              ${renderHtmlQuestionText(q.text || "")}
              ${optionsHtml}
            </div>
          </div>
        </div>
      `;
    };

    const pgHtml = pgQuestions.length > 0
      ? `<div style="margin-top: 25px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 12px;">
            <h3 style="font-size: 13px; font-weight: 950; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.1em;">BAGIAN I: PILIHAN GANDA</h3>
            <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 0 0;">Pilihlah salah satu jawaban yang paling tepat pada lembar jawaban Anda.</p>
          </div>
          <div>${pgQuestions.map((q, idx) => renderHtmlQuestion(q, idx)).join("")}</div>
         </div>`
      : "";

    const pgkHtml = pgkQuestions.length > 0
      ? `<div style="margin-top: 30px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 12px;">
            <h3 style="font-size: 13px; font-weight: 950; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.1em;">BAGIAN II: PILIHAN GANDA KOMPLEKS</h3>
            <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 0 0;">Pilihlah satu atau lebih jawaban yang tepat pada lembar jawaban Anda.</p>
          </div>
          <div>${pgkQuestions.map((q, idx) => renderHtmlQuestion(q, idx)).join("")}</div>
         </div>`
      : "";

    const jodohHtml = jodohQuestions.length > 0
      ? `<div style="margin-top: 30px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 12px;">
            <h3 style="font-size: 13px; font-weight: 950; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.1em;">BAGIAN III: MENJODOHKAN</h3>
            <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 0 0;">Pasangkanlah pernyataan di sebelah kiri (premis) dengan pilihan di sebelah kanan yang sesuai.</p>
          </div>
          <div>${jodohQuestions.map((q, idx) => renderHtmlQuestion(q, idx)).join("")}</div>
         </div>`
      : "";

    const isianHtml = isianQuestions.length > 0
      ? `<div style="margin-top: 30px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 12px;">
            <h3 style="font-size: 13px; font-weight: 950; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.1em;">BAGIAN IV: ISIAN SINGKAT</h3>
            <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 0 0;">Isilah titik-titik di bawah ini dengan jawaban yang singkat, padat, dan benar.</p>
          </div>
          <div>${isianQuestions.map((q, idx) => renderHtmlQuestion(q, idx)).join("")}</div>
         </div>`
      : "";

    const uraianHtml = uraianQuestions.length > 0
      ? `<div style="margin-top: 30px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 12px;">
            <h3 style="font-size: 13px; font-weight: 950; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.1em;">BAGIAN V: URAIAN / ESSAY</h3>
            <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 0 0;">Jawablah pertanyaan berikut secara lengkap disertai dengan langkah penalaran yang tepat.</p>
          </div>
          <div>${uraianQuestions.map((q, idx) => renderHtmlQuestion(q, idx)).join("")}</div>
         </div>`
      : "";

    const studentDetailsHtml = (fieldNamaShow || fieldNomorShow || fieldKelasShow || fieldMapelShow || fieldHariTanggalShow || fieldNilaiShow)
      ? `<div style="margin-top: 15px; margin-bottom: 25px; border: 2px solid #0f172a; padding: 12px; border-radius: 8px; display: flex; justify-content: space-between; gap: 15px; background-color: #f8fafc;">
          <div style="flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 8px; text-transform: uppercase; font-size: 10.5px; font-family: sans-serif;">
            ${fieldNamaShow ? `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 100px; font-weight: bold; flex-shrink: 0; color: #334155;">Nama Siswa</span>
                <span style="font-weight: bold; color: #334155;">:</span>
                <div style="flex-grow: 1; border-bottom: 1px dotted #64748b; height: 16px;"></div>
              </div>` : ""}
            ${fieldNomorShow ? `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 100px; font-weight: bold; flex-shrink: 0; color: #334155;">Nomor Absen</span>
                <span style="font-weight: bold; color: #334155;">:</span>
                <div style="flex-grow: 1; border-bottom: 1px dotted #64748b; height: 16px;"></div>
              </div>` : ""}
            ${fieldKelasShow ? `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 100px; font-weight: bold; flex-shrink: 0; color: #334155;">Kelas / Fase</span>
                <span style="font-weight: bold; color: #334155;">:</span>
                <span style="font-weight: 900; color: #020617;">${activePackage.kelas} / ${activePackage.fase}</span>
              </div>` : ""}
            ${fieldMapelShow ? `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 100px; font-weight: bold; flex-shrink: 0; color: #334155;">Mata Pelajaran</span>
                <span style="font-weight: bold; color: #334155;">:</span>
                <span style="font-weight: 900; color: #020617;">${activePackage.subject}</span>
              </div>` : ""}
            ${fieldHariTanggalShow ? `
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="width: 100px; font-weight: bold; flex-shrink: 0; color: #334155;">Hari / Tanggal</span>
                <span style="font-weight: bold; color: #334155;">:</span>
                <div style="flex-grow: 1; border-bottom: 1px dotted #64748b; height: 16px;"></div>
              </div>` : ""}
          </div>
          ${fieldNilaiShow ? `
            <div style="width: 80px; height: 60px; border: 2px solid #0f172a; border-radius: 6px; display: flex; flex-direction: column; overflow: hidden; text-align: center; background-color: white; align-self: center;">
              <div style="background-color: #f1f5f9; border-bottom: 1px solid #0f172a; font-size: 8.5px; font-weight: bold; padding: 2px 0;">NILAI</div>
              <div style="flex-grow: 1;"></div>
            </div>` : ""}
         </div>`
      : "";

    let bodySegmentsContent = "";

    // 1. Soal Asesmen Section
    if (printSelectSoal) {
      bodySegmentsContent += `
        <!-- Header instansi -->
        <div class="exam-header-main">
          ${leftLogoImg}
          <div style="flex-grow: 1; text-align: center; font-family: serif;">
            <h3 style="font-size: 11px; font-weight: bold; margin: 0; text-transform: uppercase; color: #475569;">${kopNamaSekolah}</h3>
            ${kopBarisTambahan1 ? `<h3 style="font-size: 11px; font-weight: bold; margin: 1px 0 0 0; text-transform: uppercase; color: #475569;">${kopBarisTambahan1}</h3>` : ''}
            <h2 style="font-size: 15px; font-weight: 850; margin: 4px 0; text-transform: uppercase; color: #0f172a; border-bottom: 1px dashed #cbd5e1; padding-bottom: 2px;">${kopNamaInstansi}</h2>
            <p style="font-size: 9px; font-style: italic; color: #64748b; margin: 4px 0 0 0; font-family: sans-serif;">${kopAlamat}</p>
            ${kopBarisTambahan2 ? `<p style="font-size: 8.5px; font-style: italic; color: #64748b; margin: 2px 0 0 0; font-family: sans-serif;">${kopBarisTambahan2}</p>` : ''}
          </div>
          ${rightLogoImg}
        </div>

        <!-- Judul Asesmen -->
        <div style="text-align: center; margin: 15px 0 25px 0;">
          <h2 style="font-size: 14.5px; font-weight: 950; text-transform: uppercase; margin: 0; letter-spacing: 0.05em; color: #020617;">
            ${customJudulAsesmen || activePackage.title}
          </h2>
        </div>

        <!-- Student details fields block -->
        ${studentDetailsHtml}

        <!-- Questions list content -->
        ${pgHtml}
        ${pgkHtml}
        ${jodohHtml}
        ${isianHtml}
        ${uraianHtml}
      `;
    }

    // 2. Kisi-Kisi Asesmen Section
    if (printSelectKisi) {
      const pageBreak = printSelectSoal ? 'page-break-before: always;' : '';
      bodySegmentsContent += `
        <div style="${pageBreak} margin-top: 40px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 20px;">
            <h2 style="font-size: 15px; font-weight: 950; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.05em;">KISI-KISI ASESMEN SEKOLAH</h2>
            <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 0 0;">${activePackage.subject || ""} • Kelas ${activePackage.kelas || ""} / ${activePackage.fase || ""}</p>
          </div>
          <table class="grid-table" style="font-size: 11px;" border="1" cellpadding="6" cellspacing="0">
            <thead>
              <tr style="background-color: #f1f5f9; border-bottom: 2px solid #0f172a;">
                <th style="padding: 10px; text-align: center; font-weight: bold; width: 60px;">No. Soal</th>
                <th style="padding: 10px; text-align: left; font-weight: bold; width: 100px;">Bentuk Soal</th>
                <th style="padding: 10px; text-align: left; font-weight: bold; width: 130px;">Materi Pokok</th>
                <th style="padding: 10px; text-align: left; font-weight: bold;">Indikator Kisi-Kisi & Stimulus Asesmen</th>
                <th style="padding: 10px; text-align: left; font-weight: bold; width: 150px;">Level Taksonomi (${taksonomi || ""})</th>
                <th style="padding: 10px; text-align: left; font-weight: bold; width: 140px;">Dimensi Profil Lulusan</th>
                <th style="padding: 10px; text-align: center; font-weight: bold; width: 70px;">Skor</th>
              </tr>
            </thead>
            <tbody>
              ${activePackage.questions.map((q, idx) => {
                let bobot = "1";
                if (q.type === "Pilihan Ganda Kompleks") bobot = "2";
                else if (q.type === "Menjodohkan") bobot = "3";
                else if (q.type === "Isian Singkat") bobot = "2";
                else if (q.type === "Uraian") bobot = "5";
                
                const materiTopik = q.materiTopik || activePackage.subject || "Materi Kurikulum";
                const indikatorSoal = q.indikatorSoal || `Disajikan stimulus kontekstual, peserta didik dapat menyelesaikan persoalan berkaitan dengan tema ${activePackage.subject || "pembelajaran"} pada tingkatan kognitif ${q.taxonomyLevel || "terkait"} secara mandiri dengan tepat.`;
                const stimulusAsesmen = q.stimulusAsesmen || "Kasus atau skenario kontekstual terintegrasi.";
                
                return `
                  <tr>
                    <td style="padding: 10px; text-align: center; font-weight: bold;">${q.number}</td>
                    <td style="padding: 10px; font-weight: bold; color: #475569;">${q.type || ""}</td>
                    <td style="padding: 10px;">${materiTopik}</td>
                    <td style="padding: 10px; line-height: 1.5;">
                      <div style="margin-bottom: 6px;">
                        <span style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">Indikator Soal:</span>
                        <p style="margin: 0; font-size: 9.5px; font-weight: 500; color: #020617; background-color: #f8fafc; padding: 6px; border: 1px solid #e2e8f0; border-radius: 4px;">${indikatorSoal}</p>
                      </div>
                      <div>
                        <span style="font-size: 8px; font-weight: bold; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">Stimulus Asesmen:</span>
                        <p style="margin: 0; font-size: 9px; font-style: italic; color: #475569;">${stimulusAsesmen}</p>
                      </div>
                    </td>
                    <td style="padding: 10px;">
                      <strong style="color: #0f172a; display: block; font-size: 10.5px;">${q.taxonomyLevel || ""}</strong>
                      <span style="font-size: 9px; color: #64748b; display: block; margin-top: 3px; line-height: 1.3;">${q.taxonomyAnalysis || ""}</span>
                    </td>
                    <td style="padding: 10px; color: #0d9488; font-weight: bold; font-size: 10px;">${q.profilLulusanDimensi || ""}</td>
                    <td style="padding: 10px; text-align: center; font-weight: bold;">${bobot}</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    // 3. Kunci Jawaban & Rubrik Section
    if (printSelectKunci) {
      const pageBreak = (printSelectSoal || printSelectKisi) ? 'page-break-before: always;' : '';
      
      const renderKunciItem = (q: any) => {
        const isPg = q.type === "Pilihan Ganda" || q.type === "Pilihan Ganda Kompleks" || q.type === "Menjodohkan";
        return `
          <div style="margin-bottom: 20px; border: 1px solid #cbd5e1; border-radius: 8px; padding: 12px; background-color: white; page-break-inside: avoid;">
            <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold; color: #020617; font-size: 12px;">No. ${q.number} (${q.type || ""})</span>
              <span style="font-size: 10px; color: #64748b; font-weight: bold;">${q.taxonomyLevel || ""}</span>
            </div>
            <table style="width: 100%; border-collapse: collapse;" cellpadding="4">
              <tr>
                <td style="width: 40%; vertical-align: top; padding: 5px;">
                  <span style="font-size: 9px; font-weight: bold; color: #64748b; text-transform: uppercase;">${isPg ? "Kunci Jawaban:" : "Penyelesaian Ideal:"}</span>
                  <p style="margin: 4px 0 0 0; font-family: monospace; white-space: pre-line; font-size: 11px; font-weight: bold; color: #0f172a; background-color: #f8fafc; padding: 8px; border-radius: 6px; border: 1px solid #e2e8f0;">${q.correctAnswer || ""}</p>
                </td>
                <td style="width: 60%; vertical-align: top; padding: 5px; border-left: 1px solid #e2e8f0;">
                  <span style="font-size: 9px; font-weight: bold; color: #0d9488; text-transform: uppercase;">${isPg ? "Pembahasan Soal:" : "Rubrik Asesmen & Penskoran:"}</span>
                  <p style="margin: 4px 0 0 0; white-space: pre-line; font-size: 11px; color: #334155; line-height: 1.4;">${q.rubrikAsesmen || ""}</p>
                </td>
              </tr>
            </table>
          </div>
        `;
      };
      
      const pgQ = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda");
      const pgkQ = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda Kompleks");
      const jodohQ = activePackage.questions.filter((q, idx) => q.type === "Menjodohkan");
      const isianQ = activePackage.questions.filter((q, idx) => q.type === "Isian Singkat");
      const uraianQ = activePackage.questions.filter((q, idx) => q.type === "Uraian");
 
      bodySegmentsContent += `
        <div style="${pageBreak} margin-top: 40px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 20px;">
            <h2 style="font-size: 15px; font-weight: 950; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.05em;">KUNCI JAWABAN & PEDOMAN RUBRIK ASESMEN</h2>
            <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 0 0;">${activePackage.subject || ""} • Kelas ${activePackage.kelas || ""} / ${activePackage.fase || ""}</p>
          </div>
          
          ${pgQ.length > 0 ? `
            <div style="margin-top: 15px; margin-bottom: 25px;">
              <h3 style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; letter-spacing: 0.05em;">Bagian I: Pilihan Ganda</h3>
              <div style="margin-top: 10px;">${pgQ.map(renderKunciItem).join("")}</div>
            </div>
          ` : ""}
 
          ${pgkQ.length > 0 ? `
            <div style="margin-top: 15px; margin-bottom: 25px;">
              <h3 style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; letter-spacing: 0.05em;">Bagian II: Pilihan Ganda Kompleks</h3>
              <div style="margin-top: 10px;">${pgkQ.map(renderKunciItem).join("")}</div>
            </div>
          ` : ""}
 
          ${jodohQ.length > 0 ? `
            <div style="margin-top: 15px; margin-bottom: 25px;">
              <h3 style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; letter-spacing: 0.05em;">Bagian III: Menjodohkan</h3>
              <div style="margin-top: 10px;">${jodohQ.map(renderKunciItem).join("")}</div>
            </div>
          ` : ""}
 
          ${isianQ.length > 0 ? `
            <div style="margin-top: 15px; margin-bottom: 25px;">
              <h3 style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; letter-spacing: 0.05em;">Bagian IV: Isian Singkat</h3>
              <div style="margin-top: 10px;">${isianQ.map(renderKunciItem).join("")}</div>
            </div>
          ` : ""}
 
          ${uraianQ.length > 0 ? `
            <div style="margin-top: 15px; margin-bottom: 25px;">
              <h3 style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; padding-bottom: 3px; letter-spacing: 0.05em;">Bagian V: Uraian / Essay</h3>
              <div style="margin-top: 10px;">${uraianQ.map(renderKunciItem).join("")}</div>
            </div>
          ` : ""}
        </div>
      `;
    }

    // 4. Analisis Pedagogis Section
    const { staticBarChartHtml, staticDonutChartHtml } = generateStaticChartsHtml(activePackage.questions, taksonomi, soloLevels, bloomLevels);


    if (printSelectAnalisis) {
      const pageBreak = (printSelectSoal || printSelectKisi || printSelectKunci) ? 'page-break-before: always;' : '';
      bodySegmentsContent += `
        <div style="${pageBreak} margin-top: 40px;">
          <div style="border-bottom: 2px solid #0f172a; padding-bottom: 4px; margin-bottom: 20px;">
            <h2 style="font-size: 15px; font-weight: 950; color: #0f172a; text-transform: uppercase; margin: 0; letter-spacing: 0.05em;">ANALISIS PEDAGOGIS GURU & PETA DIMENSI</h2>
            <p style="font-size: 10.5px; color: #64748b; font-style: italic; margin: 2px 0 0 0;">${activePackage.subject || ""} • Kelas ${activePackage.kelas || ""} / ${activePackage.fase || ""}</p>
          </div>
          
          <div style="display: flex; gap: 20px; align-items: stretch; margin-bottom: 25px; page-break-inside: avoid;">
            <div style="flex: 1; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; background: #fff;">
              ${staticBarChartHtml}
            </div>
            <div style="flex: 1; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px; background: #fff;">
              ${staticDonutChartHtml}
            </div>
          </div>

          <table class="grid-table" style="font-size: 11px;" border="1" cellpadding="6" cellspacing="0">
            <thead>
              <tr style="background-color: #f1f5f9; border-bottom: 2px solid #0f172a;">
                <th style="padding: 10px; text-align: center; font-weight: bold; width: 50px;">No.</th>
                <th style="padding: 10px; text-align: left; font-weight: bold; width: 45%;">Level Taksonomi (${taksonomi || ""}) & Analisis Pedagogis</th>
                <th style="padding: 10px; text-align: left; font-weight: bold; width: 45%;">Dimensi Profil Lulusan</th>
              </tr>
            </thead>
            <tbody>
              ${activePackage.questions.map((q, idx) => {
                return `
                  <tr>
                    <td style="padding: 10px; text-align: center; font-weight: bold;">${q.number}</td>
                    <td style="padding: 10px; line-height: 1.5;">
                      <span style="font-weight: bold; display: inline-block; background-color: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; margin-bottom: 4px; color: #1e293b;">${q.taxonomyLevel || ""}</span>
                      <p style="margin: 0; font-size: 10.5px; color: #475569;">${q.taxonomyAnalysis || ""}</p>
                    </td>
                    <td style="padding: 10px; line-height: 1.5;">
                      <span style="font-weight: bold; display: inline-block; background-color: #ccfbf1; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; margin-bottom: 4px; color: #0f766e;">${q.profilLulusanDimensi || ""}</span>
                      <p style="margin: 0; font-size: 10.5px; color: #475569;">${q.prinsipPM || ""}</p>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      `;
    }

    const docContent = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${activePackage.subject} - ${activePackage.kelas}</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Inter', sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      color: #334155;
    }
    /* Style for grid analytical tables (Kisi-Kisi & Analisis Pedagogis) */
    .grid-table {
      border: 1.5px solid #020617 !important;
      border-collapse: collapse !important;
      width: 100% !important;
      margin-top: 15px !important;
    }
    .grid-table th {
      border: 1px solid #020617 !important;
      background-color: #f1f5f9 !important;
      font-weight: bold !important;
      text-align: left !important;
      padding: 10px !important;
    }
    .grid-table td {
      border: 1px solid #cbd5e1 !important;
      padding: 10px !important;
    }
    .no-print-bar {
      max-width: 800px;
      margin: 30px auto 0 auto;
      background: linear-gradient(135deg, #0d9488, #0f766e);
      padding: 20px;
      border-radius: 16px;
      color: white;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      gap: 12px;
      font-family: system-ui, -apple-system, sans-serif;
    }
    @media (min-width: 640px) {
      .no-print-bar {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }
    }
    .print-button {
      background-color: #ffffff;
      color: #0f766e;
      border: none;
      padding: 10px 18px;
      border-radius: 10px;
      font-weight: bold;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: background 0.2s;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .print-button:hover {
      background-color: #f8fafc;
    }
    .paper-container {
      width: 100%;
      max-width: 210mm;
      min-height: 297mm;
      margin: 30px auto;
      background-color: white;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
      border: 1px solid #e2e8f0;
      padding: ${marginPdf === "small" ? "40px" : marginPdf === "medium" ? "60px" : "80px"};
      position: relative;
    }
    .custom-font-size-target,
    .custom-font-size-target p, 
    .custom-font-size-target span, 
    .custom-font-size-target div,
    .custom-font-size-target td,
    .custom-font-size-target th {
      font-size: ${fontSize === "xs" ? "11px" : fontSize === "sm" ? "12px" : fontSize === "base" ? "14px" : "15.5px"} !important;
      line-height: ${lineSpacing === "tight" ? "1.25" : lineSpacing === "normal" ? "1.5" : "1.8"} !important;
    }
    .custom-image-size {
      width: ${imageSize === "small" ? "180px" : imageSize === "medium" ? "280px" : "400px"} !important;
      height: ${imageSize === "small" ? "130px" : imageSize === "medium" ? "210px" : "300px"} !important;
    }
    .custom-image-size svg,
    .custom-image-size img {
      width: 100% !important;
      height: 100% !important;
      display: block !important;
      object-fit: contain !important;
      max-width: 100% !important;
      max-height: 100% !important;
    }
    .exam-header-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      border-bottom: 4px double #020617;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      body {
        background-color: white !important;
        padding: 0 !important;
      }
      .no-print-bar, .no-print {
        display: none !important;
      }
      .paper-container {
        border: none !important;
        box-shadow: none !important;
        margin: 0 !important;
        padding: 0 !important;
        width: 100% !important;
        border-radius: 0 !important;
      }
      @page {
        size: A4;
        margin: ${marginPdf === "small" ? "0.4in" : marginPdf === "medium" ? "0.75in" : "1.1in"} !important;
      }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div>
      <h3 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 850; letter-spacing: -0.02em;">Dokumen Siap Cetak (A4 Standard)</h3>
      <p style="margin: 0; font-size: 11.5px; opacity: 0.9; line-height: 1.4;">
        Semua tata letak, ukuran gambar, dan margin sudah dipersiapkan secara presisi untuk layout printer Anda.
      </p>
    </div>
    <button onclick="window.print()" class="print-button">
      <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.617 0-1.11-.535-1.07-1.15l.178-2.6m11.321 0H6.34m11.321 0c.51 0 .954-.316 1.118-.792l1.047-3.036a2.25 2.25 0 00-2.118-2.98h-1.135m-11.32 0h1.135m-1.135 0a2.25 2.25 0 00-2.118 3.03l1.047 3.037c.164.476.608.791 1.118.791m11.319 0h-5.06m0 0V4.5A2.25 2.25 0 009 2.25h5.06M16.5 9h.008v.008H16.5V9z"></path></svg>
      Cetak Lembar Asesmen
    </button>
  </div>

  <div class="paper-container custom-font-size-target">
    ${bodySegmentsContent}
  </div>
</body>
</html>
    `;

    // Download flow
    const cleanSubject = activePackage.subject.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const cleanKelas = activePackage.kelas.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    
    const blob = new Blob([docContent], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `soal_cetak_${cleanSubject}_kelas_${cleanKelas}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("✓ File Soal Cetak Offline (.html) berhasil diunduh!");
  };

  const downloadOfflineHtml = () => {
    downloadOfflineDocument();
  };

  const downloadDocxDocument = async () => {
    if (!activePackage) {
      showToast("⚠️ Tidak ada paket soal yang aktif!");
      return;
    }

    setIsExportingDocx(true);
    showToast("ℹ️ Sedang menyiapkan dokumen Word/Docx...");

    try {
      const identityData = [];
      if (fieldNamaShow) identityData.push({ key: "Nama Siswa", value: "" });
      if (fieldNomorShow) identityData.push({ key: "Nomor Absen", value: "" });
      if (fieldKelasShow) identityData.push({ key: "Kelas / Fase", value: `${activePackage.kelas} / ${activePackage.fase}` });
      if (fieldMapelShow) identityData.push({ key: "Mata Pelajaran", value: activePackage.subject });
      if (fieldHariTanggalShow) identityData.push({ key: "Hari / Tanggal", value: "" });

      const payload = {
        title: customJudulAsesmen || activePackage.title,
        kop: {
          namaSekolah: kopNamaSekolah,
          barisTambahan1: kopBarisTambahan1,
          namaInstansi: kopNamaInstansi,
          alamat: kopAlamat,
          barisTambahan2: kopBarisTambahan2,
        },
        identity: identityData,
        questions: activePackage.questions,
        printSelectSoal,
        printSelectKisi,
        printSelectKunci,
        printSelectAnalisis,
        subject: activePackage.subject,
        kelas: activePackage.kelas,
        fase: activePackage.fase,
        taksonomi: activePackage.taksonomi || taksonomi,
      };

      const res = await fetch("/api/export-docx", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const blob = await res.blob();
      const cleanSubject = activePackage.subject.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const cleanKelas = activePackage.kelas.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const filename = `soal_asesmen_${cleanSubject}_kelas_${cleanKelas}.docx`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      showToast("✓ File Word/Docx berhasil diunduh!");
    } catch (err: any) {
      console.error("Gagal mengunduh Docx:", err);
      showToast(`❌ Gagal mengunduh Docx: ${err.message || err}`);
    } finally {
      setIsExportingDocx(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen text-slate-800 selection:bg-teal-100 selection:text-teal-900 bg-slate-50/50">
      
      {/* Printable CSS standard injection */}
      <style>{`
        /* Dynamic font scaling & line height */
        .custom-font-size-target,
        .custom-font-size-target p, 
        .custom-font-size-target span, 
        .custom-font-size-target div,
        .custom-font-size-target td,
        .custom-font-size-target th {
          font-size: ${
            fontSize === "xs" ? "11px" :
            fontSize === "sm" ? "12px" :
            fontSize === "base" ? "14px" : "15.5px"
          } !important;
          line-height: ${
            lineSpacing === "tight" ? "1.25" :
            lineSpacing === "normal" ? "1.5" : "1.8"
          } !important;
        }

        /* SVG & image sizes on screen and print */
        .custom-image-size {
          width: ${
            imageSize === "small" ? "180px" :
            imageSize === "medium" ? "280px" : "400px"
          } !important;
          height: ${
            imageSize === "small" ? "130px" :
            imageSize === "medium" ? "210px" : "300px"
          } !important;
          margin-left: auto !important;
          margin-right: auto !important;
          display: block !important;
        }
        .custom-image-size svg,
        .custom-image-size img {
          width: 100% !important;
          height: 100% !important;
          display: block !important;
          object-fit: contain !important;
          max-width: 100% !important;
          max-height: 100% !important;
        }

        /* Ensure table borders print cleanly */
        .segment-kisi table, 
        .segment-analisis table {
          border: 1.5px solid #020617 !important;
          border-collapse: collapse !important;
          width: 100% !important;
        }
        .segment-kisi th, 
        .segment-analisis th {
          border: 1px solid #020617 !important;
          background-color: #f1f5f9 !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .segment-kisi td, 
        .segment-analisis td {
          border: 1px solid #cbd5e1 !important;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: A4;
            margin: ${
              marginPdf === "small" ? "0.4in" :
              marginPdf === "medium" ? "0.75in" : "1.1in"
            } !important;
          }
          body {
            background: white !important;
            color: black !important;
          }
          header, 
          .no-print,
          .history-side,
          .config-panel {
            display: none !important;
          }
          .print-area {
            width: 100% !important;
            max-width: 100% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
            background: white !important;
          }
          .exam-header {
            border-bottom: 3.5px double black !important;
            margin-bottom: 1.5rem !important;
          }
          /* Ensure SVGs print cleanly */
          .custom-image-size {
            display: block !important;
            visibility: visible !important;
          }

          /* Hide entire main contents if the preview modal is active to prevent double-printing or leakage */
          body.preview-modal-active header,
          body.preview-modal-active main {
            display: none !important;
          }
          body.preview-modal-active .modal-backdrop-to-print-clean {
            position: absolute !important;
            inset: 0 !important;
            background: white !important;
            z-index: 9999 !important;
            display: block !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          body.preview-modal-active .modal-sidebar-to-hide {
            display: none !important;
          }
          body.preview-modal-active .modal-preview-scroller {
            overflow: visible !important;
            display: block !important;
            padding: 0 !important;
            background: white !important;
          }
          body.preview-modal-active .modal-printable-paper {
            border: none !important;
            box-shadow: none !important;
            margin: 0 !important;
            padding: 0 !important;
            max-width: 100% !important;
            width: 100% !important;
            zoom: 100% !important;
          }
        }
      `}</style>

      {/* Modern Header Navigation */}
      <header className="no-print border-b border-slate-200/50 sticky top-0 z-40 backdrop-blur-md bg-white/80 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 shrink-0 flex items-center justify-center">
              <img 
                src="/ngide-logo.webp" 
                alt="Ngide Soal Logo" 
                className="w-10 h-10 object-contain rounded-xl shadow-sm border border-slate-100 bg-teal-50/50"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-bold tracking-tight text-slate-900 flex flex-nowrap items-center gap-1 sm:gap-1.5 font-display select-none">
                <span className="truncate">Ngide Soal</span>
                <span className="text-[8px] sm:text-[9px] font-black bg-amber-500 text-slate-950 px-1 sm:px-1.5 py-0.5 rounded shadow-sm font-mono tracking-wide shrink-0">N Version</span>
                <span className="hidden md:inline-flex text-[9px] font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100/50 font-sans shrink-0">
                  Multijenjang Kurikulum 2026
                </span>
              </span>
              <p className="hidden sm:block text-[9px] md:text-[10px] text-slate-400 font-medium tracking-tight truncate">
                Formulasi cerdas asesmen Pembelajaran Mendalam
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <button
              onClick={() => setShowInfoModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition-all font-semibold text-[10.5px] cursor-pointer shadow-2xs hover:scale-[1.01]"
              title="Memahami Kurikulum"
            >
              <BookOpen className="w-3.5 h-3.5 text-teal-600" />
              <span className="hidden sm:inline">Memahami Kurikulum</span>
            </button>
            <button
              onClick={() => setShowApiKeySettingsModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition-all font-semibold text-[10.5px] cursor-pointer shadow-2xs hover:scale-[1.01]"
              title="Set API Key/Model"
            >
              <Key className="w-3.5 h-3.5 text-teal-500 animate-pulse" />
              <span className="hidden sm:inline">{customApiKey ? "API Anda Aktif" : "Set API Key/Model"}</span>
              {customApiKey ? (
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
              ) : (
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0 animate-ping" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Floating alert */}
      {toastMessage && (
        <div className="no-print fixed top-20 right-6 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 border border-slate-800 animate-slide-in">
          <CheckSquare className="w-4 h-4 text-emerald-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main navigation menu for better UX: Konfigurasi, Hasil, Riwayat */}
      <div className="no-print border-b border-slate-100 bg-white/60 backdrop-blur-md sticky top-16 z-30 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-1 md:flex md:space-x-2 py-2 overflow-x-hidden md:overflow-x-auto">
            <button
              onClick={() => setActiveMainMenu("konfigurasi")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer select-none border w-full md:w-auto",
                activeMainMenu === "konfigurasi"
                  ? "bg-teal-600 text-white border-teal-650 shadow-sm shadow-teal-100/50"
                  : "bg-white text-slate-600 hover:text-slate-900 border-slate-200/80 hover:bg-slate-50"
              )}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                <span className="hidden sm:inline">Konfigurasi Soal</span>
                <span className="sm:hidden">Konfigurasi</span>
              </span>
            </button>

            <button
              onClick={() => setActiveMainMenu("hasil")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer select-none relative border w-full md:w-auto",
                activeMainMenu === "hasil"
                  ? "bg-teal-600 text-white border-teal-650 shadow-sm shadow-teal-100/50"
                  : "bg-white text-slate-600 hover:text-slate-900 border-slate-200/80 hover:bg-slate-50"
              )}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                <span className="hidden sm:inline">Hasil Formulasi</span>
                <span className="sm:hidden">Hasil</span>
              </span>
              {activePackage && activeMainMenu !== "hasil" && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full ring-2 ring-white animate-pulse" />
              )}
            </button>

            <button
              onClick={() => setActiveMainMenu("riwayat")}
              className={cn(
                "flex items-center justify-center gap-1.5 px-2 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer select-none relative border w-full md:w-auto",
                activeMainMenu === "riwayat"
                  ? "bg-teal-600 text-white border-teal-650 shadow-sm shadow-teal-100/50"
                  : "bg-white text-slate-600 hover:text-slate-900 border-slate-200/80 hover:bg-slate-50"
              )}
            >
              <History className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                <span className="hidden sm:inline">Riwayat Soal ({historyPackages.length})</span>
                <span className="sm:hidden">Riwayat ({historyPackages.length})</span>
              </span>
            </button>
          </div>
        </div>
      </div>
      {/* Layout Split Columns */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        
        {/* LEFT PANEL: Form Inputs / Settings */}
        <div className={cn("no-print w-full flex flex-col gap-6 shrink-0 transition-all duration-300", activeMainMenu === "konfigurasi" ? "block lg:max-w-3xl mx-auto" : "hidden")}>
          
          {/* Core Configuration Form */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-indigo-500"></div>

            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold font-display text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-teal-600 animate-pulse" />
                Parameter Soal Baru
              </h2>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              
              {/* Unified Curriculum Scope Container */}
              <div className="bg-[#f8fafc] rounded-2xl p-3.5 sm:p-4.5 border border-slate-200/60 space-y-4 shadow-2xs">
                <div className="flex items-center gap-1.5 pb-2.5 border-b border-slate-200/60">
                  <div className="w-5 h-5 rounded-md bg-teal-50 text-teal-700 flex items-center justify-center text-[10px] font-bold border border-teal-200/50">
                    A
                  </div>
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider font-display">
                    Pilih Jenjang & Mata Pelajaran
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 1: Pilih Jenjang Sekolah (Dropdown) */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <span>1. Pilih Jenjang Sekolah</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={level}
                      onChange={(e) => handleLevelChange(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 text-slate-800 text-xs bg-white cursor-pointer hover:bg-slate-50/80 transition-all font-semibold shadow-2xs"
                    >
                      {LIST_JENJANG.map((jenjang) => (
                        <option key={jenjang.id} value={jenjang.id}>
                          {jenjang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 2: Pilih Mata Pelajaran (Dropdown) */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500 flex items-center gap-1">
                      <span>2. Pilih Mata Pelajaran</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 text-slate-800 text-xs bg-white cursor-pointer hover:bg-slate-50/80 transition-all font-semibold shadow-2xs"
                    >
                      {(MAPEL_BY_JENJANG[level] || MAPEL_BY_JENJANG["SD"]).map((mapel) => (
                        <option key={mapel} value={mapel}>
                          {mapel}
                        </option>
                      ))}
                    </select>
                    {subject === "Lainnya..." && (
                      <input
                        type="text"
                        value={customSubject}
                        onChange={(e) => setCustomSubject(e.target.value)}
                        placeholder="Ketik mata pelajaran lainnya..."
                        className="w-full mt-2 px-3 py-2 rounded-xl border border-teal-200/60 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 bg-white text-slate-900 text-xs transition-all font-medium placeholder-slate-400"
                        required
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4 pt-1 border-t border-slate-200/40">
                  {/* Step 3: Pilih Fase */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500">
                      3. Pilih Fase
                    </label>
                    <select
                      value={activeFaseId}
                      onChange={(e) => {
                        const nextFase = e.target.value;
                        setActiveFaseId(nextFase);
                        const matchedClasses = LIST_FASE.find((f) => f.id === nextFase)?.kelas || [];
                        if (matchedClasses.length > 0) {
                          setKelas(matchedClasses[0]);
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 text-slate-800 text-xs bg-white cursor-pointer hover:bg-slate-50/80 transition-all font-semibold shadow-2xs"
                    >
                      {availablePhases.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Step 4: Pilih Kelas */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-bold text-slate-500">
                      4. Pilih Kelas
                    </label>
                    <select
                      value={kelas}
                      onChange={(e) => setKelas(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200/80 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 text-slate-800 text-xs bg-white cursor-pointer hover:bg-slate-50/80 transition-all font-semibold shadow-2xs"
                    >
                      {classesForFase.map((kls) => (
                        <option key={kls} value={kls}>
                          {kls}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Content Source List Builder */}
              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 mb-1">
                  <label className="block text-xs font-bold text-slate-800 font-display">
                    5. Masukkan Sumber Konten (TP / Lingkup Materi) <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:flex gap-1.5 w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSibiJenjang("SD/MI");
                        if (kelas === "Kelas 3" || kelas === "Kelas 4") {
                          setSibiKelas("Kelas IV");
                        } else if (kelas === "Kelas 1" || kelas === "Kelas 2") {
                          setSibiKelas("Kelas IV"); // Default test class matching user request
                        } else {
                          setSibiKelas("Kelas IV"); // Keep it on Kelas IV to let them easily select Bahasa Indonesia Book
                        }
                        setSibiMapel("Bahasa Indonesia");
                        setSibiSelectedBookId(null);
                        setSibiSelectedTopics([]);
                        setShowSibiModal(true);
                      }}
                      className="text-[10px] font-bold text-teal-700 hover:text-teal-800 flex items-center justify-center gap-1 bg-teal-50 px-2 sm:px-2.5 py-1.5 rounded-xl border border-teal-100/60 hover:bg-teal-100/80 transition-all cursor-pointer shadow-2xs w-full sm:w-auto"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <span className="truncate">Buku Paket (SIBI)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPanduanSelectedFaseId(activeFaseId);
                        setPanduanMapel("Bahasa Indonesia");
                        setPanduanSelectedBookId(null);
                        setPanduanSelectedTopics([]);
                        setShowPanduanModal(true);
                      }}
                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-800 flex items-center justify-center gap-1 bg-indigo-50 px-2 sm:px-2.5 py-1.5 rounded-xl border border-indigo-100/60 hover:bg-indigo-100/80 transition-all cursor-pointer shadow-2xs w-full sm:w-auto"
                    >
                      <Bookmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="truncate">Panduan Guru (Fase)</span>
                    </button>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 mb-2 leading-normal">Tuliskan tujuan pembelajaran spesifik, atau klik &ldquo;Load dari Buku Paket&rdquo; untuk langsung memuat lingkup materi Resmi Kementerian.</p>
                
                <div className="space-y-2.5">
                  <div className="flex gap-2">
                    <select
                      value={contentType}
                      onChange={(e) => setContentType(e.target.value as any)}
                      className="px-2.5 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 text-slate-800 text-xs bg-[#f8fafc] cursor-pointer shrink-0 font-medium"
                    >
                      <option value="Tujuan Pembelajaran (TP)">TP</option>
                      <option value="Lingkup Materi">Materi</option>
                    </select>

                    <input
                      type="text"
                      placeholder="Tulis & klik Tambah..."
                      value={inputTextContent}
                      onChange={(e) => setInputTextContent(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          addContentItem();
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 text-xs bg-white transition-all placeholder-slate-400"
                    />

                    <button
                      type="button"
                      onClick={addContentItem}
                      className="px-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-sm active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Added content items list */}
                  {contentList.length === 0 ? (
                    <div className="p-4 border border-dashed border-slate-200 rounded-xl text-center text-[10px] text-slate-400 italic bg-[#f8fafc]/50">
                      Sebutkan minimal 1 silabus materi di atas.
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                      {contentList.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-white border border-slate-200/60 text-[11px] leading-relaxed shadow-2xs hover:border-slate-300 transition-all"
                        >
                          <div>
                            <span className="font-bold text-slate-500 mr-1.5 text-[9px] uppercase tracking-wider bg-slate-100 px-1.5 py-0.5 rounded-md">
                              {item.type === "Lingkup Materi" ? "Materi" : "TP"}
                            </span>
                            <span className="text-slate-700 font-medium">{item.text}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeContentItem(item.id)}
                            className="text-slate-400 hover:text-rose-500 shrink-0 p-0.5 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Target Graduate Profile Multi Choice */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 font-display">
                  6. Dimensi Profil Lulusan
                </label>
                <div className="max-h-36 overflow-y-auto space-y-2 pr-1 border border-slate-200/60 p-3 rounded-2xl bg-[#f8fafc] scrollbar-thin shadow-2xs">
                  {LIST_DIMENSI_PROFIL.map((dim) => (
                    <label key={dim.id} className="flex items-start gap-2 text-[11px] text-slate-600 hover:text-slate-900 font-semibold cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedDimensions.includes(dim.id)}
                        onChange={() => toggleDimension(dim.id)}
                        className="mt-0.5 accent-teal-600 rounded cursor-pointer"
                      />
                      <span>{dim.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dynamic Question Type Row Builder */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-800 font-display">
                    7. Konfigurasi Jenis & Kuantitas Soal
                  </label>
                  <button
                    type="button"
                    onClick={addQuestionTypeRow}
                    className="text-[10px] font-bold text-teal-700 hover:text-teal-850 flex items-center gap-1 cursor-pointer bg-teal-50 hover:bg-teal-100/65 px-2.5 py-1 rounded-lg transition-colors border border-teal-100"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Tambah Baris
                  </button>
                </div>
                
                <div className="space-y-2 border border-slate-200/60 p-3 rounded-2xl bg-[#f8fafc] max-h-44 overflow-y-auto pr-1 scrollbar-thin shadow-2xs">
                  {qTypeRows.map((row, index) => (
                    <div key={row.id} className="flex items-center gap-2.5 bg-white p-2.5 rounded-xl border border-slate-200/50 flex-wrap sm:flex-nowrap shadow-2xs hover:border-slate-300 transition-all">
                      <span className="text-[10px] font-bold text-teal-700 bg-teal-50/70 w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border border-teal-100/50">
                        {index + 1}
                      </span>
                      
                      {/* select type options */}
                      <select
                        value={row.type}
                        onChange={(e) => updateQuestionTypeRow(row.id, "type", e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-slate-200 text-slate-800 text-[11px] bg-white cursor-pointer shrink-0 font-medium focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/5"
                      >
                        <option value="Pilihan Ganda">Pilihan Ganda</option>
                        <option value="Pilihan Ganda Kompleks">Pilihan Ganda Kompleks</option>
                        <option value="Menjodohkan">Menjodohkan</option>
                        <option value="Isian Singkat">Isian Singkat</option>
                        <option value="Uraian">Uraian / Essay</option>
                      </select>

                      {/* total question count input */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold font-display uppercase tracking-wider">Jml:</span>
                        <input
                          type="number"
                          id={`input-count-${row.id}`}
                          min="0"
                          max="99"
                          value={row.count}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              updateQuestionTypeRow(row.id, "count", "");
                            } else {
                              const val = parseInt(raw);
                              if (!isNaN(val)) {
                                updateQuestionTypeRow(row.id, "count", val);
                              }
                            }
                          }}
                          className="w-12 px-1.5 py-1 rounded-lg border border-slate-200 text-slate-800 text-xs bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/5 text-center font-bold"
                        />
                      </div>

                      {/* portion of illustrated count input */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-0.5">
                          <ImageIcon className="w-3 h-3 text-teal-600" />
                          Bergambar:
                        </span>
                        <input
                          type="number"
                          id={`input-ill-${row.id}`}
                          min="0"
                          max={Number(row.count) || 0}
                          value={row.illustratedCount}
                          onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === "") {
                              updateQuestionTypeRow(row.id, "illustratedCount", "");
                            } else {
                              const val = parseInt(raw);
                              if (!isNaN(val)) {
                                const numericCount = parseInt(row.count as string) || 0;
                                const restrictedVal = Math.min(numericCount, Math.max(0, val));
                                updateQuestionTypeRow(row.id, "illustratedCount", restrictedVal);
                              }
                            }
                          }}
                          className="w-12 px-1.5 py-1 rounded-lg border border-slate-200 text-slate-800 text-xs bg-white focus:outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/5 text-center font-bold"
                        />
                      </div>

                      {/* delete row */}
                      <button
                        type="button"
                        onClick={() => removeQuestionTypeRow(row.id)}
                        className="text-slate-400 hover:text-rose-500 p-1.5 ml-auto shrink-0 transition-colors hover:bg-slate-50 rounded-lg"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>


              </div>

              {/* Taxonomy Options */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800 font-display">
                  8. Pilihan Kerangka Evaluasi (Taksonomi)
                </label>
                <div className="grid grid-cols-2 gap-3.5">
                  <label
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs select-none",
                      taksonomi === "SOLO"
                        ? "border-teal-600 bg-teal-50/50 text-teal-900 ring-4 ring-teal-500/5 font-extrabold"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <input
                      type="radio"
                      name="taksonomi_opt"
                      checked={taksonomi === "SOLO"}
                      onChange={() => setTaksonomi("SOLO")}
                      className="hidden"
                    />
                    <span>Taksonomi SOLO</span>
                  </label>

                  <label
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all cursor-pointer font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs select-none",
                      taksonomi === "BLOOM"
                        ? "border-teal-600 bg-teal-50/50 text-teal-900 ring-4 ring-teal-500/5 font-extrabold"
                        : "border-slate-200 bg-white hover:bg-slate-50 text-slate-600"
                    )}
                  >
                    <input
                      type="radio"
                      name="taksonomi_opt"
                      checked={taksonomi === "BLOOM"}
                      onChange={() => setTaksonomi("BLOOM")}
                      className="hidden"
                    />
                    <span>Taksonomi BLOOM</span>
                  </label>
                </div>

                {/* Taxonomy Levels Selectors */}
                <div className="mt-2.5 p-3 rounded-xl border border-slate-200 bg-white shadow-inner space-y-2">
                  <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Tingkatan {taksonomi} yang disasar:
                  </span>
                  
                  {taksonomi === "SOLO" ? (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "Unistruktural", label: "Unistruktural" },
                        { id: "Multistruktural", label: "Multistruktural" },
                        { id: "Relasional", label: "Relasional" },
                        { id: "Abstrak Diperluas", label: "Abstrak Diperluas" }
                      ].map((lvl) => {
                        const checked = soloLevels.includes(lvl.id);
                        return (
                          <label key={lvl.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  setSoloLevels(soloLevels.filter(x => x !== lvl.id));
                                } else {
                                  setSoloLevels([...soloLevels, lvl.id]);
                                }
                              }}
                              className="accent-teal-600 rounded"
                            />
                            <span>{lvl.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: "Mengingat", label: "Mengingat (C1)" },
                        { id: "Memahami", label: "Memahami (C2)" },
                        { id: "Menerapkan", label: "Menerapkan (C3)" },
                        { id: "Menganalisis", label: "Menganalisis (C4)" },
                        { id: "Mengevaluasi", label: "Mengevaluasi (C5)" },
                        { id: "Mencipta", label: "Mencipta (C6)" }
                      ].map((lvl) => {
                        const checked = bloomLevels.includes(lvl.id);
                        return (
                          <label key={lvl.id} className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                if (checked) {
                                  setBloomLevels(bloomLevels.filter(x => x !== lvl.id));
                                } else {
                                  setBloomLevels([...bloomLevels, lvl.id]);
                                }
                              }}
                              className="accent-teal-600 rounded"
                            />
                            <span>{lvl.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Bahasa & Format Tambahan */}
              <div className="border border-slate-200/60 rounded-2xl p-4 bg-[#f8fafc] space-y-3 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 font-display">
                  <Languages className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>9. Kustomisasi Bahasa & Format</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-3 border-t border-slate-200/40">
                  {/* Arabic Toggle */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Opsi Soal Tulisan Arab
                    </label>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={() => setSoalBahasaArab(!soalBahasaArab)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-4 focus:ring-teal-500/5",
                          soalBahasaArab ? "bg-teal-600" : "bg-slate-200"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out",
                            soalBahasaArab ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>
                      <span className="ml-2 text-xs font-semibold text-slate-700">
                        {soalBahasaArab ? "Sertakan Tulisan Arab" : "Bahasa Indonesia Saja"}
                      </span>
                    </div>
                  </div>

                  {/* MCQ Options Count Dropdown */}
                  <div className="space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      Jumlah Opsi Jawaban (Pilihan Ganda)
                    </label>
                    <select
                      value={mcqOptionsCount}
                      onChange={(e) => setMcqOptionsCount(parseInt(e.target.value))}
                      className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 cursor-pointer font-semibold text-slate-800"
                    >
                      <option value={3}>3 Opsi (A, B, C)</option>
                      <option value={4}>4 Opsi (A, B, C, D)</option>
                      <option value={5}>5 Opsi (A, B, C, D, E)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Local Context Accordion Checkbox */}
              <div className="border border-slate-200/60 rounded-2xl p-4 bg-[#f8fafc] shadow-2xs">
                <label className="flex items-center gap-2 font-bold text-xs text-slate-800 cursor-pointer select-none font-display">
                  <input
                    type="checkbox"
                    checked={konteksLokalActive}
                    onChange={(e) => setKonteksLokalActive(e.target.checked)}
                    className="accent-teal-600 rounded cursor-pointer"
                  />
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    <span>Aktifkan Integrasi Konteks Lokal</span>
                  </div>
                </label>

                {konteksLokalActive && (
                  <div className="mt-3.5 space-y-3 pt-3 border-t border-slate-200/40">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Pilih Provinsi (Konteks Wilayah)
                      </label>
                      <select
                        value={provinsi}
                        onChange={(e) => setProvinsi(e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs bg-white cursor-pointer focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 font-semibold"
                      >
                        {LIST_PROVINSI.map((prov) => (
                          <option key={prov} value={prov}>
                            {prov}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Instruksi Kearifan Lokal (Opsional)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Contoh: Sisipkan tarian tradisional, nama lokal Ujang..."
                        value={perintahTambahan}
                        onChange={(e) => setPerintahTambahan(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 text-slate-800 text-xs bg-white focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 resize-y font-medium placeholder-slate-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 mt-4 p-4 border border-teal-100 bg-teal-50/20 rounded-2xl shadow-2xs">
                <div className="flex items-start justify-between">
                  <label className="block text-xs font-bold text-slate-800 font-display">
                    Opsi Kelengkapan Dokumen
                  </label>
                </div>
                <p className="text-[10px] text-amber-800 bg-amber-50/60 border border-amber-200/40 p-2.5 rounded-xl leading-relaxed mb-3 font-medium">
                  Pilih dokumen yang ingin dihasilkan. Semakin sedikit yang dicentang, proses AI akan terasa lebih cepat.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className={cn("flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all shadow-2xs select-none hover:border-slate-300", genOptSoal ? "bg-white border-teal-300 shadow-teal-50" : "bg-white border-slate-200")}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-teal-600 rounded border-slate-300 focus:ring-teal-500 cursor-pointer" 
                      checked={genOptSoal}
                      onChange={(e) => setGenOptSoal(e.target.checked)} 
                    />
                    <span className={cn("text-[11px] font-bold", genOptSoal ? "text-teal-900" : "text-slate-600")}>Lembar Soal</span>
                  </label>
                  <label className={cn("flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all shadow-2xs select-none hover:border-slate-300", genOptKisi ? "bg-white border-purple-300 shadow-purple-50" : "bg-white border-slate-200")}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer" 
                      checked={genOptKisi}
                      onChange={(e) => setGenOptKisi(e.target.checked)} 
                    />
                    <span className={cn("text-[11px] font-bold", genOptKisi ? "text-purple-900" : "text-slate-600")}>Kisi-kisi</span>
                  </label>
                  <label className={cn("flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all shadow-2xs select-none hover:border-slate-300", genOptKunci ? "bg-white border-blue-300 shadow-blue-50" : "bg-white border-slate-200")}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                      checked={genOptKunci}
                      onChange={(e) => setGenOptKunci(e.target.checked)} 
                    />
                    <span className={cn("text-[11px] font-bold", genOptKunci ? "text-blue-900" : "text-slate-600")}>Kunci & Rubrik</span>
                  </label>
                  <label className={cn("flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all shadow-2xs select-none hover:border-slate-300", genOptAnalisis ? "bg-white border-amber-300 shadow-amber-50" : "bg-white border-slate-200")}>
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer" 
                      checked={genOptAnalisis}
                      onChange={(e) => setGenOptAnalisis(e.target.checked)} 
                    />
                    <span className={cn("text-[11px] font-bold", genOptAnalisis ? "text-amber-900" : "text-slate-600")}>Analisis Pedagogis ({taksonomi})</span>
                  </label>
                </div>
              </div>

              {/* Custom API Key & Model Config Trigger */}
              <button
                type="button"
                onClick={() => setShowApiKeySettingsModal(true)}
                className="w-full flex items-center justify-between p-3.5 border border-slate-200/80 rounded-2xl bg-[#f8fafc] hover:bg-slate-50/80 hover:border-slate-300 transition-all font-bold text-xs text-slate-850 cursor-pointer shadow-2xs select-none"
              >
                <div className="flex items-center gap-2">
                  <Key className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Konfigurasi API Key & Model (Mandiri)</span>
                </div>
                <div className="flex items-center gap-1.5 font-sans">
                  {customApiKey ? (
                    <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md font-extrabold tracking-wide border border-emerald-100/50">
                      MANDIRI
                    </span>
                  ) : (
                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold border border-slate-200/50">
                      SERVER
                    </span>
                  )}
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>

              {/* Action Submit */}
              <button
                type="submit"
                disabled={isLoading}
                className={cn(
                  "w-full cursor-pointer py-4 rounded-xl font-display font-bold text-xs tracking-wider uppercase text-white transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 select-none",
                  isLoading
                    ? "bg-slate-400 shadow-none cursor-not-allowed"
                    : "bg-teal-600 hover:bg-teal-700 shadow-teal-100"
                )}
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>Bentar, ngide dulu...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-teal-100" />
                    <span>FORMULASI SOAL SEKARANG</span>
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

        {/* RIGHT PANEL: Worksheet Active View Content */}
        <div className={cn("transition-all duration-300", activeMainMenu === "hasil" ? "w-full block" : "hidden")}>
          
          {isLoading ? (
            <div className="bg-white border border-slate-200 rounded-3xl h-[650px] flex flex-col items-center justify-center p-8 text-center shadow-sm">
              <div className="relative mb-6">
                <div className="w-24 h-24 bg-teal-50 rounded-full flex items-center justify-center animate-ping absolute opacity-45"></div>
                <div className="w-24 h-24 bg-teal-100/75 rounded-full flex items-center justify-center relative">
                  <Sparkles className="w-12 h-12 text-teal-600 animate-pulse" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 font-display">Sirkuit AI Sedang Menilai & Merumus...</h3>
              <p className="text-sm text-slate-500 mt-2.5 max-w-sm">Guru Pintar, mohon tunggu sebentar. Kami sedang menerjemahkan Kompetensi ke kasus/stimulus realistik sesuai kurikulum.</p>
              
              <div className="mt-8 px-4.5 py-3 bg-slate-100 border border-slate-200 rounded-2xl max-w-sm inline-flex items-center gap-2 shadow-inner">
                <div className="w-1.5 h-1.5 bg-teal-600 rounded-full animate-bounce"></div>
                <span className="text-xs text-teal-700 font-mono font-medium animate-pulse">{loadingQuote}</span>
              </div>
            </div>
          ) : activePackage ? (
            
            // Exam Content Panel
            <div className="space-y-6">
              
              {/* Header Action Tools */}
              <div className="no-print bg-white p-4 rounded-2xl border border-slate-200/90 flex flex-wrap items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-600" />
                  <div>
                    <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wide">Lembar Asesmen Aktif:</span>
                    <h4 className="text-xs font-bold text-slate-800 line-clamp-1">{activePackage.title}</h4>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowKopSettings(!showKopSettings)}
                    className={cn(
                      "cursor-pointer flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-bold transition-all shadow-sm",
                      showKopSettings
                        ? "bg-teal-50 border-teal-300 text-teal-850"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    )}
                  >
                    <Settings className="w-4 h-4 text-teal-600 animate-spin-slow" />
                    <span>⚙️ Set Kop & Isian</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-all font-bold text-xs shadow-sm hover:scale-[1.01]"
                  >
                    <Copy className="w-4 h-4 text-teal-600" />
                    <span>Salin Semua</span>
                  </button>
                  <button
                    onClick={() => setShowPrintPreviewModal(true)}
                    className="cursor-pointer flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white transition-all font-bold text-xs shadow-md hover:scale-[1.01]"
                  >
                    <Printer className="w-4 h-4 text-teal-400 animate-pulse" />
                    <span>Cetak Soal (PDF)</span>
                  </button>
                </div>
              </div>

              {/* SETTING KOP & LEMBAR SOAL DRAWER */}
              {showKopSettings && (
                <div className="no-print bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4">
                  <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                    <Settings className="w-4 h-4 text-teal-600" />
                    <h3 className="text-xs font-bold text-slate-900 font-display">Konfigurasi Pengaturan Kop & Isian Ujian Laporan</h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Instansi inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dinas Pembina (Baris 1)</label>
                        <input
                          type="text"
                          value={kopNamaSekolah}
                          onChange={(e) => updateKopNamaSekolah(e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Dinas Pembina (Baris Tambahan 2 - Opsional)</label>
                        <input
                          type="text"
                          value={kopBarisTambahan1}
                          onChange={(e) => updateKopBarisTambahan1(e.target.value)}
                          placeholder="Misal: DINAS PENDIDIKAN DAN KEBUDAYAAN"
                          className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nama Lembaga / Sekolah (Baris Utama)</label>
                        <input
                          type="text"
                          value={kopNamaInstansi}
                          onChange={(e) => updateKopNamaInstansi(e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 focus:outline-none font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Alamat Lengkap & Informasi Kontak</label>
                        <textarea
                          rows={1}
                          value={kopAlamat}
                          onChange={(e) => updateKopAlamat(e.target.value)}
                          className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 focus:outline-none leading-relaxed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Kontak/Link Tambahan (Baris Tambahan - Opsional)</label>
                        <input
                          type="text"
                          value={kopBarisTambahan2}
                          onChange={(e) => updateKopBarisTambahan2(e.target.value)}
                          placeholder="Misal: Telp: (021) 12345 - E-mail: info@school.sch.id"
                          className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Judul Soal Asesmen (Kustom)</label>
                        <input
                          type="text"
                          value={customJudulAsesmen}
                          onChange={(e) => updateCustomJudulAsesmen(e.target.value)}
                          placeholder={activePackage?.title || "Judul Asesmen / Ujian"}
                          className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-slate-50/50 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 focus:outline-none font-bold text-teal-900"
                        />
                      </div>
                    </div>

                    {/* Logos setup */}
                    <div className="space-y-3 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                      {/* Left Logo */}
                      <div className="space-y-1.5 p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600">Aktifkan Logo Kiri</span>
                          <input
                            type="checkbox"
                            checked={kopShowLeftLogo}
                            onChange={(e) => updateKopShowLeftLogo(e.target.checked)}
                            className="accent-teal-650 h-3.5 w-3.5 cursor-pointer"
                          />
                        </div>
                        {kopShowLeftLogo && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="w-10 h-10 border border-slate-200 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center p-0.5">
                              {kopLeftLogo ? (
                                <img src={kopLeftLogo} alt="Logo Kiri" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-[8px] text-slate-400 font-bold block text-center leading-none">Belum Upload</span>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 w-full">
                              <label className="bg-white border border-slate-250 hover:bg-slate-50 text-[10px] font-bold text-slate-700 px-2 py-1 rounded-lg text-center cursor-pointer shadow-sm">
                                Ganti Logo Kiri
                                <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, "left")} className="hidden" />
                              </label>
                              {kopLeftLogo && (
                                <button type="button" onClick={() => resetLogo("left")} className="text-[9px] text-rose-600 font-bold hover:underline text-left">
                                  Hapus Logo
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Right Logo */}
                      <div className="space-y-1.5 p-2.5 bg-slate-50/50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-600">Aktifkan Logo Kanan</span>
                          <input
                            type="checkbox"
                            checked={kopShowRightLogo}
                            onChange={(e) => updateKopShowRightLogo(e.target.checked)}
                            className="accent-teal-650 h-3.5 w-3.5 cursor-pointer"
                          />
                        </div>
                        {kopShowRightLogo && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="w-10 h-10 border border-slate-200 rounded-lg overflow-hidden bg-white shrink-0 flex items-center justify-center p-0.5">
                              {kopRightLogo ? (
                                <img src={kopRightLogo} alt="Logo Kanan" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                              ) : (
                                <span className="text-[8px] text-slate-400 font-bold block text-center leading-none">Belum Upload</span>
                              )}
                            </div>
                            <div className="flex flex-col gap-1 w-full">
                              <label className="bg-white border border-slate-250 hover:bg-slate-50 text-[10px] font-bold text-slate-700 px-2 py-1 rounded-lg text-center cursor-pointer shadow-sm">
                                Ganti Logo Kanan
                                <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e, "right")} className="hidden" />
                              </label>
                              {kopRightLogo && (
                                <button type="button" onClick={() => resetLogo("right")} className="text-[9px] text-rose-600 font-bold hover:underline text-left">
                                  Hapus Logo
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Toggles dynamic isian siswa */}
                    <div className="space-y-2 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                      <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tampilkan Isian Siswa</span>
                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none py-1 hover:bg-slate-50 rounded-lg px-1">
                          <input type="checkbox" checked={fieldNamaShow} onChange={(e) => updateFieldNamaShow(e.target.checked)} className="accent-teal-655 rounded h-3.5 w-3.5 shrink-0" />
                          <span>Nama Siswa</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none py-1 hover:bg-slate-50 rounded-lg px-1">
                          <input type="checkbox" checked={fieldNomorShow} onChange={(e) => updateFieldNomorShow(e.target.checked)} className="accent-teal-655 rounded h-3.5 w-3.5 shrink-0" />
                          <span>Nomor Absen</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none py-1 hover:bg-slate-50 rounded-lg px-1">
                          <input type="checkbox" checked={fieldKelasShow} onChange={(e) => updateFieldKelasShow(e.target.checked)} className="accent-teal-655 rounded h-3.5 w-3.5 shrink-0" />
                          <span>Kelas / Tingkat</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none py-1 hover:bg-slate-50 rounded-lg px-1">
                          <input type="checkbox" checked={fieldMapelShow} onChange={(e) => updateFieldMapelShow(e.target.checked)} className="accent-teal-655 rounded h-3.5 w-3.5 shrink-0" />
                          <span>Mata Pelajaran</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none py-1 hover:bg-slate-50 rounded-lg px-1">
                          <input type="checkbox" checked={fieldHariTanggalShow} onChange={(e) => updateFieldHariTanggalShow(e.target.checked)} className="accent-teal-655 rounded h-3.5 w-3.5 shrink-0" />
                          <span>Hari / Tanggal</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer select-none py-1 hover:bg-slate-50 rounded-lg px-1">
                          <input type="checkbox" checked={fieldNilaiShow} onChange={(e) => updateFieldNilaiShow(e.target.checked)} className="accent-teal-655 rounded h-3.5 w-3.5 shrink-0" />
                          <span>Nilai Akhir</span>
                        </label>
                      </div>
                    </div>

                  </div>
                </div>
              )}

              {/* Tab selector for screening screen view only - MOVED OUTSIDE THE PAPER CONTAINER */}
              <div className="no-print flex items-center border border-slate-200 p-1 bg-slate-50 rounded-2xl shadow-sm">
                {(["lembar", "kisi", "kunci", "analisis"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setActiveTab(tab);
                      setEditingQNumber(null); // Clear editing states on tab switch for safety
                    }}
                    className={cn(
                      "flex-1 py-2.5 text-center text-xs font-bold font-display rounded-xl transition-all capitalize cursor-pointer",
                      activeTab === tab
                        ? "bg-white text-teal-800 shadow-md border border-slate-300/55"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-200/50"
                    )}
                  >
                    {tab === "lembar" && "📑 Soal Pelajar"}
                    {tab === "kisi" && "📋 Kisi-Kisi"}
                    {tab === "kunci" && "🔑 Kunci & Rubrik"}
                    {tab === "analisis" && "📊 Analisis Guru"}
                  </button>
                ))}
              </div>

              {/* EXAM PAPER COMPONENT */}
              <div className={cn(
                "bg-white rounded-3xl border border-slate-200 shadow-sm print-area print:p-0 custom-font-size-target transition-all duration-300",
                marginPdf === "small" && "p-4 sm:p-6 md:p-8",
                marginPdf === "medium" && "p-6 sm:p-10 md:p-12",
                marginPdf === "large" && "p-10 sm:p-14 md:p-16"
              )}>
                
                {/* Official standard header */}
                <div className="exam-header mb-6 relative pb-1">

                  {/* KOP DINAS & SEKOLAH WITH DOUBLE BORDER AS REQUESTED */}
                  <div className="flex items-center justify-between gap-4 border-b-4 border-slate-950 border-double pb-3.5 mb-4">
                    {kopShowLeftLogo && kopLeftLogo && (
                      <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 flex items-center justify-center">
                        <img 
                          src={kopLeftLogo} 
                          alt="Logo Kiri" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    
                    <div className="flex-1 text-center font-serif">
                      <h3 className="text-[11px] md:text-xs font-bold uppercase tracking-wide text-slate-700 leading-tight">
                        {kopNamaSekolah}
                      </h3>
                      {kopBarisTambahan1 && (
                        <h3 className="text-[11px] md:text-xs font-bold uppercase tracking-wide text-slate-700 leading-tight mt-0.5">
                          {kopBarisTambahan1}
                        </h3>
                      )}
                      <h2 className="text-sm md:text-base font-extrabold uppercase tracking-wide text-slate-900 leading-snug mt-1">
                        {kopNamaInstansi}
                      </h2>
                      <p className="text-[8px] md:text-[9px] text-slate-500 italic leading-tight mt-1 font-sans">
                        {kopAlamat}
                      </p>
                      {kopBarisTambahan2 && (
                        <p className="text-[7.5px] md:text-[8px] text-slate-500 italic leading-tight mt-0.5 font-sans">
                          {kopBarisTambahan2}
                        </p>
                      )}
                    </div>

                    {kopShowRightLogo && kopRightLogo && (
                      <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 flex items-center justify-center">
                        <img 
                          src={kopRightLogo} 
                          alt="Logo Kanan" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                  </div>
                  
                  {/* Assessment Title (Sourced from custom input) */}
                  <div className="text-center my-4">
                    <h2 className="text-xs md:text-sm font-black font-display text-slate-950 uppercase tracking-widest leading-snug">
                      {customJudulAsesmen || activePackage.title}
                    </h2>
                  </div>
                  
                  {/* Student credentials blocks - beautifully structured, aligned, and responsive */}
                  {activeTab === "lembar" && (
                    <div className="flex flex-col md:flex-row gap-6 mt-4 text-[11px] text-slate-800 text-left items-start justify-between">
                      {/* Fields area */}
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 w-full">
                        {fieldNamaShow && (
                          <div className="flex items-center gap-2">
                            <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Nama Siswa</span>
                            <span className="font-bold">:</span>
                            <div className="flex-grow h-4 border-b border-dotted border-slate-450 min-w-[120px]" />
                          </div>
                        )}
                        {fieldNomorShow && (
                          <div className="flex items-center gap-2">
                            <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Nomor Absen</span>
                            <span className="font-bold">:</span>
                            <div className="flex-grow h-4 border-b border-dotted border-slate-450 min-w-[120px]" />
                          </div>
                        )}
                        {fieldKelasShow && (
                          <div className="flex items-center gap-2">
                            <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Kelas / Fase</span>
                            <span className="font-bold">:</span>
                            <span className="font-black text-slate-950 underline decoration-dotted">{activePackage.kelas} / {activePackage.fase}</span>
                            <div className="flex-grow h-4 border-b border-dotted border-slate-300 min-w-[20px]" />
                          </div>
                        )}
                        {fieldMapelShow && (
                          <div className="flex items-center gap-2">
                            <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Mata Pelajaran</span>
                            <span className="font-bold">:</span>
                            <span className="font-black text-slate-950 underline decoration-dotted">{activePackage.subject}</span>
                            <div className="flex-grow h-4 border-b border-dotted border-slate-300 min-w-[20px]" />
                          </div>
                        )}
                        {fieldHariTanggalShow && (
                          <div className="flex items-center gap-2">
                            <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Hari / Tanggal</span>
                            <span className="font-bold">:</span>
                            <div className="flex-grow h-4 border-b border-dotted border-slate-450 min-w-[120px]" />
                          </div>
                        )}
                      </div>

                      {/* Score Evaluation Box (NILAI AKHIR) - Neat classical box on printed page */}
                      {fieldNilaiShow && (
                        <div className="w-24 h-16 border-2 border-slate-900 rounded-lg shrink-0 flex flex-col justify-between overflow-hidden text-center bg-white self-center md:self-stretch">
                          <div className="bg-slate-50 border-b-2 border-slate-900 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-700 leading-none">
                            NILAI
                          </div>
                          <div className="flex-1" />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* CURRENT ACTIVE TAB VIEW */}

                {/* 1. LEMBAR SOAL SISWA */}
                {activeTab === "lembar" && (
                  <div className="space-y-6">
                    <div className="bg-emerald-50/45 p-4 rounded-xl border border-emerald-100/50 mb-4 no-print">
                      <p className="text-xs text-emerald-800 leading-relaxed flex items-start gap-2">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                        <span>
                          <strong>Lembar Soal Siswa:</strong> Di bawah adalah formulasi soal ujian murni bertipe kontekstual siap salin/cetak. Soal bergambar memiliki placeholder interaktif di bawahnya. Anda dapat mengklik tombol <strong>Ubah</strong> atau <strong>Hapus</strong> untuk kustomisasi instan.
                        </span>
                      </p>
                    </div>

                    {activePackage.questions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center">Belum ada kompilasi soal.</p>
                    ) : (
                      (() => {
                        const pgQuestions = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda");
                        const pgkQuestions = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda Kompleks");
                        const jodohQuestions = activePackage.questions.filter((q, idx) => q.type === "Menjodohkan");
                        const isianQuestions = activePackage.questions.filter((q, idx) => q.type === "Isian Singkat");
                        const uraianQuestions = activePackage.questions.filter((q, idx) => q.type === "Uraian");

                        const renderQuestionBlock = (q: Question, globalIndexInArray: number) => {
                          const isEditing = editingQNumber === q.number;

                          if (isEditing) {
                            return (
                              <div key={`q-${q.number}-${globalIndexInArray}`} className="pb-6 border-b border-slate-100 last:border-none">
                                {/* INLINE EDIT FORM */}
                                <div className="bg-teal-50/30 border border-teal-200 p-5 rounded-2xl space-y-3.5 no-print">
                                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 flex-wrap gap-2">
                                    <span className="font-bold text-xs text-teal-800 font-display">Mengedit Soal Nomor {q.number}</span>
                                    <select
                                      value={editQType}
                                      onChange={(e) => setEditQType(e.target.value as any)}
                                      className="px-2 py-1 rounded-lg border border-slate-200 text-xs bg-white cursor-pointer focus:border-teal-500 focus:outline-none"
                                    >
                                      <option value="Pilihan Ganda">Pilihan Ganda</option>
                                      <option value="Pilihan Ganda Kompleks">Pilihan Ganda Kompleks</option>
                                      <option value="Menjodohkan">Menjodohkan</option>
                                      <option value="Isian Singkat">Isian Singkat</option>
                                      <option value="Uraian">Uraian / Essay</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-[10px] font-bold text-slate-500 mb-1">Kasus Stimulus & Pertanyaan:</label>
                                    <textarea
                                      value={editQText}
                                      onChange={(e) => setEditQText(e.target.value)}
                                      rows={4}
                                      className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                                    />
                                  </div>

                                  {(editQType === "Pilihan Ganda" || editQType === "Pilihan Ganda Kompleks") && (
                                    <div className="space-y-2 pl-3.5 border-l-2 border-teal-200">
                                      <label className="block text-[10px] font-bold text-slate-500">Opsi Jawaban:</label>
                                      {editQOptions.map((opt, oIdx) => (
                                        <div key={oIdx} className="flex items-center gap-2">
                                          <span className="text-xs font-mono font-bold text-slate-400 w-5">{"ABCD"[oIdx]}.</span>
                                          <input
                                            type="text"
                                            value={opt.substring(3)}
                                            onChange={(e) => {
                                              const updated = [...editQOptions];
                                              updated[oIdx] = `${"ABCD"[oIdx]}. ${e.target.value}`;
                                              setEditQOptions(updated);
                                            }}
                                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                                            placeholder={`Opsi ${"ABCD"[oIdx]}`}
                                          />
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Kunci Jawaban Ideal:</label>
                                      <textarea
                                        value={editQAnswer}
                                        onChange={(e) => setEditQAnswer(e.target.value)}
                                        rows={3}
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Kriteria Rubrik Asesmen:</label>
                                      <textarea
                                        value={editQRubrik}
                                        onChange={(e) => setEditQRubrik(e.target.value)}
                                        rows={3}
                                        className="w-full text-xs p-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Taksonomi Level:</label>
                                      <input
                                        type="text"
                                        value={editQTaxonomyLevel}
                                        onChange={(e) => setEditQTaxonomyLevel(e.target.value)}
                                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Dimensi Profil Lulusan:</label>
                                      <input
                                        type="text"
                                        value={editQDimension}
                                        onChange={(e) => setEditQDimension(e.target.value)}
                                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Analisis:</label>
                                      <input
                                        type="text"
                                        value={editQPrinsip}
                                        onChange={(e) => setEditQPrinsip(e.target.value)}
                                        className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                                      />
                                    </div>
                                  </div>

                                  <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center gap-3.5 flex-wrap sm:flex-nowrap">
                                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-700 select-none shrink-0">
                                      <input
                                        type="checkbox"
                                        checked={editQHasIllustration}
                                        onChange={(e) => setEditQHasIllustration(e.target.checked)}
                                        className="accent-teal-600 rounded"
                                      />
                                      <span>Sediakan Ilustrasi Bergambar</span>
                                    </label>

                                    {editQHasIllustration && (
                                      <div className="flex-1 min-w-[200px]">
                                        <input
                                          type="text"
                                          value={editQIllustrationPrompt}
                                          onChange={(e) => setEditQIllustrationPrompt(e.target.value)}
                                          placeholder="Deskripsi lukis kartun edukasi flat..."
                                          className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-teal-500"
                                        />
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => setEditingQNumber(null)}
                                      className="px-3.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs cursor-pointer"
                                    >
                                      Batal
                                    </button>
                                    <button
                                      type="button"
                                      onClick={handleSaveEditQuestion}
                                      className="px-4 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-sm cursor-pointer"
                                    >
                                      Simpan Perubahan
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={`q-${q.number}-${globalIndexInArray}`} className="pb-6 border-b border-slate-100 last:border-none group relative">
                              
                              {/* ACTION TOOLBAR BAR */}
                              <div className="no-print absolute top-0 right-0 z-10 opacity-70 group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-2 border bg-slate-50 border-slate-200 rounded-xl px-2.5 py-1 text-xs shadow-sm">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest font-mono">NOMOR JALUR:</span>
                                  <select
                                    value={q.number}
                                    onChange={(e) => handleChangeQuestionNumber(q.number, Number(e.target.value))}
                                    className="bg-white border border-slate-205 text-[10px] font-bold px-1.5 py-0.5 rounded cursor-pointer text-slate-750 focus:outline-none"
                                  >
                                    {Array.from({ length: activePackage.questions.length }, (_, i) => i + 1).map((num) => (
                                      <option key={num} value={num}>{num}</option>
                                    ))}
                                  </select>
                                  
                                  <div className="h-4 w-[1px] bg-slate-200" />
                                  
                                  <button
                                    disabled={globalIndexInArray === 0}
                                    onClick={() => handleChangeQuestionNumber(q.number, q.number - 1)}
                                    className="p-0.5 text-slate-400 hover:text-teal-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                                    title="Pindahkan naik satu nomor"
                                  >
                                    <ChevronUp className="w-4 h-4" />
                                  </button>
                                  <button
                                    disabled={globalIndexInArray === activePackage.questions.length - 1}
                                    onClick={() => handleChangeQuestionNumber(q.number, q.number + 1)}
                                    className="p-0.5 text-slate-400 hover:text-teal-600 disabled:opacity-30 disabled:hover:text-slate-400 transition-colors cursor-pointer"
                                    title="Pindahkan turun satu nomor"
                                  >
                                    <ChevronDown className="w-4 h-4" />
                                  </button>

                                  <div className="h-4 w-[1px] bg-slate-200" />

                                  <button
                                    onClick={() => startEditingQuestion(q)}
                                    className="text-teal-650 hover:text-teal-700 font-bold text-[10px] flex items-center gap-0.5 font-display px-1.5 py-0.5 rounded hover:bg-slate-200/50 cursor-pointer"
                                    title="Ubah Rincian Soal"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    <span>Ubah</span>
                                  </button>
                                  
                                  <button
                                    onClick={() => handleDeleteQuestion(q.number)}
                                    className="text-rose-500 hover:text-rose-600 font-bold text-[10px] flex items-center gap-0.5 font-display px-1.5 py-0.5 rounded hover:bg-slate-200/50 cursor-pointer"
                                    title="Hapus Soal"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Hapus</span>
                                  </button>
                                </div>
                              </div>

                              {/* RENDER NORMAL VIEW COMPONENT */}
                              <div className="flex items-start gap-3.5 pt-4">
                                <span className="w-6 h-6 bg-slate-900 text-white rounded-lg flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                                  {q.number}
                                </span>
                                
                                <div className="space-y-4 flex-1">
                                                     {/* ILLUSTRATIONS EMBED, GENERATOR, CUSTOM UPLOADER & EDIT PROMPT BOX */}
                                  {q.hasIllustration && (
                                    <div className="no-print my-3 space-y-2.5">
                                      {/* Image Viewport container */}
                                      {q.renderedSvg ? (
                                        <div className="w-full max-w-sm aspect-[4/3] rounded-2xl overflow-hidden bg-slate-50 border border-slate-200/80 p-4 shadow-inner flex items-center justify-center mx-auto" dangerouslySetInnerHTML={{ __html: q.renderedSvg }} />
                                      ) : (
                                        <div className="w-full max-w-sm border border-dashed border-slate-250 bg-slate-50/50 p-6 rounded-2xl text-center mx-auto space-y-2">
                                          <div className="w-10 h-10 bg-slate-100/80 rounded-full flex items-center justify-center mx-auto">
                                            <ImageIcon className="w-5 h-5 text-slate-550" />
                                          </div>
                                          <span className="text-[11px] font-bold text-slate-700 block">Belum ada ilustrasi</span>
                                          <p className="text-[10px] text-slate-500 max-w-[250px] mx-auto leading-normal">
                                            Visualisasikan dengan AI free-tier di bawah atau langsung unggah gambar Anda sendiri.
                                          </p>
                                        </div>
                                      )}

                                      {/* Illustration controls panel */}
                                      <div className="w-full max-w-sm bg-slate-50/80 border border-slate-200/60 p-3 rounded-xl mx-auto space-y-2 text-left shadow-xs">
                                        <div className="space-y-1">
                                          <div className="flex justify-between items-center px-0.5">
                                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-500">
                                              Deskripsi / Prompt Gambar
                                            </span>
                                            {q.renderedSvg && (
                                              <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded-md">
                                                ✓ Gambar Tersedia
                                              </span>
                                            )}
                                          </div>
                                          <textarea
                                            className="w-full text-xs font-sans text-slate-700 bg-white border border-slate-200/80 rounded-lg p-2 focus:ring-1 focus:ring-teal-500 focus:outline-none leading-relaxed transition-all resize-none"
                                            rows={2}
                                            placeholder="Deskripsikan gambar di sini..."
                                            value={q.illustrationPrompt || ""}
                                            onChange={(e) => updateQuestionIllustrationPrompt(q.number, e.target.value)}
                                          />
                                        </div>

                                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                                          {/* Generate Image via AI */}
                                          <button
                                            type="button"
                                            disabled={visualizingNum !== null}
                                            onClick={() => triggerIllustrationSvg(q.number, q.illustrationPrompt)}
                                            className="inline-flex items-center gap-1 bg-teal-600 hover:bg-teal-700 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            <RefreshCw className={cn("w-3 h-3 shrink-0", visualizingNum === q.number && "animate-spin")} />
                                            <span>{visualizingNum === q.number ? "Memproses..." : q.renderedSvg ? "Gambar Ulang" : "Visualisasi AI"}</span>
                                          </button>

                                          {/* Copy prompt button */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(q.illustrationPrompt || "");
                                              showToast("Prompt gambar disalin!");
                                            }}
                                            title="Salin deskripsi prompt gambar"
                                            className="inline-flex items-center gap-1 bg-white hover:bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-1.5 rounded-lg transition-all border border-slate-200 cursor-pointer"
                                          >
                                            <Copy className="w-3 h-3" />
                                            <span>Salin</span>
                                          </button>

                                          {/* Custom image upload button */}
                                          <label className="inline-flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all border border-indigo-200 cursor-pointer shadow-xs">
                                            <Upload className="w-3 h-3" />
                                            <span>Unggah</span>
                                            <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={(e) => handleCustomImageUpload(q.number, e)}
                                            />
                                          </label>

                                          {/* Clear image button */}
                                          {q.renderedSvg && (
                                            <button
                                              type="button"
                                              onClick={() => updateQuestionRenderedSvg(q.number, undefined)}
                                              className="inline-flex items-center justify-center p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[10px] rounded-lg transition-all border border-rose-200 cursor-pointer ml-auto"
                                              title="Hapus gambar saat ini"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* Printable illustration block wrapper */}
                                  {q.hasIllustration && q.renderedSvg && (
                                    <div className="hidden print:block my-3 mx-auto custom-image-size text-center" dangerouslySetInnerHTML={{ __html: q.renderedSvg }} />
                                  )}

                                  {(() => {
                                    if (q.type === "Menjodohkan") {
                                      const menjodohkanData = parseMenjodohkan(q.text || "");
                                      if (menjodohkanData.premis.length > 0 && menjodohkanData.responses.length > 0) {
                                        const maxRows = Math.max(menjodohkanData.premis.length, menjodohkanData.responses.length);
                                        const rows = Array.from({ length: maxRows });
                                        return (
                                          <div className="space-y-4">
                                            <QuestionTextRenderer text={menjodohkanData.introduction || ""} tableSize={tableSize} />
                                            <div className="overflow-x-auto border-2 border-slate-950 rounded-xl bg-white shadow-sm my-3 max-w-full">
                                              <table className="w-full border-collapse text-left text-xs table-fixed">
                                                <thead>
                                                  <tr className="bg-slate-50 border-b-2 border-slate-950 text-slate-800 font-bold font-display text-[11px] tracking-wide">
                                                    <th className="p-3 w-1/2 border-r-2 border-slate-950">
                                                      <span>{menjodohkanData.responsesHeader}</span>
                                                    </th>
                                                    <th className="p-3 w-1/2">
                                                      <span>{menjodohkanData.premisHeader}</span>
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-350 text-slate-800 font-sans">
                                                  {rows.map((_, i) => {
                                                    const resp = menjodohkanData.responses[i];
                                                    const prem = menjodohkanData.premis[i];
                                                    return (
                                                      <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                                        {/* Left Column (Jawaban) */}
                                                        <td className="p-3 border-r-2 border-slate-950 align-middle">
                                                          {resp ? (
                                                            <div className="flex items-center justify-between gap-2.5">
                                                              <div className="flex items-center gap-2 min-w-0">
                                                                <span className="w-5 h-5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/50 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono shadow-3xs">
                                                                  {resp.key}
                                                                </span>
                                                                <span className="text-xs text-slate-800 font-semibold leading-relaxed break-words">{resp.text}</span>
                                                              </div>
                                                              {/* Connector Dot */}
                                                              <div className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-600 shrink-0" title="Hubungkan ke kanan" />
                                                            </div>
                                                          ) : <div className="h-5" />}
                                                        </td>

                                                        {/* Right Column (Premis) */}
                                                        <td className="p-3 align-middle">
                                                          {prem ? (
                                                            <div className="flex items-center justify-between gap-2.5 flex-row-reverse">
                                                              <div className="flex items-center gap-2 flex-row-reverse justify-end min-w-0 flex-grow">
                                                                <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono shadow-3xs">
                                                                  {prem.key}
                                                                </span>
                                                                <span className="text-xs text-slate-800 font-bold leading-relaxed break-words text-right flex-grow">{prem.text}</span>
                                                              </div>
                                                              {/* Connector Dot */}
                                                              <div className="w-2.5 h-2.5 rounded-full bg-slate-400 border border-slate-600 shrink-0" title="Tarik garis dari sini" />
                                                            </div>
                                                          ) : <div className="h-5" />}
                                                        </td>
                                                      </tr>
                                                    );
                                                  })}
                                                </tbody>
                                              </table>
                                            </div>
                                          </div>
                                        );
                                      }
                                    }
                                    return <QuestionTextRenderer text={q.text || ""} tableSize={tableSize} />;
                                  })()}

                                  {/* MCQ options items */}
                                  {q.options && q.options.length > 0 && (
                                    <div className={cn(
                                      layoutMcq === "vertical" && "grid grid-cols-1 gap-2 pl-1",
                                      layoutMcq === "grid-2" && "grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-1",
                                      layoutMcq === "horizontal" && "flex flex-wrap gap-x-6 gap-y-1.5 pl-1"
                                    )}>
                                      {q.options.map((opt, optIdx) => (
                                        <div
                                          key={`opt-${optIdx}`}
                                          className={cn(
                                            "rounded-xl font-medium flex items-center gap-2 animate-fade-in transition-all",
                                            layoutMcq === "horizontal" 
                                              ? "p-1.5 px-2 bg-transparent border-none text-slate-850" 
                                              : "p-2.5 border border-slate-100 bg-slate-50/40 text-slate-700"
                                          )}
                                        >
                                          <div className="w-5 h-5 rounded-full border border-slate-350 flex items-center justify-center shrink-0 font-bold text-[10px] text-slate-500 bg-white shadow-xs print:border-black print:text-black">
                                            {opt[0]}
                                          </div>
                                          <span className="print:text-black">{opt.substring(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}

                                  {/* Tiny metadata tag helpful for review */}
                                  <div className="no-print pt-1 flex flex-wrap gap-2 text-[9px] font-mono text-slate-400 select-none">
                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">Jenis: {q.type}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Taksonomi: {q.taxonomyLevel}</span>
                                    <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">Dimensi: {q.profilLulusanDimensi}</span>
                                  </div>

                                </div>
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-10">
                            {pgQuestions.length > 0 && (
                              <div className="space-y-4 pt-1">
                                <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider">
                                  I. PILIHAN GANDA (Pilihlah salah satu jawaban yang paling tepat)
                                </div>
                                <div className="space-y-6">
                                  {pgQuestions.map((q, idx) => {
                                    const globalIdx = activePackage.questions.findIndex((oq) => oq.number === q.number);
                                    return renderQuestionBlock(q, globalIdx);
                                  })}
                                </div>
                              </div>
                            )}

                            {pgkQuestions.length > 0 && (
                              <div className="space-y-4 pt-4">
                                <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider">
                                  II. PILIHAN GANDA KOMPLEKS (Pilihlah satu atau lebih jawaban yang tepat)
                                </div>
                                <div className="space-y-6">
                                  {pgkQuestions.map((q, idx) => {
                                    const globalIdx = activePackage.questions.findIndex((oq) => oq.number === q.number);
                                    return renderQuestionBlock(q, globalIdx);
                                  })}
                                </div>
                              </div>
                            )}

                            {jodohQuestions.length > 0 && (
                              <div className="space-y-4 pt-4">
                                <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider">
                                  III. MENJODOHKAN (Pasangkanlah premis di kiri dengan pilihan di kanan yang sesuai)
                                </div>
                                <div className="space-y-6">
                                  {jodohQuestions.map((q, idx) => {
                                    const globalIdx = activePackage.questions.findIndex((oq) => oq.number === q.number);
                                    return renderQuestionBlock(q, globalIdx);
                                  })}
                                </div>
                              </div>
                            )}

                            {isianQuestions.length > 0 && (
                              <div className="space-y-4 pt-4">
                                <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider">
                                  IV. ISIAN SINGKAT (Isilah dengan jawaban yang singkat, padat, dan benar)
                                </div>
                                <div className="space-y-6">
                                  {isianQuestions.map((q, idx) => {
                                    const globalIdx = activePackage.questions.findIndex((oq) => oq.number === q.number);
                                    return renderQuestionBlock(q, globalIdx);
                                  })}
                                </div>
                              </div>
                            )}

                            {uraianQuestions.length > 0 && (
                              <div className="space-y-4 pt-4">
                                <div className="bg-slate-900 text-white rounded-lg px-3.5 py-2 font-display text-xs font-bold uppercase tracking-wider">
                                  V. URAIAN / ESSAY (Uraikan analisis mendalam Anda dengan jelas)
                                </div>
                                <div className="space-y-6">
                                  {uraianQuestions.map((q, idx) => {
                                    const globalIdx = activePackage.questions.findIndex((oq) => oq.number === q.number);
                                    return renderQuestionBlock(q, globalIdx);
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* 1.5. KISI-KISI ASESMEN */}
                {activeTab === "kisi" && (
                  <div className="space-y-6">
                    <div className="bg-teal-50/45 p-4 rounded-xl border border-teal-100/50 mb-4 no-print">
                      <p className="text-xs text-teal-800 leading-relaxed flex items-start gap-2">
                        <FileSpreadsheet className="w-4 h-4 shrink-0 text-teal-600 mt-0.5" />
                        <span>
                          <strong>Kisi-Kisi Asesmen Sekolah:</strong> Tabel di bawah memetakan parameter kualitatif soal terhadap taksonomi kognitif dan pembentukan dimensi profil lulusan. Memudahkan verifikasi tim kurikulum sekolah.
                        </span>
                      </p>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-2xl shadow-sm bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                            <th className="p-3 text-center w-12 border-r border-slate-205">No. Soal</th>
                            <th className="p-3 w-28 border-r border-slate-205">Bentuk Soal</th>
                            <th className="p-3 w-36 border-r border-slate-205">Materi Pokok</th>
                            <th className="p-3 border-r border-slate-205">Indikator Kisi-Kisi & Stimulus Asesmen</th>
                            <th className="p-3 w-36 border-r border-slate-205">Level Taksonomi ({taksonomi})</th>
                            <th className="p-3 w-36 border-r border-slate-205">Dimensi Profil Lulusan</th>
                            <th className="p-3 text-center w-16">Bobot Skor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100/80 text-slate-700">
                          {activePackage.questions.map((q, idx) => {
                            let bobot = "1";
                            if (q.type === "Pilihan Ganda Kompleks") bobot = "2";
                            else if (q.type === "Menjodohkan") bobot = "3";
                            else if (q.type === "Isian Singkat") bobot = "2";
                            else if (q.type === "Uraian") bobot = "5";

                            return (
                              <tr key={`kisi-${q.number}`} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-3 text-center font-bold text-slate-900 border-r border-slate-150">{q.number}</td>
                                <td className="p-3 border-r border-slate-150">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[10px] font-bold border block text-center",
                                    q.type === "Pilihan Ganda" ? "bg-amber-50 text-amber-700 border-amber-200/60" :
                                    q.type === "Pilihan Ganda Kompleks" ? "bg-orange-50 text-orange-700 border-orange-200/60" :
                                    q.type === "Menjodohkan" ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" :
                                    q.type === "Isian Singkat" ? "bg-blue-50 text-blue-700 border-blue-200/60" :
                                    "bg-rose-50 text-rose-700 border-rose-200/60"
                                  )}>
                                    {q.type}
                                  </span>
                                </td>
                                <td className="p-3 border-r border-slate-150 font-medium font-sans text-[10.5px] leading-relaxed text-slate-800 break-words">
                                  {q.materiTopik || activePackage.subject || "Materi Kurikulum"}
                                </td>
                                <td className="p-3 border-r border-slate-150 leading-relaxed font-sans text-slate-700 break-words">
                                  <div className="space-y-1.5">
                                    <div>
                                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">Indikator Soal:</span>
                                      <p className="text-[10.5px] leading-relaxed text-slate-800 font-medium bg-slate-50/50 p-1.5 rounded-md border border-slate-100">
                                        {q.indikatorSoal || `Disajikan stimulus kontekstual, peserta didik dapat menyelesaikan persoalan berkaitan dengan tema ${activePackage.subject || "pembelajaran"} pada tingkatan kognitif ${q.taxonomyLevel || "terkait"} secara mandiri dengan tepat.`}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">Stimulus Asesmen:</span>
                                      <p className="text-[10px] leading-relaxed text-slate-500 font-mono italic">
                                        {q.stimulusAsesmen || "Kasus atau skenario kontekstual terintegrasi."}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 border-r border-slate-150 font-medium font-sans text-[10px] break-words">
                                  <span className="text-slate-800 font-bold block">{q.taxonomyLevel}</span>
                                  <span className="text-[9.5px] text-slate-400 block leading-tight">{q.taxonomyAnalysis}</span>
                                </td>
                                <td className="p-3 border-r border-slate-150 font-semibold font-sans text-teal-700 text-[10.5px]">
                                  {q.profilLulusanDimensi}
                                </td>
                                <td className="p-3 text-center font-bold text-slate-900 font-mono text-[10.5px]">
                                  {bobot}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Matrix guidelines */}
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-[11px] text-slate-500 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-bold text-slate-700 mb-1">Rekomendasi Skema Penilaian:</h4>
                        <ul className="list-disc pl-4 space-y-1">
                          <li>Pilihan Ganda (PG) memiliki bobot 1 per jawaban benar (Tanpa penalti).</li>
                          <li>Isian singkat memiliki bobot 2 per jawaban benar.</li>
                          <li>Uraian / Essay memiliki skor rubrik bergradasi (rentang 0 s.d 5) berdasarkan kelengkapan jawaban esensial.</li>
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-700 mb-1">Integrasi Standar Pendidikan Nasional:</h4>
                        <p>Matriks kisi-kisi ini dirancang secara koheren dengan tujuan pembelajaran yang terdaftar, memastikan keselarasan penuh (alignment) antara asesmen kognitif dengan penguatan dimensi profil lulusan secara autentik.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. KUNCI JAWABAN & RUBRIK ASESMEN */}
                {activeTab === "kunci" && (
                  <div className="space-y-6">
                    <div className="bg-indigo-50/45 p-4 rounded-xl border border-indigo-100/50 mb-4 no-print">
                      <p className="text-xs text-indigo-800 leading-relaxed flex items-start gap-2">
                        <Bookmark className="w-4 h-4 shrink-0 text-indigo-600 mt-0.5" />
                        <span>
                          <strong>Pedoman Penilaian:</strong> Kunci penyelesaian ini disusun mendalam beserta rubrik kualitatif, memudahkan guru memberikan skor bervariasi sesuai kemandirian belajar murid nasional.
                        </span>
                      </p>
                    </div>

                    {(() => {
                      const pgQuestions = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda");
                      const pgkQuestions = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda Kompleks");
                      const jodohQuestions = activePackage.questions.filter((q, idx) => q.type === "Menjodohkan");
                      const isianQuestions = activePackage.questions.filter((q, idx) => q.type === "Isian Singkat");
                      const uraianQuestions = activePackage.questions.filter((q, idx) => q.type === "Uraian");

                      const renderKeyBlock = (q: Question) => {
                        const isPgStyle = q.type === "Pilihan Ganda" || q.type === "Pilihan Ganda Kompleks" || q.type === "Menjodohkan";
                        return (
                          <div key={`keyblock-${q.number}`} className="p-3 rounded-xl border border-slate-200 bg-white space-y-2 text-[11px] leading-relaxed break-inside-avoid">
                            <div className="flex items-center justify-between border-b border-slate-150 pb-1 flex-wrap gap-1">
                              <span className="font-bold text-[11.5px] text-slate-900">
                                No. {q.number} ({q.type})
                              </span>
                              <span className="text-[9.5px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-150">
                                Taksonomi: {q.taxonomyLevel}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                              <div className="md:col-span-5 space-y-1">
                                <h5 className="font-bold text-slate-450 uppercase tracking-wider text-[8.5px]">
                                  {isPgStyle ? "Kunci Jawaban Abjad & Opsi:" : "Model Kunci Jawaban / Solusi Ideal:"}
                                </h5>
                                <p className="text-slate-800 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 font-mono whitespace-pre-line text-[10.5px]">
                                  {q.correctAnswer}
                                </p>
                              </div>
                              <div className="md:col-span-7 space-y-1">
                                <h5 className="font-bold text-teal-700 uppercase tracking-wider text-[8.5px]">
                                  {isPgStyle ? "Penjelasan & Pembahasan Kunci Jawaban:" : "Pedoman Penskoran & Rubrik Asesmen:"}
                                </h5>
                                <p className="text-slate-800 bg-teal-50/10 p-2.5 rounded-lg border border-teal-100/30 whitespace-pre-line text-[10.5px]">
                                  {q.rubrikAsesmen}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      };

                      return (
                        <div className="space-y-6">
                          {pgQuestions.length > 0 && (
                            <div className="space-y-2.5">
                              <h3 className="text-[10.5px] font-bold text-slate-500 border-b pb-1 uppercase tracking-wider font-display">Bagian I. Pilihan Ganda</h3>
                              <div className="space-y-2.5">{pgQuestions.map(renderKeyBlock)}</div>
                            </div>
                          )}
                          {pgkQuestions.length > 0 && (
                            <div className="space-y-2.5">
                              <h3 className="text-[10.5px] font-bold text-slate-500 border-b pb-1 uppercase tracking-wider font-display">Bagian II. Pilihan Ganda Kompleks</h3>
                              <div className="space-y-2.5">{pgkQuestions.map(renderKeyBlock)}</div>
                            </div>
                          )}
                          {jodohQuestions.length > 0 && (
                            <div className="space-y-2.5">
                              <h3 className="text-[10.5px] font-bold text-slate-500 border-b pb-1 uppercase tracking-wider font-display">Bagian III. Menjodohkan</h3>
                              <div className="space-y-2.5">{jodohQuestions.map(renderKeyBlock)}</div>
                            </div>
                          )}
                          {isianQuestions.length > 0 && (
                            <div className="space-y-2.5">
                              <h3 className="text-[10.5px] font-bold text-slate-500 border-b pb-1 uppercase tracking-wider font-display">Bagian IV. Isian Singkat</h3>
                              <div className="space-y-2.5">{isianQuestions.map(renderKeyBlock)}</div>
                            </div>
                          )}
                          {uraianQuestions.length > 0 && (
                            <div className="space-y-2.5">
                              <h3 className="text-[10.5px] font-bold text-slate-500 border-b pb-1 uppercase tracking-wider font-display">Bagian V. Uraian</h3>
                              <div className="space-y-2.5">{uraianQuestions.map(renderKeyBlock)}</div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 3. ANALISIS KURIKULUM DEEP LEARNING */}
                {activeTab === "analisis" && (
                  <div className="space-y-4">
                    <div className="no-print bg-slate-50 p-4 rounded-xl border border-slate-200 mb-2">
                      <p className="text-xs text-slate-700 leading-relaxed flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 text-teal-600 mt-0.5" />
                        <span>
                          <strong>Analisis Pedagogis:</strong> Transparansi modul kurikulum. Menjabarkan rasionalitas level serta prinsip-prinsip belajar yang dipertahankan.
                        </span>
                      </p>
                    </div>

                    <TaxonomyChart
                      questions={activePackage.questions}
                      taksonomi={taksonomi}
                      soloLevels={soloLevels}
                      bloomLevels={bloomLevels}
                    />

                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs">
                      <table className="w-full text-left border-collapse text-[11px] leading-relaxed break-inside-avoid">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-600 no-print">
                            <th className="p-2.5 w-12 text-center border-r border-slate-200">No</th>
                            <th className="p-2.5 w-1/2 border-r border-slate-200">Level Taksonomi ({taksonomi}) & Analisis Pedagogis</th>
                            <th className="p-2.5 w-1/2">Dimensi Profil Lulusan</th>
                          </tr>
                          <tr className="hidden print:table-row bg-slate-100 border-b border-slate-300 text-[9px] font-bold uppercase tracking-wider text-black">
                            <th className="p-2 w-12 text-center border-r border-black">No</th>
                            <th className="p-2 w-1/2 border-r border-black">Level Taksonomi ({taksonomi}) & Analisis Pedagogis</th>
                            <th className="p-2 w-1/2">Dimensi Profil Lulusan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activePackage.questions.map((q, idx) => (
                            <tr key={`analisis-${q.number}`} className={cn(
                              "border-b border-slate-150 last:border-b-0 break-inside-avoid",
                              idx % 2 === 0 ? "bg-white" : "bg-slate-50/20"
                            )}>
                              <td className="p-2.5 text-center font-bold text-slate-800 border-r border-slate-200 bg-slate-50/10 font-mono text-[10px]">
                                {q.number}
                              </td>
                              <td className="p-2.5 border-r border-slate-200 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[9px] border border-slate-200 uppercase">
                                    {q.taxonomyLevel}
                                  </span>
                                </div>
                                <p className="text-slate-600 text-[10.5px] leading-relaxed">{q.taxonomyAnalysis}</p>
                              </td>
                              <td className="p-2.5 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded text-[9px] border border-teal-100/30">
                                    {q.profilLulusanDimensi}
                                  </span>
                                </div>
                                <p className="text-slate-600 text-[10.5px] leading-relaxed">{q.prinsipPM}</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>

            </div>
          ) : (
            
            // Fallback initial greeting
            <div className="bg-white border border-slate-200 rounded-3xl h-[650px] flex flex-col items-center justify-center p-8 text-center shadow-sm">
              <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center mb-4 text-teal-600 shadow-inner">
                <GraduationCap className="w-8 h-8 stroke-[2]" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 font-display font-medium bg-gradient-to-r from-teal-700 to-indigo-600 bg-clip-text text-transparent">Belum Ada Soal Terpilih</h3>
              <p className="text-xs text-slate-500 mt-2 max-w-sm leading-relaxed">
                Anda belum memformulasikan soal atau memilih paket dari riwayat. Silakan rancang soal baru terlebih dahulu.
              </p>
              <div className="mt-6 p-4.5 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50 max-w-sm">
                <span className="text-xs text-slate-700 block font-bold mb-2 text-left">Cara Memulai Quick Win:</span>
                <ul className="text-left text-[11px] text-slate-600 space-y-1.5 list-disc pl-4 leading-normal">
                  <li>Atur tema & indikator di tab <strong>Konfigurasi Soal</strong></li>
                  <li>Atur cakupan materi / ketik Tujuan Pembelajaran yang disasar</li>
                  <li>Klik tombol formulasi untuk meramu asesmen di Tab <strong>Hasil Formulasi</strong></li>
                </ul>
              </div>
              <button
                onClick={() => setActiveMainMenu("konfigurasi")}
                className="mt-6 px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-teal-100 cursor-pointer flex items-center gap-1.5 active:scale-[0.98]"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Atur Parameter & Buat Soal</span>
              </button>
            </div>
          )}

        </div>

        {/* VIEW 3: RIWAYAT SOAL */}
        <div className={cn("no-print w-full transition-all duration-300", activeMainMenu === "riwayat" ? "block animate-fade-in" : "hidden")}>
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-100 pb-5">
              <div>
                <h3 className="text-lg font-bold text-slate-900 font-display flex items-center gap-2">
                  <History className="w-5 h-5 text-teal-600" />
                  Riwayat Paket Soal Tersimpan
                </h3>
                <p className="text-xs text-slate-500 mt-1">Daftar seluruh paket asesmen yang berhasil dibuat dan tersimpan aman di browser Anda.</p>
              </div>
              <div className="bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-200/50 text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                <span>Total Stored:</span>
                <span className="bg-teal-600 text-white px-2 py-0.5 rounded-full text-[10px] font-mono">{historyPackages.length}</span>
              </div>
            </div>

            {historyPackages.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-3xl max-w-xl mx-auto">
                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-150">
                  <History className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-sm font-bold text-slate-800">Belum Ada Paket Soal Tersimpan</p>
                <p className="text-xs text-slate-500 mt-1 mb-6 max-w-xs mx-auto leading-relaxed">
                  Semua kuis, latihan, atau lembar kerja ujian yang Anda formulasikan otomatis tersimpan di sini.
                </p>
                <button
                  onClick={() => setActiveMainMenu("konfigurasi")}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-150 cursor-pointer flex items-center gap-1.5 mx-auto"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Buat Paket Soal Pertamamu</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {historyPackages.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={() => {
                      setActivePackage(pkg);
                      if (pkg.taksonomi) {
                        setTaksonomi(pkg.taksonomi);
                      } else {
                        const levelStr = pkg.questions.map(q => q.taxonomyLevel || "").join(" ").toUpperCase();
                        if (levelStr.includes("C1") || levelStr.includes("C2") || levelStr.includes("MENGINGAT") || levelStr.includes("MEMAHAMI")) {
                          setTaksonomi("BLOOM");
                        } else if (levelStr.includes("UNISTRUKTURAL") || levelStr.includes("MULTISTRUKTURAL") || levelStr.includes("RELASIONAL")) {
                          setTaksonomi("SOLO");
                        }
                      }
                      setActiveTab("lembar");
                      setActiveMainMenu("hasil");
                      showToast(`Memuat "${pkg.title}"...`);
                    }}
                    className={cn(
                      "group p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between hover:shadow-md hover:border-slate-300 relative h-48 select-none bg-slate-50/10",
                      activePackage?.id === pkg.id
                        ? "border-teal-500 bg-teal-50/15"
                        : "border-slate-200/90 bg-white"
                    )}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span className="text-[9px] font-extrabold bg-teal-50 text-teal-855 px-2 py-0.5 rounded-md uppercase tracking-wider font-mono border border-teal-100/30">
                          {pkg.fase} • Kelas {pkg.kelas}
                        </span>
                        {activePackage?.id === pkg.id && (
                          <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 border border-emerald-100">
                            <span className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                            AKTIF
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors line-clamp-2 leading-snug">
                        {pkg.title}
                      </h4>
                      
                      <p className="text-xs text-slate-500 font-medium line-clamp-1 mt-1.5 flex items-center gap-1">
                        <BookOpen className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{pkg.subject}</span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 mt-4 bg-transparent" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        {pkg.timestamp}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => {
                            setActivePackage(pkg);
                            if (pkg.taksonomi) {
                              setTaksonomi(pkg.taksonomi);
                            } else {
                              const levelStr = pkg.questions.map(q => q.taxonomyLevel || "").join(" ").toUpperCase();
                              if (levelStr.includes("C1") || levelStr.includes("C2") || levelStr.includes("MENGINGAT") || levelStr.includes("MEMAHAMI")) {
                                setTaksonomi("BLOOM");
                              } else if (levelStr.includes("UNISTRUKTURAL") || levelStr.includes("MULTISTRUKTURAL") || levelStr.includes("RELASIONAL")) {
                                setTaksonomi("SOLO");
                              }
                            }
                            setActiveTab("lembar");
                            setActiveMainMenu("hasil");
                            showToast(`Memuat "${pkg.title}"...`);
                          }}
                          className="text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 px-3 py-1.5 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                        >
                          Buka
                        </button>
                        <button
                          onClick={(e) => deletePackage(pkg.id, e)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-xl transition-colors cursor-pointer"
                          title="Hapus paket"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </main>

      {/* SIBI (Sistem Informasi Perbukuan Indonesia) Book Browser Modal */}
      {showSibiModal && (
        <div className="no-print fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 flex flex-col max-h-[90vh] md:max-h-[80vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-md shadow-teal-600/10 shrink-0">
                  SI
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-950 font-display truncate">Sistem Informasi Perbukuan Indonesia (SIBI)</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 truncate">Katalog Buku Kurikulum Merdeka & Edisi Revisi Resmi Kementerian</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSibiModal(false);
                  setSibiSelectedBookId(null);
                  setSibiSelectedTopics([]);
                }}
                className="text-slate-400 hover:text-slate-900 font-bold text-xs cursor-pointer hover:bg-slate-100 px-2 sm:px-2.5 py-1.5 rounded-lg transition-all shrink-0"
              >
                <span className="hidden sm:inline">Tutup Katalog</span>
                <span className="sm:hidden font-bold text-sm px-1">✕</span>
              </button>
            </div>

            {/* Sibi Selektor Filters & Sibi Content Container */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 scrollbar-thin">
              
              {/* Conditional Rendering: BOOK SELECTION VIEW or BOOK DETAIL TOPIC VIEW */}
              {!sibiSelectedBookId ? (
                // VIEW 1: CATALOG OVERVIEW
                <div className="space-y-4">
                  {/* Category Filter Controls */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Jenjang Sekolah</label>
                      <select
                        value={sibiJenjang}
                        onChange={(e) => setSibiJenjang(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 text-xs bg-white cursor-pointer"
                      >
                        <option value="SD/MI">SD / MI (Sekolah Dasar)</option>
                        <option value="SMP/MTs">SMP / MTs (Menengah Pertama)</option>
                        <option value="SMA/MA">SMA / MA (Menengah Atas)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Tingkat Kelas</label>
                      <select
                        value={sibiKelas}
                        onChange={(e) => setSibiKelas(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 text-xs bg-white cursor-pointer"
                      >
                        <option value="Kelas I">Kelas 1 SD</option>
                        <option value="Kelas II">Kelas 2 SD</option>
                        <option value="Kelas III">Kelas 3 SD</option>
                        <option value="Kelas IV">Kelas 4 SD</option>
                        <option value="Kelas V">Kelas 5 SD</option>
                        <option value="Kelas VI">Kelas 6 SD</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mata Pelajaran</label>
                      <select
                        value={sibiMapel}
                        onChange={(e) => setSibiMapel(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-teal-500 text-xs bg-white cursor-pointer"
                      >
                        <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                        <option value="Matematika">Matematika</option>
                        <option value="Ilmu Pengetahuan Alam dan Sosial (IPAS)">IPAS (Sains & Sosial)</option>
                      </select>
                    </div>
                  </div>

                  {/* Books Catalog Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-850 mb-3 font-display uppercase tracking-wider">Hasil Pencarian Buku Utama</h4>
                    
                    {/* Catalog Query Filter */}
                    {(() => {
                      const filtered = SIBI_BOOKS.filter(
                        (b) =>
                          b.jenjang === sibiJenjang &&
                          b.kelas === sibiKelas &&
                          b.subject === sibiMapel
                      );

                      if (filtered.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
                            <BookOpen className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-700">Katalog SIBI Belum Tersedia</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 max-w-xs leading-relaxed">Saat ini tim sedang memproses integrasi digital buku SIBI lengkap. Silakan pilih kelas 4 mata pelajaran Bahasa Indonesia untuk demo interaktif terpadu!</p>
                            <button
                              type="button"
                              onClick={() => {
                                setSibiJenjang("SD/MI");
                                setSibiKelas("Kelas IV");
                                setSibiMapel("Bahasa Indonesia");
                              }}
                              className="mt-3.5 text-[10px] font-bold text-teal-600 bg-white hover:bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl cursor-pointer shadow-sm"
                            >
                              Uji Coba Bahasa Indonesia Kelas IV
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filtered.map((book) => (
                            <div
                              key={book.id}
                              onClick={() => setSibiSelectedBookId(book.id)}
                              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-teal-400 hover:shadow-md transition-all flex gap-4 cursor-pointer group relative overflow-hidden"
                            >
                              {/* Left: Book Cover Replica render */}
                              <div className={cn(
                                "w-28 h-40 rounded-xl relative shadow-lg group-hover:scale-105 transition-transform duration-300 overflow-hidden shrink-0 border bg-gradient-to-b",
                                book.coverStyle
                              )}>
                                {book.coverUrl && !bookCoverErrors[book.id] ? (
                                  <img
                                    src={book.coverUrl}
                                    alt={book.title}
                                    onError={() => {
                                      setBookCoverErrors((prev) => ({ ...prev, [book.id]: true }));
                                    }}
                                    referrerPolicy="no-referrer"
                                    className="absolute inset-0 w-full h-full object-cover rounded-xl"
                                  />
                                ) : (
                                  <>
                                    {/* Ministry text small */}
                                    <div className="absolute top-1.5 left-1 right-1 text-[5px] leading-tight font-sans text-slate-800 tracking-tighter opacity-80 text-center uppercase z-10">
                                      KEMENDIKBUDRISTEK REPUBLIK INDONESIA
                                    </div>

                                    {/* Custom Vector Illustration inside book replica */}
                                    <div className="absolute inset-x-0 bottom-0 top-6 bg-sky-200/45">
                                      {/* Simple Beautiful Vector SVG for school book illustration */}
                                      <svg viewBox="0 0 100 120" className="absolute inset-0 w-full h-full object-cover">
                                        <defs>
                                          <linearGradient id="sky-theme" x1="0%" y1="0%" x2="0%" y2="100%">
                                            <stop offset="0%" stopColor="#bae6fd" />
                                            <stop offset="100%" stopColor="#ffffff" />
                                          </linearGradient>
                                        </defs>
                                        {/* Sky background */}
                                        <rect width="100" height="120" fill="url(#sky-theme)" />
                                        {/* Sun */}
                                        <circle cx="85" cy="20" r="8" fill="#fef08a" opacity="0.8" />
                                        {/* Sky Skyscraper silhuettes */}
                                        <rect x="5" y="40" width="15" height="45" fill="#94a3b8" opacity="0.2" />
                                        <rect x="22" y="32" width="18" height="53" fill="#94a3b8" opacity="0.3" />
                                        <rect x="42" y="48" width="15" height="37" fill="#94a3b8" opacity="0.15" />
                                        {/* Plane */}
                                        <path d="M40,25 Q45,28 55,24" stroke="#475569" strokeWidth="1" fill="none" opacity="0.4" />
                                        <path d="M48,26 L52,24" stroke="#475569" strokeWidth="1.5" />
                                        {/* Green grassy landscape */}
                                        <path d="M-10,95 Q30,85 110,95 L110,130 L-10,130 Z" fill="#86efac" />
                                        <path d="M-10,105 Q60,95 110,108 L110,130 L-10,130 Z" fill="#4ade80" />
                                        {/* Trees */}
                                        <circle cx="15" cy="85" r="10" fill="#22c55e" opacity="0.9" />
                                        <rect x="13" y="93" width="4" height="12" fill="#78350f" />
                                        
                                        {/* Kids stylization cartoon silhouettes */}
                                        {/* Girl pig tails */}
                                        <circle cx="70" cy="100" r="4.5" fill="#f87171" />
                                        <path d="M68,104 L72,104 L74,115 L66,115 Z" fill="#ef4444" />
                                        {/* Wheelchair boy */}
                                        <circle cx="45" cy="98" r="4.5" fill="#38bdf8" />
                                        <path d="M42,102 L48,102 L50,111 L40,111 Z" fill="#0284c7" />
                                        <circle cx="45" cy="111" r="5" stroke="#f1f5f9" strokeWidth="1.5" fill="none" />

                                        {/* Flowery and butterfly decorations */}
                                        <path d="M25,102 C23,101 27,99 25,102" fill="#6366f1" />
                                        {/* Giant Butterfly silhouette */}
                                        <path d="M80,95 L84,92 L82,90 L80,93 L78,90 L76,92 Z" fill="#3b82f6" opacity="0.75" />
                                      </svg>
                                    </div>

                                    {/* Text on book copy */}
                                    <div className="absolute top-5 inset-x-2 text-center select-none leading-none z-10">
                                      <span className="text-[10px] font-black block text-slate-900 leading-tight uppercase font-display select-none tracking-tighter" style={{ textShadow: "1px 1px 0px #fff" }}>
                                        {book.id === "bi-4" ? "BAHASA INDONESIA" : book.subject.toUpperCase()}
                                      </span>
                                      <span className="text-[7.5px] italic text-slate-800 font-medium block mt-1 font-mono">{book.subtitle}</span>
                                      
                                      {book.id === "bi-4" && (
                                        <div className="inline-block bg-rose-500 text-white rounded-full px-1.5 py-0.5 text-[4.5px] font-bold uppercase mt-1">
                                          Edisi Revisi
                                        </div>
                                      )}
                                    </div>

                                    {/* Bottom label strip */}
                                    <div className="absolute bottom-0 inset-x-0 bg-indigo-900 text-white text-[7px] font-bold text-center py-1 uppercase tracking-wider rounded-b-xl leading-none z-10">
                                      {book.kelas}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Right: Metadata details info */}
                              <div className="flex-1 flex flex-col justify-between py-1 relative text-left">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-teal-650 bg-teal-50 border border-teal-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Buku Utama Siswa</span>
                                  <h5 className="font-bold text-slate-900 text-xs mt-1.5 group-hover:text-teal-700 transition-colors">{book.title}</h5>
                                  <p className="text-[10px] text-slate-500 leading-snug">Karya: {book.author}</p>
                                  <p className="text-[10px] text-slate-400 mt-1 font-mono">Penerbit: {book.publisher} • {book.year}</p>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] font-bold text-teal-600 mt-3 pt-2">
                                  <span>Buka Daftar Isi & Pilih Materi</span>
                                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                // VIEW 2: BOOK DETAILS & TOPICS VIEW
                (() => {
                  const book = SIBI_BOOKS.find((b) => b.id === sibiSelectedBookId);
                  if (!book) return null;

                  return (
                    <div className="space-y-4">
                      
                      {/* Sub-header inside detail */}
                      <div className="p-4 rounded-2xl bg-teal-50/30 border border-teal-100 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setSibiSelectedBookId(null);
                              setSibiSelectedTopics([]);
                            }}
                            className="text-xs font-bold text-teal-700 hover:text-teal-900 bg-white hover:bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1 shadow-sm"
                          >
                            <Undo2 className="w-3.5 h-3.5 text-teal-600" />
                            Kembali ke Katalog
                          </button>
                          <div className="text-left">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{book.subject} • {book.kelas}</span>
                            <h4 className="font-bold text-slate-900 text-xs mt-0.5">{book.title}</h4>
                          </div>
                        </div>
                        
                        {/* Select All shortcut */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allTopics = book.chapters.flatMap((c) => c.topics);
                              setSibiSelectedTopics(allTopics);
                            }}
                            className="bg-white text-slate-700 border border-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer shadow-sm"
                          >
                            Pilih Semua
                          </button>
                          <button
                            type="button"
                            onClick={() => setSibiSelectedTopics([])}
                            className="bg-white text-slate-700 border border-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer shadow-sm"
                          >
                            Hapus Pilihan
                          </button>
                        </div>
                      </div>

                      {/* Chapters Accordion / Scrolling List */}
                      <div className="space-y-3.5">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left">Silakan Centang Ruang Lingkup Materi Standardisasi SIBI Pembuat Ujian:</h5>
                        
                        {book.chapters.map((chapter, chIdx) => (
                          <div key={`sibi-ch-${chapter.no}-${chIdx}`} className="border border-slate-150 rounded-2xl bg-white shadow-sm overflow-hidden text-left">
                            
                            {/* Chapter Header Band */}
                            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
                              <span className="text-[11px] font-bold text-slate-800 font-display">
                                {chapter.title}
                              </span>
                              <span className="text-[9px] font-semibold text-slate-400 font-mono italic">
                                {chapter.pages}
                              </span>
                            </div>

                            {/* Chapter Material Topics List */}
                            <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                              {chapter.topics.map((topic, idx) => {
                                const isChecked = sibiSelectedTopics.includes(topic);
                                return (
                                  <label
                                    key={idx}
                                    className={cn(
                                      "flex items-start gap-2.5 p-2.5 rounded-xl border transition-all text-xs font-medium cursor-pointer select-none",
                                      isChecked
                                        ? "bg-teal-50/20 border-teal-200 text-teal-950"
                                        : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50/50 hover:border-slate-200"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => {
                                        if (isChecked) {
                                          setSibiSelectedTopics(sibiSelectedTopics.filter((t) => t !== topic));
                                        } else {
                                          setSibiSelectedTopics([...sibiSelectedTopics, topic]);
                                        }
                                      }}
                                      className="mt-0.5 accent-teal-600 rounded cursor-pointer size-4 shrink-0"
                                    />
                                    <span className="leading-normal">{topic}</span>
                                  </label>
                                );
                              })}
                            </div>

                          </div>
                        ))}
                      </div>

                    </div>
                  );
                })()
              )}

            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-slate-100 pt-3.5 mt-4 flex items-center justify-between shrink-0 flex-wrap gap-2">
              <div className="text-left">
                {sibiSelectedBookId && (
                  <p className="text-[11px] font-medium text-slate-600">
                    Siri Terpilih: <strong className="text-teal-700">{sibiSelectedTopics.length} Materi</strong> SIBI Buku Paket
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSibiModal(false);
                    setSibiSelectedBookId(null);
                    setSibiSelectedTopics([]);
                  }}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all"
                >
                  Tutup
                </button>
                {sibiSelectedBookId && (
                  <button
                    type="button"
                    disabled={sibiSelectedTopics.length === 0}
                    onClick={() => {
                      // Map loaded selections to parent content sources state
                      const itemsToAdd = sibiSelectedTopics.map((topic) => ({
                        id: generateUniqueId("content"),
                        type: "Lingkup Materi" as const,
                        text: topic
                      }));
                      
                      // Check for duplicates before pushing
                      const dupsRemoved = itemsToAdd.filter(
                        (item) => !contentList.some((existing) => existing.text === item.text)
                      );

                      if (dupsRemoved.length === 0) {
                        showToast("Materi-materi ini sudah ada di dalam isian form Anda.");
                      } else {
                        setContentList([...contentList, ...dupsRemoved]);
                        showToast(`${dupsRemoved.length} Materi berhasil dimuat dari SIBI!`);
                      }
                      
                      setShowSibiModal(false);
                      setSibiSelectedBookId(null);
                      setSibiSelectedTopics([]);
                    }}
                    className="bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white text-xs font-bold px-4.5 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-teal-600/10"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Load Pilihan ke Asesmen ({sibiSelectedTopics.length})
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Buku Panduan Guru Browser Modal */}
      {showPanduanModal && (
        <div className="no-print fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-xl border border-slate-200 flex flex-col max-h-[90vh] md:max-h-[80vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4 shrink-0 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm tracking-wider shadow-md shadow-indigo-600/10 shrink-0">
                  PG
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-950 font-display truncate">Buku Panduan Guru & Materi Esensial</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium truncate">Katalog Panduan Guru Kurikulum Merdeka Berbasis Elemen & Fase Perkembangan Resmi Kemendikdasmen</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowPanduanModal(false);
                  setPanduanSelectedBookId(null);
                  setPanduanSelectedTopics([]);
                }}
                className="text-slate-400 hover:text-slate-900 font-bold text-xs cursor-pointer hover:bg-slate-100 px-2 sm:px-2.5 py-1.5 rounded-lg transition-all shrink-0"
              >
                <span className="hidden sm:inline">Tutup Panduan</span>
                <span className="sm:hidden font-bold text-sm px-1">✕</span>
              </button>
            </div>

            {/* Selector Filters & Content Container */}
            <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-4 scrollbar-thin">
              
              {!panduanSelectedBookId ? (
                // VIEW 1: CATALOG OVERVIEW BY FASE
                <div className="space-y-4">
                  {/* Category Filter Controls */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Pilih Fase Perkembangan</label>
                      <select
                        value={panduanSelectedFaseId}
                        onChange={(e) => setPanduanSelectedFaseId(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 text-xs bg-white cursor-pointer"
                      >
                        <option value="Fase A">Fase A (Siswa Kelas 1 & 2 SD)</option>
                        <option value="Fase B">Fase B (Siswa Kelas 3 & 4 SD)</option>
                        <option value="Fase C">Fase C (Siswa Kelas 5 & 6 SD)</option>
                        <option value="Fase D">Fase D (Siswa Kelas 7, 8, 9 SMP)</option>
                        <option value="Fase E">Fase E (Siswa Kelas 10 SMA)</option>
                        <option value="Fase F">Fase F (Siswa Kelas 11 & 12 SMA)</option>
                        <option value="Fase F Tingkat Lanjut">Fase F Tingkat Lanjut (Siswa Kelas 11 & 12 SMA Peminatan)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Mata Pelajaran</label>
                      <select
                        value={panduanMapel}
                        onChange={(e) => setPanduanMapel(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-xl border border-slate-200 focus:outline-none focus:border-indigo-500 text-xs bg-white cursor-pointer"
                      >
                        <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                        <option value="Bahasa Inggris">Bahasa Inggris</option>
                        <option value="Matematika">Matematika</option>
                        <option value="IPAS">IPAS (Sains & Sosial)</option>
                        <option value="Pendidikan Pancasila">Pendidikan Pancasila</option>
                        <option value="PJOK">PJOK (Penjasorkes)</option>
                        <option value="Seni Rupa">Seni Rupa</option>
                        <option value="Seni Musik">Seni Musik</option>
                        <option value="Seni Teater">Seni Teater</option>
                        <option value="Seni Tari">Seni Tari</option>
                      </select>
                    </div>
                  </div>

                  {/* Books Catalog Grid */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-850 mb-3 font-display uppercase tracking-wider">Buku Panduan Guru Esensial Terpilih</h4>
                    
                    {(() => {
                      const filtered = PANDUAN_BOOKS.filter((b) => {
                        // Match subject
                        if (b.subject !== panduanMapel) return false;

                        // Match kelas/Fase
                        if (b.kelas === panduanSelectedFaseId) return true;

                        // Match multigrade / multi-fase books
                        const bookKelas = b.kelas.toLowerCase();
                        const selectedFase = panduanSelectedFaseId.toLowerCase();

                        if (bookKelas.includes("fase a-f")) {
                          return ["fase a", "fase b", "fase c", "fase d", "fase e", "fase f"].includes(selectedFase);
                        }
                        if (bookKelas.includes("fase b & c") || bookKelas.includes("fase b-c") || bookKelas.includes("fase b dan c")) {
                          return ["fase b", "fase c"].includes(selectedFase);
                        }

                        return false;
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="flex flex-col items-center justify-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-2xl text-center bg-slate-50/50">
                            <Bookmark className="w-8 h-8 text-slate-300 mb-2" />
                            <p className="text-xs font-bold text-slate-700">Buku Panduan Guru Belum Tersedia</p>
                            <p className="text-[10px] text-slate-500 mt-0.5 max-w-xs leading-relaxed font-sans">Saat ini tim sedang memproses integrasi digital buku panduan guru lengkap. Silakan pilih mata pelajaran Bahasa Indonesia untuk demo interaktif terpadu!</p>
                            <button
                              type="button"
                              onClick={() => {
                                setPanduanSelectedFaseId("Fase B");
                                setPanduanMapel("Bahasa Indonesia");
                              }}
                              className="mt-3.5 text-[10px] font-bold text-indigo-600 bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl cursor-pointer shadow-sm"
                            >
                              Uji Coba Bahasa Indonesia Fase B (Kelas 3 & 4)
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filtered.map((book) => (
                            <div
                              key={book.id}
                              onClick={() => setPanduanSelectedBookId(book.id)}
                              className="p-4 rounded-2xl border border-slate-200 bg-white hover:border-indigo-400 hover:shadow-md transition-all flex gap-4 cursor-pointer group relative overflow-hidden"
                            >
                              {/* Left: Book Cover Replica */}
                              <div className={cn(
                                "w-28 h-40 rounded-xl relative shadow-lg group-hover:scale-105 transition-transform duration-300 overflow-hidden shrink-0 border bg-gradient-to-b",
                                book.coverStyle
                              )}>
                                {book.coverUrl ? (
                                  <img
                                    src={book.coverUrl}
                                    alt={book.title}
                                    onError={(e) => {
                                      // Fallback background color if webp image doesn't exist
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                    referrerPolicy="no-referrer"
                                    className="absolute inset-0 w-full h-full object-cover rounded-xl"
                                  />
                                ) : (
                                  <>
                                    <div className="absolute top-1.5 left-1 right-1 text-[5px] leading-tight font-sans text-slate-800 tracking-tighter opacity-80 text-center uppercase z-10">
                                      KEMENDIKBUDRISTEK REPUBLIK INDONESIA
                                    </div>
                                    <div className="absolute inset-x-0 bottom-0 top-6 bg-slate-200/40 flex items-center justify-center p-2 text-center text-[8px] font-bold text-slate-700">
                                      {book.title}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* Right: Metadata details info */}
                              <div className="flex-1 flex flex-col justify-between py-1 relative text-left">
                                <div className="space-y-1">
                                  <span className="text-[9px] font-bold text-indigo-650 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Buku Panduan Guru Resmi</span>
                                  <h5 className="font-bold text-slate-900 text-xs mt-1.5 group-hover:text-indigo-700 transition-colors leading-relaxed">{book.title}</h5>
                                  <p className="text-[10px] text-slate-500 leading-snug">Rangkuman Materi Esensial Kurikulum Nasional</p>
                                  <p className="text-[10px] text-slate-400 mt-1 font-mono">Penerbit: Kemendikdasmen • {book.year}</p>
                                </div>
                                <div className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 mt-3 pt-2">
                                  <span>Buka Elemen & Pilih Materi Esensial</span>
                                  <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                // VIEW 2: BOOK DETAILS & TOPICS VIEW
                (() => {
                  const book = PANDUAN_BOOKS.find((b) => b.id === panduanSelectedBookId);
                  if (!book) return null;

                  // Helper function to split topics by semicolon and format elegantly
                  const getFormattedTopics = (topicsArray: string[]) => {
                    return topicsArray.flatMap((topic) => {
                      return topic.split(';').map((t) => {
                        let trimmed = t.trim();
                        if (!trimmed) return "";
                        // Capitalize the first letter
                        trimmed = trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
                        // Strip trailing periods
                        if (trimmed.endsWith('.')) {
                          trimmed = trimmed.slice(0, -1);
                        }
                        return trimmed.trim();
                      }).filter(Boolean);
                    });
                  };

                  // Filter chapters so that we only display the selected phase (Fase Terpilih)
                  const filteredChapters = book.chapters.filter((chapter) => {
                    // If the book is already designed specifically for this single Fase, show all chapters
                    if (book.kelas.toLowerCase() === panduanSelectedFaseId.toLowerCase()) {
                      return true;
                    }
                    // For books that contain "Fase A-F" or similar ranges, only show chapters matching current selected Fase
                    return chapter.title.toLowerCase().includes(panduanSelectedFaseId.toLowerCase());
                  });

                  return (
                    <div className="space-y-4">
                      
                      {/* Sub-header inside detail */}
                      <div className="p-4 rounded-2xl bg-indigo-50/30 border border-indigo-100 flex items-center justify-between flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              setPanduanSelectedBookId(null);
                              setPanduanSelectedTopics([]);
                            }}
                            className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-xl cursor-pointer flex items-center gap-1 shadow-sm font-sans"
                          >
                            <Undo2 className="w-3.5 h-3.5 text-indigo-600" />
                            Kembali ke Katalog
                          </button>
                          <div className="text-left">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{book.subject} • {book.kelas}</span>
                            <h4 className="font-bold text-slate-900 text-xs mt-0.5 leading-relaxed">{book.title}</h4>
                          </div>
                        </div>
                        
                        {/* Select All shortcut */}
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              const allTopics = filteredChapters.flatMap((c) => getFormattedTopics(c.topics));
                              setPanduanSelectedTopics(allTopics);
                            }}
                            className="bg-white text-slate-700 border border-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer shadow-sm font-sans"
                          >
                            Pilih Semua
                          </button>
                          <button
                            type="button"
                            onClick={() => setPanduanSelectedTopics([])}
                            className="bg-white text-slate-700 border border-slate-200 text-[10px] font-bold px-2.5 py-1.5 rounded-xl hover:bg-slate-50 cursor-pointer shadow-sm font-sans"
                          >
                            Hapus Pilihan
                          </button>
                        </div>
                      </div>

                      {/* Chapters Accordion / Scrolling List */}
                      <div className="space-y-3.5">
                        <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-left font-sans">Centang Materi Esensial Fase Perkembangan yang Ingin Dimuat:</h5>
                        
                        {filteredChapters.map((chapter, chIdx) => {
                          const splitTopics = getFormattedTopics(chapter.topics);
                          return (
                            <div key={`panduan-ch-${chapter.no}-${chIdx}`} className="border border-slate-150 rounded-2xl bg-white shadow-sm overflow-hidden text-left">
                              
                              {/* Chapter Header Band */}
                              <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50/20 to-white">
                                <span className="text-[11px] font-bold text-indigo-950 font-display flex items-center gap-1.5">
                                  <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
                                  {chapter.title}
                                </span>
                                <span className="text-[9px] font-semibold text-indigo-400 font-mono italic">
                                  {chapter.pages}
                                </span>
                              </div>

                              {/* Chapter Material Topics List */}
                              <div className="p-3.5 grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {splitTopics.map((topic, idx) => {
                                  const isChecked = panduanSelectedTopics.includes(topic);
                                  return (
                                    <label
                                      key={idx}
                                      className={cn(
                                        "flex items-start gap-2.5 p-2.5 rounded-xl border transition-all text-xs font-medium cursor-pointer select-none",
                                        isChecked
                                          ? "bg-indigo-50/20 border-indigo-200 text-indigo-950"
                                          : "bg-white border-slate-100 text-slate-700 hover:bg-slate-50/50 hover:border-slate-200"
                                      )}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => {
                                          if (isChecked) {
                                            setPanduanSelectedTopics(panduanSelectedTopics.filter((t) => t !== topic));
                                          } else {
                                            setPanduanSelectedTopics([...panduanSelectedTopics, topic]);
                                          }
                                        }}
                                        className="mt-0.5 accent-indigo-650 rounded cursor-pointer size-4 shrink-0"
                                      />
                                      <span className="leading-normal">{topic}</span>
                                    </label>
                                  );
                                })}
                              </div>

                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })()
              )}

            </div>

            {/* Modal Actions Footer */}
            <div className="border-t border-slate-100 pt-3.5 mt-4 flex items-center justify-between shrink-0 flex-wrap gap-2">
              <div className="text-left">
                {panduanSelectedBookId && (
                  <p className="text-[11px] font-medium text-slate-600">
                    Materi Terpilih: <strong className="text-indigo-700">{panduanSelectedTopics.length} Materi</strong> Buku Panduan
                  </p>
                )}
              </div>
              <div className="flex gap-2 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setShowPanduanModal(false);
                    setPanduanSelectedBookId(null);
                    setPanduanSelectedTopics([]);
                  }}
                  className="bg-slate-105 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl cursor-pointer transition-all font-sans"
                >
                  Tutup
                </button>
                {panduanSelectedBookId && (
                  <button
                    type="button"
                    disabled={panduanSelectedTopics.length === 0}
                    onClick={() => {
                      // Map loaded selections to parent content sources state
                      const itemsToAdd = panduanSelectedTopics.map((topic) => ({
                        id: generateUniqueId("content"),
                        type: "Lingkup Materi" as const,
                        text: topic
                      }));
                      
                      // Check for duplicates before pushing
                      const dupsRemoved = itemsToAdd.filter(
                        (item) => !contentList.some((existing) => existing.text === item.text)
                      );

                      if (dupsRemoved.length === 0) {
                        showToast("Materi-materi ini sudah ada di dalam isian form Anda.");
                      } else {
                        setContentList([...contentList, ...dupsRemoved]);
                        showToast(`${dupsRemoved.length} Materi berhasil dimuat dari Buku Panduan!`);
                      }
                      
                      setShowPanduanModal(false);
                      setPanduanSelectedBookId(null);
                      setPanduanSelectedTopics([]);
                    }}
                    className="bg-indigo-600 hover:bg-indigo-750 disabled:opacity-50 text-white text-xs font-bold px-4.5 py-2 rounded-xl cursor-pointer transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/10 font-sans"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Load Pilihan ke Asesmen ({panduanSelectedTopics.length})
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Initial Welcome Popup Modal "PLEASE BACA!" */}
      {showWelcomeModal && (
        <div className="no-print fixed inset-0 bg-slate-900/80 z-100 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-3xl w-full max-w-4xl lg:max-w-5xl p-6 md:p-8 shadow-2xl border-2 border-teal-550 flex flex-col my-auto max-h-[92vh] overflow-hidden transition-all">
            
            {/* Modal Header */}
            <div className="text-center pb-4 mb-4 border-b border-slate-150 shrink-0">
              <h1 className="text-xl sm:text-2xl md:text-3.5xl font-black tracking-wider text-rose-600 font-display uppercase animate-pulse">
                ⚠️ PLEASE BACA!
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-500 font-medium mt-1 uppercase tracking-widest font-mono">
                Panduan Penggunaan Penting / Disclaimer Awal
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-1.5 sm:gap-2 mt-3 text-[10.5px] sm:text-[11px] font-sans">
                <span className="text-slate-600 bg-slate-100 px-2 py-1 rounded border border-slate-200 font-medium tracking-wide">Update Versi: <strong className="text-slate-900">07.06.2026</strong></span>
                <span className="text-slate-500 font-medium">Versi sebelumnya dapat diakses</span>
                <a href="https://ngidesoal-n-up1.netlify.app" target="_blank" rel="noopener noreferrer" className="text-teal-700 font-bold hover:text-teal-800 hover:bg-teal-100 px-2.5 py-1 bg-teal-50 border border-teal-200 rounded transition-all active:scale-95 shadow-sm">disini</a>
              </div>
            </div>

            {/* Scrollable Container (Satu Scrollbar Utama untuk Isi) */}
            <div className="flex-1 pr-1.5 overflow-y-auto scrollbar-thin space-y-5">
              
              {/* Special Highlight Box (Baris Pertama / Tempat Spesial) */}
              <div className="bg-gradient-to-br from-amber-50 to-amber-100/60 border-2 border-amber-300 rounded-2xl p-4 md:p-5 shadow-xs">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                  <div className="text-xs md:text-sm text-slate-800 leading-relaxed font-bold">
                    SABAR, Loading/proses pembuatan soal tergantung jumlah soal dan dokumen kelengkapan. Beri jeda saat membuat paket soal.
                  </div>
                </div>
              </div>

              {/* Content Lists in 2 Columns to Maximize Width & Avoid Vertical Clippings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 text-xs md:text-[12.5px] leading-relaxed text-slate-700">
                
                {/* Left Column: Platform & Distribution */}
                <div className="space-y-3">
                  <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                      Fitur & Peringatan
                    </h3>
                    <ul className="space-y-2 list-disc pl-4">
                      <li>
                        Untuk pengguna api key gratis salin prompt gambar - generate di AI kesayangan-unggah di soal.
                      </li>
                      <li>
                        Semua data (api key dan history soal) tersimpan di local storage laptop/perangkat yang digunakan.
                      </li>
                      <li>
                        Ada 2 versi ngide soal (N dan R), perbedaanya adalah di stimulus soal dan format hasil (soal maupun kelengkapan lainnya).
                      </li>
                      <li>
                        Pada versi N, soal diunduh dalam format html (tetap bisa dibuka meski tanpa jaringan ketika ingin dicetak).
                      </li>
                    </ul>
                  </div>

                  <div className="bg-slate-50/80 rounded-xl p-3.5 border border-slate-200">
                    <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" />
                      Keamanan API Key & Hosting
                    </h3>
                    <ul className="space-y-2 list-disc pl-4">
                      <li>
                        <span className="text-rose-600 font-extrabold uppercase">JANGAN BAGIKAN API KEY ANDA KE ORANG LAIN.</span>
                      </li>
                      <li>
                        Karena ini gratis maka saya deploy di Netlify (ada batasan kredit bulanan sehingga sewaktu-waktu dipause oleh Netlify sampai bulan berikutnya).
                      </li>
                      <li>
                        Jika ingin lebih eksklusif untuk diri sendiri, Anda dipersilakan mengunggah/deploy sendiri ke Netlify Anda sendiri (tinggal unggah kode tanpa edit).
                      </li>
                    </ul>
                  </div>
                </div>

                {/* Right Column: AI Warning & Tips */}
                <div className="space-y-3">
                  <div className="bg-rose-50/40 rounded-xl p-3.5 border border-rose-150">
                    <h3 className="font-extrabold text-rose-900 mb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
                      PENTING & WAJIB BACA!
                    </h3>
                    <ul className="space-y-2">
                      <li className="font-bold text-slate-900">
                        ⚠️ <strong className="text-rose-600 font-black">HASIL AI BISA SALAH, WAJIB CEK DAN PERBAIKI!</strong> ini adalah TOOLS bantu mengajar, bukan pengganti peran Anda seutuhnya.
                      </li>
                    </ul>
                  </div>

                  {/* Love and Appreciation */}
                  <div className="bg-teal-50/50 rounded-xl p-3.5 border border-teal-150 text-slate-800 flex flex-col justify-center items-center text-center space-y-2">
                    <Heart className="w-7 h-7 text-rose-500 fill-rose-500 animate-pulse" />
                    <p className="font-bold tracking-wide text-xs uppercase leading-normal text-teal-950 font-display">
                      JANGAN BOSAN DAN TERIMAKASIH SUDAH MENJADI GURU ❤️
                    </p>
                  </div>
                </div>

              </div>

            </div>

            {/* Modal Closer / Dismiss Footer */}
            <div className="mt-5 pt-4 border-t border-slate-150 flex flex-col lg:flex-row justify-between items-center gap-4 shrink-0">
              <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start w-full lg:w-auto">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mr-1">
                  Akses Tutorial:
                </span>
                <a
                  href="https://s.id/tutorngidefb"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-[10.5px] font-display flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shadow-blue-600/20 hover:scale-[1.02]"
                >
                  <Facebook className="w-3.5 h-3.5" />
                  <span>Tutorial Facebook</span>
                </a>
                <a
                  href="https://s.id/tutorngideyt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-[10.5px] font-display flex items-center gap-1.5 transition-all cursor-pointer shadow-xs shadow-rose-600/20 hover:scale-[1.02]"
                >
                  <Youtube className="w-3.5 h-3.5" />
                  <span>Tutorial YouTube</span>
                </a>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto shrink-0 justify-end">
                <span className="text-[10px] text-slate-400 font-mono italic text-center sm:text-left select-none">
                  Sistem Ngide Soal 2026 - Versi Pembelajaran Mendalam (Next.js)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowWelcomeModal(false);
                    if (!customApiKey || customApiKey.trim() === "") {
                      setShowApiKeySettingsModal(true);
                    }
                  }}
                  className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white transition-all font-black text-xs font-display flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-teal-600/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Check className="w-4 h-4 text-white" />
                  <span>SAYA MENGERTI & LANJUTKAN</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Info Modal Understanding Deep Learning 2026 */}
      {showInfoModal && (
        <div className="no-print fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-xl border border-slate-200 flex flex-col scrollbar-thin">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <span className="text-sm font-bold text-slate-950 font-display flex items-center gap-1.5">
                <BookOpen className="w-5 h-5 text-teal-600" />
                Dunia Kurikulum & Prinsip Asesmen
              </span>
              <button
                onClick={() => setShowInfoModal(false)}
                className="text-slate-400 hover:text-slate-900 font-bold text-sm cursor-pointer hover:bg-slate-100 px-2 py-1 rounded"
              >
                Tutup
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600 overflow-y-auto max-h-[450px] pr-1 scrollbar-thin">
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-1">Mengenal Kurikulum & Prinsip Asesmen</h4>
                <p className="leading-relaxed">
                  Berdasarkan pedoman Kementerian Pendidikan Dasar dan Menengah, pendekatan kurikulum diarahkan untuk <strong>memuliakan manusia, intelektualitas, dan masyarakat</strong> melalui suasana belajar berkesadaran, bermakna, dan menggembirakan.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-bold text-slate-900 text-xs mb-1.5">3 Prinsip Utama Pembelajaran</h4>
                <ul className="space-y-2 list-none pl-0">
                  <li className="flex gap-2">
                    <span className="font-bold text-teal-600">Berkesadaran (Mindful):</span> Belajar secara aktif dan menumbuhkan motivasi intrinsik dari dalam diri, bukan paksaan atau orientasi angka ujian semata.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-teal-600">Bermakna (Meaningful):</span> Teraplikasikan langsung dalam kehidupan sehari-hari (kontekstual) serta mendorong nalar berpikir kritis yang kuat.
                  </li>
                  <li className="flex gap-2">
                    <span className="font-bold text-teal-600">Menggembirakan (Joyful):</span> Menantang, nyaman secara emosi, dan memicu momen pencerahan (&ldquo;AHA Moment&rdquo;) saat memecahkan masalah kompleks.
                  </li>
                </ul>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-bold text-slate-900 text-xs mb-1.5">Taksonomi SOLO vs BLOOM</h4>
                <p className="leading-relaxed mb-2">
                  Ngide Soal membagi penilaian berdasarkan dua opsi terbaik kurikulum:
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <h5 className="font-bold text-slate-800 text-[10px] uppercase mb-1">Taksonomi SOLO</h5>
                    <ol className="list-decimal pl-3 space-y-0.5 text-[10px]">
                      <li>Prastruktural (Gagal paham)</li>
                      <li>Unistruktural (1 aspek)</li>
                      <li>Multistruktural (Banyak aspek)</li>
                      <li>Relasional (Korelasi utuh)</li>
                      <li>Abstrak Diperluas (Aksi nyata)</li>
                    </ol>
                  </div>
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <h5 className="font-bold text-slate-800 text-[10px] uppercase mb-1">Taksonomi BLOOM</h5>
                    <ol className="list-decimal pl-3 space-y-0.5 text-[10px]">
                      <li>Mengingat (C1)</li>
                      <li>Memahami (C2)</li>
                      <li>Menerapkan (C3)</li>
                      <li>Menganalisis (C4)</li>
                      <li>Mengevaluasi (C5)</li>
                      <li>Mencipta (C6)</li>
                    </ol>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-bold text-slate-900 text-xs mb-1.5 font-display text-teal-700">Kaidah Penulisan Soal Terstandar (E-Modul)</h4>
                <p className="leading-relaxed mb-2 text-[11px]">
                  Sistem AI secara cerdas menyaring dan mempertahankan aturan validitas penyusunan soal ujian nasional:
                </p>
                <div className="space-y-2 text-[10.5px]">
                  <div className="p-2.5 rounded-xl border border-teal-100 bg-teal-50/20">
                    <span className="font-bold text-teal-900 block mb-0.5">1. Sifat Pokok Soal (Stem)</span>
                    <ul className="list-disc pl-3.5 space-y-0.5 text-slate-650">
                      <li>Wajib memiliki tata bahasa lengkap: struktur <strong className="text-teal-900">Subjek & Predikat</strong> yang jelas.</li>
                      <li>Bebas dari pernyataan negatif ganda (double negative) untuk menghindari kerajuan murid.</li>
                      <li>Tidak memberikan petunjuk (clue) halus yang mengarah ke kunci jawaban.</li>
                      <li>Menghindari pernyataan berupa anak kalimat saja.</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded-xl border border-slate-150 bg-slate-50/50">
                    <span className="font-bold text-slate-850 block mb-0.5">2. Pilihan Jawaban (MCQ)</span>
                    <ul className="list-disc pl-3.5 space-y-0.5 text-slate-650">
                      <li>Opsi harus homogen, logis, dan pengecoh (distractor) wajib berfungsi mendasar.</li>
                      <li>Panjang kalimat opsi relatif sejajar dan seimbang (tidak timpang).</li>
                      <li>Opsi angka/waktu wajib diurutkan berdasarkan nilai numerik atau kronologis.</li>
                      <li>Sama sekali dilarang menggunakan frase penyapu jagat seperti &ldquo;semua jawaban salah/benar&rdquo;.</li>
                    </ul>
                  </div>

                  <div className="p-2.5 rounded-xl border border-amber-100 bg-amber-50/20">
                    <span className="font-bold text-amber-900 block mb-0.5">3. Soal Isian & Uraian (Essay)</span>
                    <ul className="list-disc pl-3.5 space-y-0.5 text-slate-650">
                      <li>Uraian wajib menuntut pemikiran terurai (<em className="font-mono text-[9px] bg-white px-1">bagaimana, jelaskan, mengapa</em>).</li>
                      <li>Tersusun ruang lingkup pengerjaan yang jelas beserta pedoman rubrik penskoran bertingkat.</li>
                      <li>Isian singkat menggunakan maksimal 2 bagian rumpang agar konteks soal tetap logis.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom API Key & Model Configuration Modal */}
      {showApiKeySettingsModal && (
        <div className="no-print fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-5 shadow-2xl border border-slate-150 flex flex-col relative overflow-hidden max-h-[90vh]">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-400 to-indigo-500" />

            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3.5 gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-950 font-display flex items-center gap-1.5 min-w-0">
                <Key className="w-4 h-4 sm:w-5 sm:h-5 text-teal-600 shrink-0" />
                <span className="truncate">Konfigurasi API Key & Model Gemini (Wajib Mandiri)</span>
              </span>
              <button
                onClick={() => setShowApiKeySettingsModal(false)}
                className="text-slate-400 hover:text-slate-900 font-bold text-xs p-1.5 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
                title="Tutup"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto flex-1 pr-1 pb-1 scrollbar-thin">
              {/* Petunjuk Cara Mendapatkan API Key */}
              <div className="bg-teal-50/40 rounded-2xl border border-teal-150 p-3.5 space-y-2">
                <h4 className="font-bold text-teal-900 text-[11px] flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-teal-700" />
                  Cara Mendapatkan Google Gemini API Key Gratis:
                </h4>
                <ol className="list-decimal pl-4.5 text-[10px] text-slate-700 space-y-1">
                  <li>
                    Kunjungi <a href="https://aistudio.google.com/" target="_blank" rel="noopener noreferrer" className="text-teal-750 font-bold underline hover:text-teal-800">Google AI Studio</a>.
                  </li>
                  <li>
                    Masuk menggunakan <strong>Akun Google</strong> Anda.
                  </li>
                  <li>
                    Klik fungsional <strong className="bg-teal-100 px-1 rounded text-teal-900 font-bold">&ldquo;Get API Key&rdquo;</strong> di pojok kiri atas.
                  </li>
                  <li>
                    Pilih opsi <strong className="text-teal-900">&ldquo;Create API Key&rdquo;</strong> lalu buat kunci di project baru atau project Google Cloud Anda yang sudah ada.
                  </li>
                  <li>
                    Salin string yang tampak seperti <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono text-[9px]">AIzaSy...</code>
                  </li>
                  <li>
                    Tempelkan string tersebut ke kolom input di samping dan klik <strong>Simpan & Tutup</strong>.
                  </li>
                </ol>
                <p className="text-[9.5px] text-slate-500 leading-normal bg-white/60 p-2 rounded-lg border border-teal-100/50">
                  💡 <strong>Mengapa Mandiri?</strong> Platform Ngide Soal memproses seluruh instruksi formulasi kurikulum dan penggambaran ilustrasi SVG 100% langsung di browser Anda. API Key Anda disimpan dengan aman secara lokal di browser Anda sendiri (localStorage) dan tidak pernah dikirimkan ke server kami.
                </p>
              </div>

              {/* Form Input */}
              <div className="space-y-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="block text-[10.5px] font-bold text-slate-700 flex items-center gap-1">
                        Gemini API Key Anda (Wajib Diisi)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowApiKeyText(!showApiKeyText)}
                        className="text-[9.5px] font-semibold text-teal-600 hover:underline cursor-pointer"
                      >
                        {showApiKeyText ? "Sembunyikan" : "Tampilkan Suku Kata"}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type={showApiKeyText ? "text" : "password"}
                        placeholder="AIzaSy... (API Key wajib dimasukkan demi kelancaran penjanaan)"
                        value={customApiKey}
                        onChange={(e) => setCustomApiKey(e.target.value)}
                        className="w-full px-3 py-1.5 pr-10 rounded-xl border border-slate-200 text-slate-800 text-[10.5px] font-mono bg-white focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-xs"
                      />
                      <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                        <Key className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                    </div>
                  </div>

                  {/* Model AI Gemini Selector */}
                  <div>
                    <label className="block text-[10.5px] font-bold text-slate-700 mb-1 uppercase tracking-wide">
                      MODEL AI GEMINI
                    </label>
                    <select
                      value={customTextModel}
                      onChange={(e) => updateCustomTextModel(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-slate-200 text-slate-800 text-[11px] bg-slate-50 border-teal-200 hover:border-teal-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 cursor-pointer font-semibold transition-all shadow-xs"
                    >
                      <option value="gemini-2.5-flash">Gemini 2.5 Flash (Sangat Cepat - Rekomendasi Free Tier)</option>
                      <option value="gemini-2.5-pro">Gemini 2.5 Pro (Lebih Pintar)</option>
                      <option value="gemini-2.5-pro">Gemini 3.1 Pro Preview (Model Terbaru)</option>
                    </select>
                  </div>
                </div>

                {/* Info status saat ini */}
                <div className="flex items-center gap-2 text-[10px] p-2 bg-slate-50 rounded-xl border border-slate-100 mt-2">
                  <div className={cn(
                    "w-2 h-2 rounded-full shrink-0",
                    customApiKey?.trim() ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-pulse"
                  )} />
                  <span className="text-slate-600 font-medium font-sans">
                    Status saat ini:{" "}
                    {customApiKey?.trim() ? (
                      <strong className="text-emerald-700">Menggunakan API Key Mandiri ({customTextModel})</strong>
                    ) : (
                      <strong className="text-rose-600 font-bold">⚠️ Belum Terkonfigurasi (API Key Wajib Diaktifkan)</strong>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-3 mt-3">
              <button
                type="button"
                onClick={() => {
                  if (!customApiKey || customApiKey.trim() === "") {
                    showToast("⚠️ API Key wajib diisi untuk menyimpan konfigurasi!");
                    return;
                  }
                  setShowApiKeySettingsModal(false);
                  showToast("Konfigurasi API berhasil disimpan!");
                }}
                className="px-5 py-1.5 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl transition-all shadow-md shadow-teal-50 cursor-pointer"
              >
                Simpan & Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Token Usage Modal */}
      {showTokenModal && tokenInfo && (
        <div className="no-print fixed inset-0 bg-slate-950/70 z-50 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="bg-white rounded-3xl max-w-md w-full max-h-[80vh] shadow-2xl border border-slate-150 flex flex-col relative overflow-hidden">
            {/* Top decorative badge */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-indigo-650 to-purple-600 z-10" />
            
            {/* Fixed Header */}
            <div className="flex items-center justify-between border-b border-slate-100 p-6 pb-4 shrink-0">
              <span className="text-sm font-bold text-slate-950 font-display flex items-center gap-2">
                <div className="p-1.5 bg-teal-50 rounded-xl text-teal-650">
                  <Cpu className="w-5 h-5" />
                </div>
                Analisis Penggunaan Token AI
              </span>
              <button
                onClick={() => setShowTokenModal(false)}
                className="text-slate-400 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs p-1.5 rounded-xl transition-colors cursor-pointer"
                title="Tutup"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Content Body with styling */}
            <div className="flex-1 overflow-y-auto px-6 py-2 space-y-5 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-slate-50 scrollbar-thumb-rounded">
              {/* Token stats tiles */}
              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Token Masukan (Input)
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-slate-850 font-mono">
                      {tokenInfo.inputTokens.toLocaleString("id-ID")}
                    </span>
                    <span className="text-[10px] text-slate-400">Token</span>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Token Keluaran (Output)
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-extrabold text-teal-600 font-mono">
                      {tokenInfo.outputTokens.toLocaleString("id-ID")}
                    </span>
                    <span className="text-[10px] text-teal-500">Token</span>
                  </div>
                </div>
              </div>

              {/* Informational Text */}
              <div className="p-3 bg-teal-50/30 border border-teal-100/50 rounded-2xl text-xs text-teal-950 leading-relaxed">
                Permintaan ini menghabiskan: <strong className="font-bold font-mono text-teal-850">{tokenInfo.inputTokens} Token Input</strong> &amp; <strong className="font-bold font-mono text-teal-850">{tokenInfo.outputTokens} Token Output</strong>.
              </div>

              {/* API usage limits / progress bar */}
              <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Limit Laju Panggilan (Rate Limit)
                  </span>
                  <span className="text-[11px] font-bold text-slate-700 font-mono">
                    {requestsThisMinute} / 15 Permintaan
                  </span>
                </div>

                {/* Horizontal Progress Bar */}
                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      requestsThisMinute > 12 ? "bg-rose-500" : requestsThisMinute > 8 ? "bg-amber-500" : "bg-teal-550"
                    )}
                    style={{ width: `${Math.min(100, (requestsThisMinute / 15) * 100)}%` }}
                  />
                </div>

                <div className="flex justify-between text-[11px] text-slate-400 leading-normal">
                  <span className="font-sans">Kuota Menit Ini: {requestsThisMinute}/15 Permintaan Terpakai</span>
                  <span className="font-semibold text-[10px] text-slate-400 italic font-mono">Setiap 60d</span>
                </div>
              </div>

              {/* Rangkuman Jumlah Soal yang Dihasilkan */}
              {activePackage && activePackage.questions && (
                <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-2.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-200 pb-1.5 font-display">
                    Rangkuman Soal yang Dihasilkan
                  </span>
                  <div className="space-y-2">
                    {["Pilihan Ganda", "Pilihan Ganda Kompleks", "Menjodohkan", "Isian Singkat", "Uraian"].map((type) => {
                      const actualCount = activePackage.questions.filter((q, idx) => q.type === type).length;
                      const targetRow = qTypeRows.find((r) => r.type === type);
                      const targetCount = targetRow ? (typeof targetRow.count === 'string' ? parseInt(targetRow.count, 10) : Number(targetRow.count)) : 0;
                      const parsedTargetCount = isNaN(targetCount) ? 0 : targetCount;
                      
                      if (parsedTargetCount === 0 && actualCount === 0) return null;
                      const isExceeded = actualCount > parsedTargetCount;

                      return (
                        <div key={type} className="flex items-center justify-between text-[11px] font-sans">
                          <span className="text-slate-700 font-semibold">{type}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 font-medium text-[10px]">Target: {parsedTargetCount}</span>
                            <span className="text-slate-300">|</span>
                            <span className={`font-bold font-mono px-1.5 py-0.5 rounded-md text-[10px] ${
                              isExceeded 
                                ? "bg-rose-50 text-rose-600 border border-rose-200" 
                                : "bg-teal-550 text-teal-700 border border-teal-100"
                            }`}>
                              Hasil: {actualCount} Soal
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="p-2.5 bg-indigo-50/50 border border-indigo-100 rounded-xl text-[10px] text-indigo-900 leading-normal font-medium">
                    <p className="font-bold text-indigo-950 mb-1 flex items-center gap-1">
                      💡 Tip Penyelarasan Soal:
                    </p>
                    <p className="space-y-1">
                      Model AI terkadang menghasilkan soal lebih untuk menjaga kualitas relevansi konten. 
                      Anda bisa dengan mudah <strong className="font-bold">mengubah tipe</strong>, <strong className="font-bold">mengedit redaksi</strong>, atau <strong className="font-bold">menghapus soal berlebih</strong> langsung pada lembar pratinjau di layar utama.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Fixed Footer */}
            <div className="p-6 pt-4 border-t border-slate-100 shrink-0 bg-white">
              <button
                type="button"
                onClick={() => setShowTokenModal(false)}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-4 rounded-2xl text-xs transition-colors shadow-sm cursor-pointer"
              >
                Lihat Hasil Formulasi Soal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modern Print Preview & Formatting Modal */}
      {showPrintPreviewModal && activePackage && (
        <div className="fixed inset-0 bg-slate-900/90 z-50 flex flex-col md:flex-row md:items-stretch md:justify-stretch overflow-y-auto md:overflow-hidden animate-fade-in backdrop-blur-md modal-backdrop-to-print-clean">
          {/* Sidebar configuration & Info on the left */}
          <div className="no-print w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex flex-col md:h-screen shrink-0 shadow-2xl relative z-25 modal-sidebar-to-hide">
            {/* Top decorative gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-teal-500 via-emerald-450 to-cyan-550" />
            
            {/* Header */}
            <div className="p-4 pt-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-teal-600 animate-pulse" />
                <div>
                  <h3 className="text-xs font-black text-slate-950 font-display uppercase tracking-wide">Pratinjau Kertas</h3>
                  <p className="text-[10px] text-slate-400 font-semibold tracking-tight">Atur Tata Letak & Desain Lembar</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintPreviewModal(false)}
                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-full transition-colors cursor-pointer"
                title="Tutup Pratinjau"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sidebar Controls Body scrollable */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              
              {/* Opsi Tata Letak */}
              <div className="space-y-3.5 bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
                <span className="block text-[10.5px] font-black text-slate-800 uppercase tracking-widest border-b border-slate-200 pb-1.5">
                  📐 Aturan Lembar PDF
                </span>

                {/* 1. Susunan Opsi MCQ */}
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">Susunan Pilihan PG</label>
                  <select
                    value={layoutMcq}
                    onChange={(e) => setLayoutMcq(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 cursor-pointer font-semibold focus:outline-none shadow-xs"
                  >
                    <option value="vertical">⬇️ Kebawah (1 Kolom)</option>
                    <option value="grid-2">📊 2 Grid Kolom</option>
                    <option value="horizontal">➡️ Kesamping (Inline)</option>
                  </select>
                </div>

                {/* 2. Ukuran Huruf */}
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">Ukuran Huruf Soal</label>
                  <select
                    value={fontSize}
                    onChange={(e) => setFontSize(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 cursor-pointer font-semibold focus:outline-none shadow-xs"
                  >
                    <option value="xs">Sangat Kecil (11px)</option>
                    <option value="sm">Kecil / Standar (12px)</option>
                    <option value="base">Sedang (14px)</option>
                    <option value="lg">Besar (15.5px)</option>
                  </select>
                </div>

                {/* 3. Spasi Antar Baris */}
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">Spasi Antar Baris</label>
                  <select
                    value={lineSpacing}
                    onChange={(e) => setLineSpacing(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 cursor-pointer font-semibold focus:outline-none shadow-xs"
                  >
                    <option value="tight">Rapat (Tight)</option>
                    <option value="normal">Normal (Standard)</option>
                    <option value="relaxed">Renggang (Relaxed)</option>
                  </select>
                </div>

                {/* 4. Ukuran Gambar */}
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">Ukuran Gambar AI</label>
                  <select
                    value={imageSize}
                    onChange={(e) => setImageSize(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 cursor-pointer font-semibold focus:outline-none shadow-xs"
                  >
                    <option value="small">Kecil (Small)</option>
                    <option value="medium">Sedang (Medium)</option>
                    <option value="large">Besar (Large)</option>
                  </select>
                </div>

                {/* 5. Margin Kertas PDF */}
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">Margin Kertas PDF</label>
                  <select
                    value={marginPdf}
                    onChange={(e) => setMarginPdf(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 cursor-pointer font-semibold focus:outline-none shadow-xs"
                  >
                    <option value="small">Sempit (0.4 in)</option>
                    <option value="medium">Sedang (0.75 in)</option>
                    <option value="large">Lebar (1.1 in)</option>
                  </select>
                </div>

                {/* 6. Ukuran Tabel Soal */}
                <div className="space-y-1">
                  <label className="block text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">Ukuran Tabel Soal</label>
                  <select
                    value={tableSize}
                    onChange={(e) => updateTableSize(e.target.value as any)}
                    className="w-full text-xs p-2.5 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-teal-650 cursor-pointer font-semibold focus:outline-none shadow-xs"
                  >
                    <option value="kecil">🗜️ Kecil & Sempit (Compact)</option>
                    <option value="sedang">📏 Sedang / Standar</option>
                    <option value="besar">🔍 Besar & Longgar</option>
                  </select>
                </div>

                {/* 7. Skala Tampilan Layar (Zoom Preview) */}
                <div className="space-y-1.5 pt-1.5 border-t border-slate-200/60">
                  <div className="flex justify-between items-center text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">
                    <span>Skala Pratinjau</span>
                    <span className="text-[10px] font-black text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded">{previewZoom}%</span>
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="125"
                    step="5"
                    value={previewZoom}
                    onChange={(e) => setPreviewZoom(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-ew-resize accent-teal-650"
                  />
                  <div className="flex justify-between text-[8px] font-bold text-slate-400">
                    <span>Laptop Kecil</span>
                    <span>Asli (100%)</span>
                    <span>Monitor Besar</span>
                  </div>
                </div>

                {/* 7. Pilihan Bagian Cetak */}
                <div className="space-y-2 pt-2.5 border-t border-slate-200/60">
                  <span className="block text-[9.5px] font-extrabold text-slate-500 uppercase tracking-widest">
                    🖨️ Bagian Cetak / Unduh
                  </span>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-100 cursor-pointer text-xs font-semibold select-none">
                      <input
                        type="checkbox"
                        checked={printSelectSoal}
                        onChange={(e) => setPrintSelectSoal(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <span className="text-slate-700">Lembar Soal Asesmen</span>
                    </label>

                    <label className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-100 cursor-pointer text-xs font-semibold select-none">
                      <input
                        type="checkbox"
                        checked={printSelectKisi}
                        onChange={(e) => setPrintSelectKisi(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <span className="text-slate-700 font-sans">📋 Kisi-Kisi Asesmen</span>
                    </label>

                    <label className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-100 cursor-pointer text-xs font-semibold select-none">
                      <input
                        type="checkbox"
                        checked={printSelectKunci}
                        onChange={(e) => setPrintSelectKunci(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <span className="text-slate-700 font-sans">🔑 Kunci Jawaban & Rubrik</span>
                    </label>

                    <label className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-100 cursor-pointer text-xs font-semibold select-none">
                      <input
                        type="checkbox"
                        checked={printSelectAnalisis}
                        onChange={(e) => setPrintSelectAnalisis(e.target.checked)}
                        className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                      />
                      <span className="text-slate-700 font-sans">📊 Analisis Pedagogis Guru</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Informational Token Question Area */}
              <div className="bg-emerald-50/50 border border-emerald-100 p-4 rounded-2xl relative overflow-hidden">
                <h4 className="font-extrabold text-emerald-800 text-[10px] uppercase tracking-wide flex items-center gap-1.5 mb-1 bg-white border border-emerald-200 rounded-md py-0.5 px-2 w-fit">
                  ⚡ 0 Token (Gratis)
                </h4>
                <p className="text-[10px] text-slate-800 leading-snug font-bold">
                  Sama sekali tidak memakan token!
                </p>
                <p className="text-[9.5px] text-slate-500 mt-1 leading-relaxed">
                  Proses formatting, margin kertas, dan penataan halaman ini dilakukan 100% secara client-side di dalam browser Anda. Anda bisa mengganti pengaturan sepuasnya tanpa batasan kuota.
                </p>
              </div>

            </div>

             {/* Print and Close Actions Footer */}
            <div className="p-4 border-t border-slate-200/50 flex flex-col gap-2 bg-[#f8fafc]/50">
              <button
                type="button"
                onClick={downloadOfflineHtml}
                className="w-full cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-teal-50 hover:bg-teal-100/80 text-teal-700 border border-teal-200/60 transition-all font-bold text-xs shadow-2xs"
                title="Unduh file halaman web mandiri (.html) untuk dibuka offline"
              >
                <Download className="w-4 h-4 text-teal-600" />
                <span>Unduh File Cetak Offline (.html)</span>
              </button>

              <button
                type="button"
                disabled={isExportingDocx}
                onClick={downloadDocxDocument}
                className="w-full cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100/80 text-blue-700 disabled:opacity-50 border border-blue-200/60 transition-all font-bold text-xs shadow-2xs"
                title="Unduh dokumen Microsoft Word (.docx) resmi"
              >
                <FileText className="w-4 h-4 text-blue-600" />
                <span>{isExportingDocx ? "Mengekspor..." : "Unduh Dokumen Word (.docx)"}</span>
              </button>
              
              <button
                type="button"
                onClick={() => setShowPrintPreviewModal(false)}
                className="w-full cursor-pointer flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-50 transition-all font-bold text-xs shadow-2xs"
              >
                Kembali ke Edit Soal
              </button>
            </div>
          </div>

          {/* Right Area scrollable showing the LIVE PREVIEW WYSIWYG sheet inside safety margins */}
          <div className="flex-1 bg-slate-800 overflow-auto p-4 md:p-8 flex items-start justify-start md:justify-center relative modal-preview-scroller print:p-0 min-h-screen md:min-h-0 w-full">
            <div className="no-print absolute top-4 left-4 z-10 hidden md:flex bg-teal-850/85 hover:bg-teal-900 text-[10px] font-bold text-white px-3.5 py-1.5 rounded-full border border-teal-700/50 backdrop-blur-md shadow-lg select-none items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-teal-300 animate-pulse" />
              <span>Lembar Cetak Sesuai Skala Nyata</span>
            </div>
            
            <div 
              style={{ zoom: `${previewZoom}%` }}
              className="w-[210mm] print:w-full min-h-[297mm] shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-2xl bg-white border-2 border-slate-900 my-8 modal-printable-paper print:my-0 shrink-0"
            >
              {/* Here, we clone and render the EXACT paper content that matches the user print area for WYSIWYG preview! */}
              <div 
                id="printable-paper-sheet"
                className={cn(
                  "w-full text-left custom-font-size-target transition-all duration-300 bg-white rounded-2xl",
                  marginPdf === "small" && "p-6 md:p-10",
                  marginPdf === "medium" && "p-10 md:p-14",
                  marginPdf === "large" && "p-14 md:p-18"
                )}
              >
                {/* 1. SEGMEN LEMBAR SOAL */}
                {printSelectSoal && (
                  <div className="segment-soal">
                    {/* Official standard header */}
                    <div className="exam-header mb-6 relative pb-1">

                      {/* KOP DINAS & SEKOLAH WITH DOUBLE BORDER */}
                      <div className="flex items-center justify-between gap-4 border-b-4 border-slate-950 border-double pb-3.5 mb-4 font-serif">
                        {kopShowLeftLogo && kopLeftLogo && (
                          <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 flex items-center justify-center">
                            <img 
                              src={kopLeftLogo} 
                              alt="Logo Kiri" 
                              className="max-w-full max-h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                        
                        <div className="flex-grow text-center">
                          <h3 className="text-[11px] md:text-xs font-bold uppercase tracking-wide text-slate-700 leading-tight">
                            {kopNamaSekolah}
                          </h3>
                          {kopBarisTambahan1 && (
                            <h3 className="text-[11px] md:text-xs font-bold uppercase tracking-wide text-slate-700 leading-tight mt-0.5">
                              {kopBarisTambahan1}
                            </h3>
                          )}
                          <h2 className="text-sm md:text-base font-extrabold uppercase tracking-wide text-slate-900 leading-snug mt-1 border-b border-dashed border-slate-200 pb-0.5">
                            {kopNamaInstansi}
                          </h2>
                          <p className="text-[8px] md:text-[9px] text-slate-500 italic leading-tight mt-1 font-sans">
                            {kopAlamat}
                          </p>
                          {kopBarisTambahan2 && (
                            <p className="text-[7.5px] md:text-[8px] text-slate-500 italic leading-tight mt-0.5 font-sans">
                              {kopBarisTambahan2}
                            </p>
                          )}
                        </div>

                        {kopShowRightLogo && kopRightLogo && (
                          <div className="w-14 h-14 md:w-16 md:h-16 shrink-0 flex items-center justify-center">
                            <img 
                              src={kopRightLogo} 
                              alt="Logo Kanan" 
                              className="max-w-full max-h-full object-contain"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Assessment Title */}
                      <div className="text-center my-4 font-sans">
                        <h2 className="text-xs md:text-sm font-black font-display text-slate-950 uppercase tracking-widest leading-snug">
                          {customJudulAsesmen || activePackage.title}
                        </h2>
                      </div>

                      {/* Student Details Fields Grid */}
                      {(fieldNamaShow || fieldNomorShow || fieldKelasShow || fieldMapelShow || fieldHariTanggalShow || fieldNilaiShow) && (
                        <div className="mt-5 border-2 border-slate-950 p-3 rounded-lg flex flex-col md:flex-row justify-between gap-4 font-display bg-slate-50/10 mb-6">
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1.5 uppercase font-sans text-[10.5px]">
                            {fieldNamaShow && (
                              <div className="flex items-center gap-2">
                                <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Nama Siswa</span>
                                <span className="font-bold">:</span>
                                <div className="flex-grow h-4 border-b border-dotted border-slate-450 min-w-[120px]" />
                              </div>
                            )}
                            {fieldNomorShow && (
                              <div className="flex items-center gap-2">
                                <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Nomor Absen</span>
                                <span className="font-bold">:</span>
                                <div className="flex-grow h-4 border-b border-dotted border-slate-450 min-w-[120px]" />
                              </div>
                            )}
                            {fieldKelasShow && (
                              <div className="flex items-center gap-2">
                                <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Kelas / Fase</span>
                                <span className="font-bold">:</span>
                                <span className="font-black text-slate-950 underline decoration-dotted">{activePackage.kelas} / {activePackage.fase}</span>
                                <div className="flex-grow h-4 border-b border-dotted border-slate-300 min-w-[20px]" />
                              </div>
                            )}
                            {fieldMapelShow && (
                              <div className="flex items-center gap-2">
                                <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Mata Pelajaran</span>
                                <span className="font-bold">:</span>
                                <span className="font-black text-slate-950 underline decoration-dotted">{activePackage.subject}</span>
                                <div className="flex-grow h-4 border-b border-dotted border-slate-300 min-w-[20px]" />
                              </div>
                            )}
                            {fieldHariTanggalShow && (
                              <div className="flex items-center gap-2">
                                <span className="w-24 shrink-0 font-bold font-serif text-[11px] text-slate-800">Hari / Tanggal</span>
                                <span className="font-bold">:</span>
                                <div className="flex-grow h-4 border-b border-dotted border-slate-450 min-w-[120px]" />
                              </div>
                            )}
                          </div>

                          {/* Score Evaluation Box (NILAI AKHIR) */}
                          {fieldNilaiShow && (
                            <div className="w-24 h-16 border-2 border-slate-900 rounded-lg shrink-0 flex flex-col justify-between overflow-hidden text-center bg-white self-center md:self-stretch">
                              <div className="bg-slate-50 border-b-2 border-slate-900 py-0.5 text-[8px] font-black uppercase tracking-wider text-slate-700 leading-none">
                                NILAI
                              </div>
                              <div className="flex-1" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Question rendering mapping inside modal */}
                    {activePackage.questions.length === 0 ? (
                      <p className="text-xs text-slate-400 italic text-center">Belum ada kompilasi soal.</p>
                    ) : (
                      (() => {
                        const pgQuestions = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda");
                        const pgkQuestions = activePackage.questions.filter((q, idx) => q.type === "Pilihan Ganda Kompleks");
                        const jodohQuestions = activePackage.questions.filter((q, idx) => q.type === "Menjodohkan");
                        const isianQuestions = activePackage.questions.filter((q, idx) => q.type === "Isian Singkat");
                        const uraianQuestions = activePackage.questions.filter((q, idx) => q.type === "Uraian");

                        const renderPreviewQuestionElement = (q: any, groupIndex: number) => (
                          <div key={`q-${q.number}-${groupIndex}`} className="space-y-2 pb-4">
                            <div className="flex items-start gap-1 p-1">
                              <span className="font-bold text-slate-900 text-sm whitespace-nowrap min-w-[1.25rem]">{q.number}.</span>
                              <div className="flex-1 space-y-2 min-w-0">
                                {/* Illustration Render Block if has illustration */}
                                {q.hasIllustration && q.renderedSvg && (
                                  <div className="my-2 mx-auto custom-image-size text-center" dangerouslySetInnerHTML={{ __html: q.renderedSvg }} />
                                )}

                                {(() => {
                                  if (q.type === "Menjodohkan") {
                                    const menjodohkanData = parseMenjodohkan(q.text || "");
                                    if (menjodohkanData.premis.length > 0 && menjodohkanData.responses.length > 0) {
                                      const maxRows = Math.max(menjodohkanData.premis.length, menjodohkanData.responses.length);
                                      const rows = Array.from({ length: maxRows });
                                      return (
                                        <div className="space-y-3">
                                          <QuestionTextRenderer text={menjodohkanData.introduction || ""} tableSize={tableSize} />
                                          <div className="overflow-x-auto border-2 border-slate-950 rounded-xl bg-white shadow-xs my-2.5 max-w-full">
                                            <table className="w-full border-collapse text-left text-xs table-fixed">
                                              <thead>
                                                <tr className="bg-slate-50 border-b-2 border-slate-950 text-slate-800 font-bold text-[10px] tracking-wide">
                                                  <th className="p-2.5 w-1/2 border-r-2 border-slate-950">
                                                    <span>{menjodohkanData.responsesHeader}</span>
                                                  </th>
                                                  <th className="p-2.5 w-1/2">
                                                    <span>{menjodohkanData.premisHeader}</span>
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-350 text-slate-800">
                                                {rows.map((_, i) => {
                                                  const resp = menjodohkanData.responses[i];
                                                  const prem = menjodohkanData.premis[i];
                                                  return (
                                                    <tr key={i} className="hover:bg-slate-50/20 transition-colors">
                                                      {/* Left Column (Jawaban) */}
                                                      <td className="p-2.5 border-r-2 border-slate-950 align-middle">
                                                        {resp ? (
                                                          <div className="flex items-center justify-between gap-1.5">
                                                            <div className="flex items-center gap-1.5 min-w-0">
                                                              <span className="w-4.5 h-4.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200/50 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono shadow-3xs">
                                                                {resp.key}
                                                              </span>
                                                              <span className="text-[11px] text-slate-700 font-medium leading-normal break-words">{resp.text}</span>
                                                            </div>
                                                            {/* Connector point */}
                                                            <div className="w-2 h-2 rounded-full bg-slate-400 border border-slate-600 shrink-0" />
                                                          </div>
                                                        ) : <div className="h-4" />}
                                                      </td>

                                                      {/* Right Column (Premis) */}
                                                      <td className="p-2.5 align-middle">
                                                        {prem ? (
                                                          <div className="flex items-center justify-between gap-1.5 flex-row-reverse">
                                                            <div className="flex items-center gap-1.5 flex-row-reverse justify-end min-w-0 flex-grow">
                                                              <span className="w-4.5 h-4.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center font-bold text-[10px] shrink-0 font-mono shadow-3xs">
                                                                {prem.key}
                                                              </span>
                                                              <span className="text-[11px] text-slate-700 font-bold leading-normal break-words text-right flex-grow">{prem.text}</span>
                                                            </div>
                                                            {/* Connector point */}
                                                            <div className="w-2 h-2 rounded-full bg-slate-400 border border-slate-600 shrink-0" />
                                                          </div>
                                                        ) : <div className="h-4" />}
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                              </tbody>
                                            </table>
                                          </div>
                                        </div>
                                      );
                                    }
                                  }
                                  return <QuestionTextRenderer text={q.text || ""} tableSize={tableSize} />;
                                })()}

                                {/* Options block */}
                                {q.options && q.options.length > 0 && (
                                  <div className={cn(
                                    layoutMcq === "vertical" && "grid grid-cols-1 gap-2 pl-1",
                                    layoutMcq === "grid-2" && "grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-1",
                                    layoutMcq === "horizontal" && "flex flex-wrap gap-x-6 gap-y-1.5 pl-1"
                                  )}>
                                    {q.options.map((opt: string, optIdx: number) => (
                                      <div
                                        key={`opt-${optIdx}`}
                                        className={cn(
                                          "rounded-xl font-medium flex items-center gap-2 transition-all text-slate-800 text-xs",
                                          layoutMcq === "horizontal" 
                                            ? "p-1.5 px-2 bg-transparent border-none" 
                                            : "p-2.5 border border-slate-100 bg-slate-50/40"
                                        )}
                                      >
                                        <div className="w-5 h-5 rounded-full border border-slate-350 flex items-center justify-center shrink-0 font-bold text-[10px] text-slate-500 bg-white shadow-xs">
                                          {opt[0]}
                                        </div>
                                        <span>{opt.substring(2)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );

                        return (
                          <div className="space-y-6">
                            {/* BAGIAN I Soal PG */}
                            {pgQuestions.length > 0 && (
                              <div className="space-y-4">
                                <div className="border-b-2 border-slate-900 pb-1 mb-2">
                                  <h3 className="text-xs font-black text-slate-950 uppercase tracking-widest">BAGIAN I: PILIHAN GANDA</h3>
                                  <p className="text-[10px] text-slate-500 italic">Pilihlah salah satu jawaban yang paling tepat pada lembar jawaban Anda.</p>
                                </div>
                                <div className="space-y-4 division-pg">
                                  {pgQuestions.map((q, idx) => renderPreviewQuestionElement(q, idx))}
                                </div>
                              </div>
                            )}

                            {/* BAGIAN II Soal PGK */}
                            {pgkQuestions.length > 0 && (
                              <div className="space-y-4 pt-4">
                                <div className="border-b-2 border-slate-900 pb-1 mb-2">
                                  <h3 className="text-xs font-black text-slate-950 uppercase tracking-widest">BAGIAN II: PILIHAN GANDA KOMPLEKS</h3>
                                  <p className="text-[10px] text-slate-500 italic">Pilihlah satu atau lebih jawaban yang tepat pada lembar jawaban Anda.</p>
                                </div>
                                <div className="space-y-4">
                                  {pgkQuestions.map((q, idx) => renderPreviewQuestionElement(q, idx))}
                                </div>
                              </div>
                            )}

                            {/* BAGIAN III Soal Menjodohkan */}
                            {jodohQuestions.length > 0 && (
                              <div className="space-y-4 pt-4">
                                <div className="border-b-2 border-slate-900 pb-1 mb-2">
                                  <h3 className="text-xs font-black text-slate-950 uppercase tracking-widest">BAGIAN III: MENJODOHKAN</h3>
                                  <p className="text-[10px] text-slate-500 italic">Pasangkanlah pernyataan di sebelah kiri (premis) dengan pilihan di sebelah kanan yang sesuai.</p>
                                </div>
                                <div className="space-y-4">
                                  {jodohQuestions.map((q, idx) => renderPreviewQuestionElement(q, idx))}
                                </div>
                              </div>
                            )}

                            {/* BAGIAN IV Soal Isian */}
                            {isianQuestions.length > 0 && (
                              <div className="space-y-4 pt-4">
                                <div className="border-b-2 border-slate-900 pb-1 mb-2">
                                  <h3 className="text-xs font-black text-slate-950 uppercase tracking-widest">BAGIAN IV: ISIAN SINGKAT</h3>
                                  <p className="text-[10px] text-slate-500 italic">Isilah titik-titik di bawah ini dengan jawaban yang singkat, padat, dan benar.</p>
                                </div>
                                <div className="space-y-4">
                                  {isianQuestions.map((q, idx) => renderPreviewQuestionElement(q, idx))}
                                </div>
                              </div>
                            )}

                            {/* BAGIAN V Soal Uraian */}
                            {uraianQuestions.length > 0 && (
                              <div className="space-y-4 pt-4">
                                <div className="border-b-2 border-slate-900 pb-1 mb-2">
                                  <h3 className="text-xs font-black text-slate-950 uppercase tracking-widest">BAGIAN V: URAIAN / ESSAY</h3>
                                  <p className="text-[10px] text-slate-500 italic">Jawablah pertanyaan berikut secara lengkap disertai dengan langkah penalaran yang tepat.</p>
                                </div>
                                <div className="space-y-4">
                                  {uraianQuestions.map((q, idx) => renderPreviewQuestionElement(q, idx))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()
                    )}
                  </div>
                )}

                {/* 2. SEGMEN KISI-KISI ASESMEN */}
                {printSelectKisi && (
                  <div style={{ pageBreakBefore: printSelectSoal ? "always" : "auto" }} className={cn("segment-kisi", printSelectSoal && "mt-12 print:mt-0 pt-8 print:pt-0 border-t border-slate-200/80 print:border-none")}>
                    <div className="border-b-2 border-slate-950 pb-2 mb-4">
                      <h2 className="text-sm font-black uppercase text-slate-900 tracking-wide font-sans">KISI-KISI ASESMEN SEKOLAH</h2>
                      <p className="text-[10px] text-slate-500 italic mt-1 uppercase font-bold tracking-tight">
                        {activePackage.subject} • KELAS {activePackage.kelas} / {activePackage.fase}
                      </p>
                    </div>

                    <div className="overflow-x-auto border-2 border-slate-950 rounded-lg bg-white mt-4">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b-2 border-slate-950 text-slate-900 font-extrabold text-[10px]">
                            <th className="p-2.5 text-center w-12 border-r border-slate-300">No. Soal</th>
                            <th className="p-2.5 w-28 border-r border-slate-300">Bentuk Soal</th>
                            <th className="p-2.5 w-32 border-r border-slate-300">Materi Pokok</th>
                            <th className="p-2.5 border-r border-slate-300">Indikator Kisi-Kisi & Stimulus Asesmen</th>
                            <th className="p-2.5 w-32 border-r border-slate-300">Level Taksonomi ({taksonomi})</th>
                            <th className="p-2.5 w-32 border-r border-slate-300">Dimensi Profil Lulusan</th>
                            <th className="p-2.5 text-center w-16">Skor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 text-slate-800 text-[10px]">
                          {activePackage.questions.map((q, idx) => {
                            let bobot = "1";
                            if (q.type === "Pilihan Ganda Kompleks") bobot = "2";
                            else if (q.type === "Menjodohkan") bobot = "3";
                            else if (q.type === "Isian Singkat") bobot = "2";
                            else if (q.type === "Uraian") bobot = "5";

                            return (
                              <tr key={`printtable-${q.number}`} className="bg-white">
                                <td className="p-2.5 text-center font-bold text-slate-900 border-r border-slate-300 font-mono">{q.number}</td>
                                <td className="p-2.5 border-r border-slate-300 font-semibold">{q.type}</td>
                                <td className="p-2.5 border-r border-slate-300 font-medium font-sans text-[9.5px] text-slate-900 break-words leading-tight">
                                  {q.materiTopik || activePackage.subject || "Materi Kurikulum"}
                                </td>
                                <td className="p-2.5 border-r border-slate-300 leading-relaxed break-words font-sans">
                                  <div className="space-y-1">
                                    <div>
                                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">Indikator Soal:</span>
                                      <p className="text-[9.5px] leading-relaxed text-slate-900 font-medium bg-slate-50 p-1.5 rounded border border-slate-200">
                                        {q.indikatorSoal || `Disajikan stimulus kontekstual, peserta didik dapat menyelesaikan persoalan berkaitan dengan tema ${activePackage.subject || "pembelajaran"} pada tingkatan kognitif ${q.taxonomyLevel || "terkait"} secara mandiri dengan tepat.`}
                                      </p>
                                    </div>
                                    <div>
                                      <span className="text-[8px] uppercase tracking-wider font-extrabold text-slate-400 block mb-0.5">Stimulus Asesmen:</span>
                                      <p className="text-[9px] leading-relaxed text-slate-500 font-mono italic">
                                        {q.stimulusAsesmen || "Kasus atau skenario kontekstual terintegrasi."}
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-2.5 border-r border-slate-300 font-sans break-words">
                                  <span className="text-slate-900 font-bold block">{q.taxonomyLevel}</span>
                                  <span className="text-[9px] text-slate-500 block leading-tight">{q.taxonomyAnalysis}</span>
                                </td>
                                <td className="p-2.5 border-r border-slate-300 font-bold text-teal-700">
                                  {q.profilLulusanDimensi}
                                </td>
                                <td className="p-2.5 text-center font-bold text-slate-900 font-mono">
                                  {bobot}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* 3. SEGMEN KUNCI JAWABAN & RUBRIK */}
                {printSelectKunci && (
                  <div style={{ pageBreakBefore: (printSelectSoal || printSelectKisi) ? "always" : "auto" }} className={cn("segment-kunci", (printSelectSoal || printSelectKisi) && "mt-12 print:mt-0 pt-8 print:pt-0 border-t border-slate-200/80 print:border-none")}>
                    <div className="border-b-2 border-slate-950 pb-2 mb-4">
                      <h2 className="text-sm font-black uppercase text-slate-900 tracking-wide font-sans">KUNCI JAWABAN & PEDOMAN PENSKORAN (RUBRIK)</h2>
                      <p className="text-[10px] text-slate-500 italic mt-1 uppercase font-bold tracking-tight">
                        {activePackage.subject} • KELAS {activePackage.kelas} / {activePackage.fase}
                      </p>
                    </div>

                    <div className="space-y-4 mt-4 text-[10px]">
                      {activePackage.questions.map((q, idx) => {
                        const isPg = q.type === "Pilihan Ganda" || q.type === "Pilihan Ganda Kompleks" || q.type === "Menjodohkan";
                        return (
                          <div key={`printkey-${q.number}`} className="p-3.5 rounded-xl border-2 border-slate-950 bg-white space-y-2 break-inside-avoid shadow-xs">
                            <div className="flex items-center justify-between border-b border-slate-300 pb-1 flex-wrap gap-1">
                              <span className="font-bold text-[11px] text-slate-950 font-sans">
                                No. {q.number} ({q.type})
                              </span>
                              <span className="text-[8.5px] font-bold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-tight">
                                {q.taxonomyLevel}
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 font-sans">
                              <div className="md:col-span-5 space-y-1">
                                <h5 className="font-extrabold text-slate-450 uppercase tracking-wider text-[8px]">{isPg ? "Kunci Jawaban & Opsi:" : "Solusi / Jawaban Ideal:"}</h5>
                                <p className="text-slate-900 bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 font-mono whitespace-pre-line font-bold text-[10.5px] leading-relaxed select-all">{q.correctAnswer}</p>
                              </div>
                              <div className="md:col-span-7 space-y-1 md:border-l md:border-slate-300 md:pl-4">
                                <h5 className="font-extrabold text-teal-700 uppercase tracking-wider text-[8px]">{isPg ? "Pembahasan Soal:" : "Rubrik & Kriteria Skor:"}</h5>
                                <p className="text-slate-800 whitespace-pre-line text-[10px] leading-relaxed">{q.rubrikAsesmen}</p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 4. SEGMEN ANALISIS PEDAGOGIS GURU */}
                {printSelectAnalisis && (
                  <div style={{ pageBreakBefore: (printSelectSoal || printSelectKisi || printSelectKunci) ? "always" : "auto" }} className={cn("segment-analisis", (printSelectSoal || printSelectKisi || printSelectKunci) && "mt-12 print:mt-0 pt-8 print:pt-0 border-t border-slate-200/80 print:border-none")}>
                    <div className="border-b-2 border-slate-950 pb-2 mb-4">
                      <h2 className="text-sm font-black uppercase text-slate-950 tracking-wide font-sans">ANALISIS PEDAGOGIS & AKUNTABILITAS SOAL</h2>
                      <p className="text-[10px] text-slate-500 italic mt-1 uppercase font-bold tracking-tight font-sans">
                        {activePackage.subject} • KELAS {activePackage.kelas} / {activePackage.fase}
                      </p>
                    </div>

                    {(() => {
                      const { staticBarChartHtml, staticDonutChartHtml } = generateStaticChartsHtml(activePackage.questions, taksonomi, soloLevels, bloomLevels);
                      return (
                        <div className="flex gap-5 mb-6 print:break-inside-avoid">
                          <div className="flex-1 border border-slate-300 p-4 rounded-lg bg-white" dangerouslySetInnerHTML={{ __html: staticBarChartHtml }} />
                          <div className="flex-1 border border-slate-300 p-4 rounded-lg bg-white" dangerouslySetInnerHTML={{ __html: staticDonutChartHtml }} />
                        </div>
                      );
                    })()}

                    <div className="overflow-x-auto border-2 border-slate-950 rounded-lg bg-white mt-4">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b-2 border-slate-950 text-slate-900 font-extrabold text-[10px]">
                            <th className="p-2.5 text-center w-12 border-r border-slate-300">No.</th>
                            <th className="p-2.5 border-r border-slate-300">Level Taksonomi ({taksonomi}) & Analisis Capaian</th>
                            <th className="p-2.5">Dimensi Profil Lulusan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 text-slate-800 leading-relaxed text-[10px] bg-white font-sans">
                          {activePackage.questions.map((q, idx) => (
                            <tr key={`printtable-${q.number}`} className="bg-white">
                              <td className="p-2.5 text-center font-bold text-slate-900 border-r border-slate-300 bg-slate-50/20 font-mono">
                                {q.number}
                              </td>
                              <td className="p-2.5 border-r border-slate-300 space-y-1">
                                <span className="font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 text-[8.5px] uppercase">
                                  {q.taxonomyLevel}
                                </span>
                                <p className="text-slate-650 mt-1 leading-relaxed text-[10px]">{q.taxonomyAnalysis}</p>
                              </td>
                              <td className="p-2.5 space-y-1">
                                <span className="font-bold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 text-[8.5px]">
                                  {q.profilLulusanDimensi}
                                </span>
                                <p className="text-slate-650 mt-1 leading-relaxed text-[10px]">{q.prinsipPM}</p>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Humble Footer */}
      <footer className="no-print border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-400">
        <a 
          href="https://instagram.com/ini_ewan" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:text-teal-600 transition-colors font-medium inline-flex items-center gap-1 cursor-pointer"
        >
          Irwan Taufiqurrahman - 2026
        </a>
      </footer>

    </div>
  );
}
