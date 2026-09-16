import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css"; // Global styles

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ngide Soal N Version - Generator Asesmen Pembelajaran Mendalam",
  description: "Platform AI pintar bagi guru Indonesia untuk merancang soal ujian dan rubrik berbasis pendekatan Pembelajaran Mendalam (Deep Learning) secara sistematis.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${inter.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable} scroll-smooth`}
    >
      <body className="font-sans antialiased text-slate-900 bg-slate-50 min-h-screen selection:bg-teal-100 selection:text-teal-900" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

