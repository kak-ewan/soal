import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

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
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "No prompt provided" }, { status: 400 });
    }

    const ai = getAiClient();

    // Use gemini-2.5-flash-image to generate a standard raster image (free/fast tier)
    const imageInstruction = `Beautiful playful flat cartoon illustration for school books, vibrant colors, clean, pleasant, highly educational, kid-friendly look, soft background, no letters, no text overlays, lovely and simple. Scene: "${prompt}"`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: imageInstruction,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "4:3",
        },
      },
    });

    let base64Image = "";
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts && parts.length > 0) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          base64Image = part.inlineData.data;
          break;
        }
      }
    }

    if (!base64Image) {
      throw new Error("Gemini did not return any image data parts.");
    }

    const htmlImg = `<img src="data:image/jpeg;base64,${base64Image}" alt="Ilustrasi Soal" class="w-full h-full object-contain rounded-xl" style="max-height: 100%; max-width: 100%; object-fit: contain; display: block; margin: 0 auto;" referrerPolicy="no-referrer" />`;

    return NextResponse.json({ svg: htmlImg });
  } catch (error: any) {
    console.error("Generate Image error, attempting fallback:", error);

    // Dynamic high-availability fallback: if image model is restricted/exhausted (limit: 0 on free keys),
    // use the highly permissive text model gemini-3.5-flash to write an artistic, gorgeous inline SVG.
    try {
      const ai = getAiClient();
      const fallbackPrompt = `
Anda adalah seorang professional SVG designer dan ilustrator buku pelajaran anak sekolah dasar.
Karena akses gambar standard berbayar/quota akun penuh, tugas Anda adalah membuat kode SVG murni inline yang indah, responsif, modern, ceria, dan sesuai dengan deskripsi cerita berikut: "${prompt}".

Karakteristik Ilustrasi SVG yang Indah & Profesional:
1. Pastikan valid dan murni:
   - Mulai dengan tag: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="100%" height="100%">
   - Tutup dengan </svg>.
   - Gunakan kombinasi bentuk: <rect>, <circle>, <path>, <polygon>, <ellipse>, <g> yang berlayer secara estetik.
2. Warna & Nuansa:
   - Gunakan latar belakang penuh berwarna manis/lembut pastel (misalnya <rect width="100%" height="100%" rx="16" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/> atau gradien warna linear) agar gambar terlihat seperti kartu cetakan eksklusif.
   - Gunakan gradasi warna linear/radial (<linearGradient>) dalam defs untuk memberikan efek dimensional berbayang yang cantik.
3. Objek Cerita:
   - Gambarkan subjek utama (misalnya buah, hewan ceria, buku, angka, pohon, anak-anak melambai) secara indah dengan gaya kartun yang menggemaskan, bermata bulat imut (circle), dan tersenyum ceria (gaya kawaii / anak sekolah).
4. JANGAN pernak ketik teks huruf alfabet latin di dalam kanvas SVG melainkan gunakan murni elemen seni grafis.
5. Kembalikan HANYA format JSON valid dengan satu properti string bernama "svgCode". JANGAN selipkan pembungkus markdown penanda kode.
`.trim();

      const fallbackResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: fallbackPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["svgCode"],
            properties: {
              svgCode: {
                type: Type.STRING,
                description: "Kode XML SVG responsif lengkap (diawali <svg... dan diakhiri </svg>) tanpa karakter escape atau formatting markdown."
              }
            }
          }
        },
      });

      const outputText = fallbackResponse.text;
      if (outputText) {
        const parsed = JSON.parse(outputText.trim());
        if (parsed.svgCode && parsed.svgCode.includes("<svg")) {
          return NextResponse.json({ 
            svg: parsed.svgCode, 
            warning: "Berhasil dialihkan ke model cadangan grafis vektor gratis!",
            quotaExceeded: true 
          });
        }
      }
    } catch (fallbackError) {
      console.error("SVG Fallback failed too:", fallbackError);
    }

    // Return a neat local illustrative fallback frame so the application never breaks visually
    const fallbackHtml = `
<div style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 12px; padding: 16px; text-align: center; box-sizing: border-box;">
  <span style="font-size: 24px; margin-bottom: 8px;">🎨</span>
  <span style="font-family: system-ui, sans-serif; font-size: 13px; font-weight: bold; color: #1e293b;">Ilustrasi Pembelajaran</span>
  <span style="font-family: system-ui, sans-serif; font-size: 10px; color: #64748b; margin-top: 4px; max-width: 250px;">Kuota generator gambar di akun Anda dibatasi oleh server Google (RESOURCE_EXHAUSTED). Anda bisa menyalin prompt, membuatnya di Canva/Bing secara gratis, lalu mengunggahnya ke sini.</span>
</div>
    `.trim();
    return NextResponse.json({ svg: fallbackHtml, warning: error?.message, quotaExceeded: true });
  }
}

