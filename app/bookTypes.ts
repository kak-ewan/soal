export interface SibiChapter {
  no: number;
  title: string;
  pages: string;
  topics: string[];
}

export interface SibiBook {
  id: string;
  title: string;
  subtitle: string;
  jenjang: string;
  kelas: string;
  subject: string;
  author: string;
  publisher: string;
  year: string;
  coverStyle: string; // Tailwind class colors
  coverUrl?: string; // Optional real image path
  chapters: SibiChapter[];
}
