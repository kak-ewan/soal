import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeadingLevel,
  VerticalAlign,
} from "docx";

// --- SELF-CONTAINED MARKDOWN & STRUCTURAL PARSING HELPERS ---

interface QuestionBlock {
  type: "text" | "table";
  content: string | string[][];
}

function parseTextWithTables(text: string): QuestionBlock[] {
  if (!text) return [];
  
  let normalized = text
    .replace(/\\n/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/\r\n/g, "\n");

  if (normalized.includes("|")) {
    normalized = normalized
      .replace(/([a-z])([A-Z][a-z])/g, "$1\n$2")
      .replace(/(\d+)([A-Z][a-z])/g, "$1\n$2")
      .replace(/:([A-Z][a-z])/g, ":\n$1");
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
        currentTableRows.forEach((row) => {
          textBuffer.push(row.join(" | "));
        });
        currentTableRows = [];
      } else {
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

    const numMatch = trimmed.match(/^(\d{1,3})\s*[\.\)\]]\s*(.+)$/);
    const charMatch = trimmed.match(/^([a-zA-Z])\s*[\.\)\]]\s*(.+)$/);

    if (numMatch && (inPremisSection || !inResponsesSection)) {
      premis.push({ key: numMatch[1], text: numMatch[2].trim() });
    } else if (charMatch && (inResponsesSection || /^[a-zA-Z]$/.test(charMatch[1]))) {
      responses.push({ key: charMatch[1].toUpperCase(), text: charMatch[2].trim() });
    } else {
      introductionLines.push(line);
    }
  }

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

  return {
    introduction: introductionLines.join("\n"),
    premis,
    responses,
    premisHeader,
    responsesHeader,
  };
}

// Inline Markdown parser inside runs
function parseInlineMarkdown(text: string, defaultFontSize = 22): TextRun[] {
  if (!text) return [];
  
  // Replace HTML-like italic indicators if present
  let cleanText = text
    .replace(/<\/?em>/g, "*")
    .replace(/<\/?strong>/g, "**");

  const boldParts = cleanText.split("**");
  const runs: TextRun[] = [];

  boldParts.forEach((boldPart, bIdx) => {
    const isBold = bIdx % 2 !== 0;
    const italicParts = boldPart.split("*");
    
    italicParts.forEach((italicPart, iIdx) => {
      const isItalic = iIdx % 2 !== 0;
      if (italicPart) {
        runs.push(
          new TextRun({
            text: italicPart,
            bold: isBold,
            italics: isItalic,
            font: "Arial",
            size: defaultFontSize,
          })
        );
      }
    });
  });

  return runs;
}

// Converts complete text with markdown structures and tables into docx elements
function parseMarkdownToDocx(text: string, defaultFontSize = 22): (Paragraph | Table)[] {
  if (!text) return [];
  
  const blocks = parseTextWithTables(text);
  const elements: (Paragraph | Table)[] = [];

  blocks.forEach((block) => {
    if (block.type === "text") {
      const blockText = block.content as string;
      const lines = blockText.split("\n");
      
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed) {
          elements.push(
            new Paragraph({
              children: [],
              spacing: { after: 100 },
            })
          );
          return;
        }

        // Headers
        if (trimmed.startsWith("## ")) {
          elements.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_2,
              children: parseInlineMarkdown(trimmed.substring(3), defaultFontSize + 4),
              spacing: { before: 180, after: 100 },
            })
          );
        } else if (trimmed.startsWith("# ")) {
          elements.push(
            new Paragraph({
              heading: HeadingLevel.HEADING_1,
              children: parseInlineMarkdown(trimmed.substring(2), defaultFontSize + 8),
              spacing: { before: 240, after: 140 },
            })
          );
        } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          // Bullet point
          elements.push(
            new Paragraph({
              children: parseInlineMarkdown(trimmed.substring(2), defaultFontSize),
              bullet: { level: 0 },
              spacing: { after: 60 },
            })
          );
        } else {
          // Numbered list: "1. "
          const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
          if (numMatch) {
            elements.push(
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${numMatch[1]}. `,
                    bold: true,
                    font: "Arial",
                    size: defaultFontSize,
                  }),
                  ...parseInlineMarkdown(numMatch[2], defaultFontSize),
                ],
                spacing: { after: 80 },
              })
            );
          } else {
            // Regular Paragraph
            elements.push(
              new Paragraph({
                children: parseInlineMarkdown(line, defaultFontSize),
                spacing: { after: 100 },
              })
            );
          }
        }
      });
    } else {
      // Markdown Table
      const rows = block.content as string[][];
      if (rows.length > 0) {
        const maxCols = Math.max(...rows.map(r => r.length), 1);
        const tableRows = rows.map((row, rIdx) => {
          const cells = row.map((cellText) => {
            return new TableCell({
              children: [
                new Paragraph({
                  children: parseInlineMarkdown(cellText, defaultFontSize - 2),
                  spacing: { after: 0, before: 0 },
                })
              ],
              shading: rIdx === 0 ? { fill: "F1F5F9" } : undefined, // Light slate gray background for headers
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
              },
              verticalAlign: VerticalAlign.CENTER,
              margins: {
                top: 80,
                bottom: 80,
                left: 120,
                right: 120,
              }
            });
          });

          // Pad shorter rows
          while (cells.length < maxCols) {
            cells.push(new TableCell({
              children: [new Paragraph("")],
              borders: {
                top: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
                bottom: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
              }
            }));
          }

          return new TableRow({
            children: cells
          });
        });

        elements.push(
          new Table({
            rows: tableRows,
            width: {
              size: 100,
              type: WidthType.PERCENTAGE
            }
          })
        );
        elements.push(
          new Paragraph({
            children: [],
            spacing: { after: 180 }
          })
        );
      }
    }
  });

  return elements;
}

// --- POST API ENDPOINT ---

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const {
      title,
      kop,
      identity,
      questions = [],
      printSelectSoal = true,
      printSelectKisi = false,
      printSelectKunci = false,
      printSelectAnalisis = false,
      subject = "Asesmen",
      kelas = "",
      fase = "",
      taksonomi = "BLOOM"
    } = payload;

    const childrenElements: (Paragraph | Table)[] = [];

    // 1. LEMBAR SOAL SEGMENT
    if (printSelectSoal) {
      // Kop Dinas
      if (kop) {
        const kopRows: TableRow[] = [
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: kop.namaSekolah,
                        bold: true,
                        size: 22,
                        font: "Arial",
                      })
                    ],
                    spacing: { after: 20 },
                  }),
                  ...(kop.barisTambahan1 ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: kop.barisTambahan1,
                          bold: true,
                          size: 22,
                          font: "Arial",
                        })
                      ],
                      spacing: { after: 20 },
                    })
                  ] : []),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: kop.namaInstansi,
                        bold: true,
                        size: 26,
                        font: "Arial",
                      })
                    ],
                    spacing: { after: 40 },
                  }),
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun({
                        text: kop.alamat,
                        italics: true,
                        size: 18,
                        font: "Arial",
                      })
                    ],
                    spacing: { after: 20 },
                  }),
                  ...(kop.barisTambahan2 ? [
                    new Paragraph({
                      alignment: AlignmentType.CENTER,
                      children: [
                        new TextRun({
                          text: kop.barisTambahan2,
                          italics: true,
                          size: 18,
                          font: "Arial",
                        })
                      ],
                      spacing: { after: 20 },
                    })
                  ] : [])
                ],
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.DOUBLE, size: 18, color: "000000" },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                },
                margins: {
                  bottom: 120,
                }
              })
            ]
          })
        ];

        childrenElements.push(
          new Table({
            rows: kopRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
          })
        );
        
        // Spacing below KOP
        childrenElements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
      }

      // Title
      childrenElements.push(
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({
              text: title || "LEMBAR ASESMEN SISWA",
              bold: true,
              size: 26,
              font: "Arial",
            })
          ],
          spacing: { after: 160 },
        })
      );

      // Identity Box Table
      if (identity && identity.length > 0) {
        const identityRows = identity.map((item: any) => {
          return new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: item.key,
                        bold: true,
                        font: "Arial",
                        size: 20,
                      })
                    ]
                  })
                ],
                width: { size: 28, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                }
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `:  ${item.value || "...................................................."}`,
                        font: "Arial",
                        size: 20,
                      })
                    ]
                  })
                ],
                width: { size: 72, type: WidthType.PERCENTAGE },
                borders: {
                  top: { style: BorderStyle.NONE },
                  bottom: { style: BorderStyle.NONE },
                  left: { style: BorderStyle.NONE },
                  right: { style: BorderStyle.NONE },
                }
              })
            ]
          });
        });

        childrenElements.push(
          new Table({
            rows: identityRows,
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
              bottom: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
              left: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
              right: { style: BorderStyle.SINGLE, size: 8, color: "1E293B" },
            },
            margins: {
              top: 100,
              bottom: 100,
              left: 140,
              right: 140,
            }
          })
        );

        // Spacing below identity
        childrenElements.push(new Paragraph({ children: [], spacing: { after: 240 } }));
      }

      // Filter and render active questions
      const pgQuestions = questions.filter((q: any) => q.type === "Pilihan Ganda");
      const pgkQuestions = questions.filter((q: any) => q.type === "Pilihan Ganda Kompleks");
      const jodohQuestions = questions.filter((q: any) => q.type === "Menjodohkan");
      const isianQuestions = questions.filter((q: any) => q.type === "Isian Singkat");
      const uraianQuestions = questions.filter((q: any) => q.type === "Uraian");

      // Render PG Block
      if (pgQuestions.length > 0) {
        childrenElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "BAGIAN I: PILIHAN GANDA",
                bold: true,
                size: 24,
                font: "Arial",
              })
            ],
            spacing: { before: 120, after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Pilihlah salah satu jawaban yang paling tepat pada lembar jawaban Anda.",
                italics: true,
                size: 18,
                font: "Arial",
              })
            ],
            spacing: { after: 180 },
          })
        );

        pgQuestions.forEach((q: any) => {
          // Render question number and content
          const questionTextElements = parseMarkdownToDocx(`${q.number}. ${q.text || ""}`);
          childrenElements.push(...questionTextElements);

          // Options layout
          if (q.options && q.options.length > 0) {
            q.options.forEach((opt: string) => {
              childrenElements.push(
                new Paragraph({
                  children: parseInlineMarkdown(opt),
                  indent: { left: 360 }, // indent option A., B., etc.
                  spacing: { after: 60 },
                })
              );
            });
          }
          // Spacing after each question
          childrenElements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        });
      }

      // Render PGK Block
      if (pgkQuestions.length > 0) {
        childrenElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "BAGIAN II: PILIHAN GANDA KOMPLEKS",
                bold: true,
                size: 24,
                font: "Arial",
              })
            ],
            spacing: { before: 180, after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Pilihlah satu atau lebih jawaban yang tepat pada lembar jawaban Anda.",
                italics: true,
                size: 18,
                font: "Arial",
              })
            ],
            spacing: { after: 180 },
          })
        );

        pgkQuestions.forEach((q: any) => {
          const questionTextElements = parseMarkdownToDocx(`${q.number}. ${q.text || ""}`);
          childrenElements.push(...questionTextElements);

          if (q.options && q.options.length > 0) {
            q.options.forEach((opt: string) => {
              childrenElements.push(
                new Paragraph({
                  children: parseInlineMarkdown(opt),
                  indent: { left: 360 },
                  spacing: { after: 60 },
                })
              );
            });
          }
          childrenElements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        });
      }

      // Render Menjodohkan Block
      if (jodohQuestions.length > 0) {
        childrenElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "BAGIAN III: MENJODOHKAN",
                bold: true,
                size: 24,
                font: "Arial",
              })
            ],
            spacing: { before: 180, after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Pasangkanlah pernyataan di sebelah kiri (premis) dengan pilihan di sebelah kanan yang sesuai.",
                italics: true,
                size: 18,
                font: "Arial",
              })
            ],
            spacing: { after: 180 },
          })
        );

        jodohQuestions.forEach((q: any) => {
          const matchingData = parseMenjodohkan(q.text || "");
          
          const introElements = parseMarkdownToDocx(`${q.number}. ${matchingData.introduction || ""}`);
          childrenElements.push(...introElements);

          // Build dual matching table
          if (matchingData.premis.length > 0 && matchingData.responses.length > 0) {
            const maxRows = Math.max(matchingData.premis.length, matchingData.responses.length);
            const tableRows: TableRow[] = [];

            // Add Header Row for matching
            tableRows.push(
              new TableRow({
                children: [
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: matchingData.responsesHeader || "Pilihan Jawaban (Kiri)",
                            bold: true,
                            font: "Arial",
                            size: 18,
                          })
                        ],
                      })
                    ],
                    shading: { fill: "F1F5F9" },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                      bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                      left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                      right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                    },
                    margins: { top: 80, bottom: 80, left: 100, right: 100 }
                  }),
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: matchingData.premisHeader || "Pernyataan / Premis (Kanan)",
                            bold: true,
                            font: "Arial",
                            size: 18,
                          })
                        ],
                      })
                    ],
                    shading: { fill: "F1F5F9" },
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                      bottom: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                      left: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                      right: { style: BorderStyle.SINGLE, size: 6, color: "000000" },
                    },
                    margins: { top: 80, bottom: 80, left: 100, right: 100 }
                  })
                ]
              })
            );

            for (let i = 0; i < maxRows; i++) {
              const resp = matchingData.responses[i];
              const prem = matchingData.premis[i];

              tableRows.push(
                new TableRow({
                  children: [
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: resp ? [
                            new TextRun({
                              text: `[ ${resp.key} ]  `,
                              bold: true,
                              font: "Consolas",
                              size: 18,
                            }),
                            ...parseInlineMarkdown(resp.text, 18),
                          ] : [],
                        })
                      ],
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                        left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                        right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                      },
                      margins: { top: 60, bottom: 60, left: 100, right: 100 }
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({
                          children: prem ? [
                            new TextRun({
                              text: `[ ${prem.key} ]  `,
                              bold: true,
                              font: "Consolas",
                              size: 18,
                            }),
                            ...parseInlineMarkdown(prem.text, 18),
                          ] : [],
                        })
                      ],
                      borders: {
                        top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                        bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                        left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                        right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                      },
                      margins: { top: 60, bottom: 60, left: 100, right: 100 }
                    })
                  ]
                })
              );
            }

            childrenElements.push(
              new Table({
                rows: tableRows,
                width: { size: 100, type: WidthType.PERCENTAGE }
              })
            );
            childrenElements.push(
              new Paragraph({
                children: [],
                spacing: { after: 180 }
              })
            );
          }
          childrenElements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        });
      }

      // Render Isian Block
      if (isianQuestions.length > 0) {
        childrenElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "BAGIAN IV: ISIAN SINGKAT",
                bold: true,
                size: 24,
                font: "Arial",
              })
            ],
            spacing: { before: 180, after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Isilah titik-titik di bawah ini dengan jawaban yang singkat, padat, dan benar.",
                italics: true,
                size: 18,
                font: "Arial",
              })
            ],
            spacing: { after: 180 },
          })
        );

        isianQuestions.forEach((q: any) => {
          const isianElements = parseMarkdownToDocx(`${q.number}. ${q.text || ""}`);
          childrenElements.push(...isianElements);
          childrenElements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        });
      }

      // Render Uraian Block
      if (uraianQuestions.length > 0) {
        childrenElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: "BAGIAN V: URAIAN / ESSAY",
                bold: true,
                size: 24,
                font: "Arial",
              })
            ],
            spacing: { before: 180, after: 40 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Jawablah pertanyaan berikut secara lengkap disertai dengan langkah penalaran yang tepat.",
                italics: true,
                size: 18,
                font: "Arial",
              })
            ],
            spacing: { after: 180 },
          })
        );

        uraianQuestions.forEach((q: any) => {
          const essayElements = parseMarkdownToDocx(`${q.number}. ${q.text || ""}`);
          childrenElements.push(...essayElements);
          childrenElements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
        });
      }
    }

    // 2. KISI-KISI ASESMEN SEGMENT
    if (printSelectKisi && questions.length > 0) {
      childrenElements.push(
        new Paragraph({
          children: [],
          pageBreakBefore: true,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "KISI-KISI ASESMEN SEKOLAH",
              bold: true,
              size: 26,
              font: "Arial",
            })
          ],
          spacing: { after: 40 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `${subject} • KELAS ${kelas} / ${fase}`,
              bold: true,
              size: 18,
              font: "Arial",
            })
          ],
          spacing: { after: 240 },
        })
      );

      // Construct Grid Table
      const kisiHeaders = ["No. Soal", "Bentuk Soal", "Materi Pokok", "Indikator Kisi-Kisi & Stimulus", `Level (${taksonomi})`, "Profil Lulusan", "Skor"];
      const colWidths = [10, 14, 16, 34, 12, 10, 4]; // % representation

      const kisiRows: TableRow[] = [
        new TableRow({
          children: kisiHeaders.map((headerText, idx) => {
            return new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: headerText,
                      bold: true,
                      font: "Arial",
                      size: 16,
                    })
                  ]
                })
              ],
              shading: { fill: "E2E8F0" }, // slate-200
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
              },
              verticalAlign: VerticalAlign.CENTER,
              width: { size: colWidths[idx], type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 80, right: 80 }
            });
          })
        })
      ];

      questions.forEach((q: any) => {
        let bobot = "1";
        if (q.type === "Pilihan Ganda Kompleks") bobot = "2";
        else if (q.type === "Menjodohkan") bobot = "3";
        else if (q.type === "Isian Singkat") bobot = "2";
        else if (q.type === "Uraian") bobot = "5";

        const cells = [
          // No
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: `${q.number}`, bold: true, font: "Arial", size: 16 })]
              })
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            },
            verticalAlign: VerticalAlign.CENTER,
            width: { size: colWidths[0], type: WidthType.PERCENTAGE }
          }),
          // Bentuk Soal
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: q.type, font: "Arial", size: 16 })]
              })
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            },
            verticalAlign: VerticalAlign.CENTER,
            width: { size: colWidths[1], type: WidthType.PERCENTAGE }
          }),
          // Materi Pokok
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: q.materiTopik || subject || "Materi Kurikulum", font: "Arial", size: 16 })]
              })
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            },
            verticalAlign: VerticalAlign.CENTER,
            width: { size: colWidths[2], type: WidthType.PERCENTAGE }
          }),
          // Indikator & Stimulus
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Indikator Soal:\n", bold: true, size: 14, font: "Arial", color: "475569" }),
                  ...parseInlineMarkdown(q.indikatorSoal || `Disajikan stimulus, peserta didik dapat menyelesaikan persoalan berkaitan dengan ${subject} secara tepat.`, 16),
                  new TextRun({ text: "\n\nStimulus Asesmen:\n", bold: true, size: 14, font: "Arial", color: "475569" }),
                  new TextRun({ text: q.stimulusAsesmen || "Kasus kontekstual terintegrasi.", italics: true, size: 14, font: "Arial", color: "64748B" })
                ]
              })
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            },
            verticalAlign: VerticalAlign.CENTER,
            width: { size: colWidths[3], type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 80, right: 80 }
          }),
          // Level Taksonomi
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: q.taxonomyLevel || "", bold: true, font: "Arial", size: 16 }),
                  new TextRun({ text: q.taxonomyAnalysis ? `\n${q.taxonomyAnalysis}` : "", font: "Arial", size: 14, color: "64748B" })
                ]
              })
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            },
            verticalAlign: VerticalAlign.CENTER,
            width: { size: colWidths[4], type: WidthType.PERCENTAGE },
            margins: { top: 60, bottom: 60, left: 80, right: 80 }
          }),
          // Profil Lulusan
          new TableCell({
            children: [
              new Paragraph({
                children: [new TextRun({ text: q.profilLulusanDimensi || "", bold: true, font: "Arial", size: 16, color: "0F766E" })]
              })
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            },
            verticalAlign: VerticalAlign.CENTER,
            width: { size: colWidths[5], type: WidthType.PERCENTAGE }
          }),
          // Skor
          new TableCell({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: bobot, bold: true, font: "Arial", size: 16 })]
              })
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
              right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
            },
            verticalAlign: VerticalAlign.CENTER,
            width: { size: colWidths[6], type: WidthType.PERCENTAGE }
          })
        ];

        kisiRows.push(
          new TableRow({
            children: cells
          })
        );
      });

      childrenElements.push(
        new Table({
          rows: kisiRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      );
    }

    // 3. KUNCI JAWABAN & RUBRIK SEGMENT
    if (printSelectKunci && questions.length > 0) {
      childrenElements.push(
        new Paragraph({
          children: [],
          pageBreakBefore: true,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "KUNCI JAWABAN & PEDOMAN PENSKORAN (RUBRIK)",
              bold: true,
              size: 26,
              font: "Arial",
            })
          ],
          spacing: { after: 40 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `${subject} • KELAS ${kelas} / ${fase}`,
              bold: true,
              size: 18,
              font: "Arial",
            })
          ],
          spacing: { after: 240 },
        })
      );

      questions.forEach((q: any) => {
        const isPg = q.type === "Pilihan Ganda" || q.type === "Pilihan Ganda Kompleks" || q.type === "Menjodohkan";
        
        childrenElements.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `No. ${q.number} (${q.type})`,
                bold: true,
                size: 20,
                font: "Arial",
              }),
              new TextRun({
                text: `   [ ${q.taxonomyLevel || ""} ]`,
                size: 16,
                font: "Arial",
                color: "475569"
              })
            ],
            spacing: { before: 140, after: 60 },
          })
        );

        const keysAndRubricsTable = new Table({
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: isPg ? "KUNCI JAWABAN / OPSI:" : "SOLUSI / JAWABAN IDEAL:",
                          bold: true,
                          size: 14,
                          font: "Arial",
                          color: "64748B",
                        })
                      ],
                      spacing: { after: 40 }
                    }),
                    ...parseMarkdownToDocx(q.correctAnswer || "", 18)
                  ],
                  width: { size: 45, type: WidthType.PERCENTAGE },
                  shading: { fill: "F8FAFC" },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                    left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                    right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  },
                  margins: { top: 80, bottom: 80, left: 100, right: 100 }
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: isPg ? "PEMBAHASAN SOAL:" : "RUBRIK & KRITERIA SKOR:",
                          bold: true,
                          size: 14,
                          font: "Arial",
                          color: "0F766E",
                        })
                      ],
                      spacing: { after: 40 }
                    }),
                    ...parseMarkdownToDocx(q.rubrikAsesmen || "", 18)
                  ],
                  width: { size: 55, type: WidthType.PERCENTAGE },
                  borders: {
                    top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                    bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                    left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                    right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  },
                  margins: { top: 80, bottom: 80, left: 100, right: 100 }
                })
              ]
            })
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        });

        childrenElements.push(keysAndRubricsTable);
        childrenElements.push(new Paragraph({ children: [], spacing: { after: 120 } }));
      });
    }

    // 4. ANALISIS PEDAGOGIS SEGMENT
    if (printSelectAnalisis && questions.length > 0) {
      childrenElements.push(
        new Paragraph({
          children: [],
          pageBreakBefore: true,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: "ANALISIS PEDAGOGIS & AKUNTABILITAS SOAL",
              bold: true,
              size: 26,
              font: "Arial",
            })
          ],
          spacing: { after: 40 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `${subject} • KELAS ${kelas} / ${fase}`,
              bold: true,
              size: 18,
              font: "Arial",
            })
          ],
          spacing: { after: 240 },
        })
      );

      const analysisHeaders = ["No.", `Level Taksonomi (${taksonomi}) & Analisis Capaian`, "Dimensi Profil Lulusan & Prinsip Pembelajaran"];
      const colWidthsAnalysis = [8, 48, 44];

      const analysisRows: TableRow[] = [
        new TableRow({
          children: analysisHeaders.map((headerText, idx) => {
            return new TableCell({
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: headerText,
                      bold: true,
                      font: "Arial",
                      size: 16,
                    })
                  ]
                })
              ],
              shading: { fill: "E2E8F0" },
              borders: {
                top: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                bottom: { style: BorderStyle.SINGLE, size: 8, color: "000000" },
                left: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
                right: { style: BorderStyle.SINGLE, size: 4, color: "94A3B8" },
              },
              verticalAlign: VerticalAlign.CENTER,
              width: { size: colWidthsAnalysis[idx], type: WidthType.PERCENTAGE },
              margins: { top: 100, bottom: 100, left: 80, right: 80 }
            });
          })
        })
      ];

      questions.forEach((q: any) => {
        analysisRows.push(
          new TableRow({
            children: [
              // No
              new TableCell({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [new TextRun({ text: `${q.number}`, bold: true, font: "Arial", size: 16 })]
                  })
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                },
                verticalAlign: VerticalAlign.CENTER,
                width: { size: colWidthsAnalysis[0], type: WidthType.PERCENTAGE }
              }),
              // Level & Analisis Capaian
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: q.taxonomyLevel || "", bold: true, font: "Arial", size: 16, color: "0F766E" }),
                      new TextRun({ text: "\n\nAnalisis Capaian Pembelajaran:\n", bold: true, size: 14, font: "Arial", color: "475569" }),
                      ...parseInlineMarkdown(q.taxonomyAnalysis || "Telah divalidasi sesuai taksonomi kognitif.", 16)
                    ]
                  })
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                },
                verticalAlign: VerticalAlign.CENTER,
                width: { size: colWidthsAnalysis[1], type: WidthType.PERCENTAGE },
                margins: { top: 80, bottom: 80, left: 100, right: 100 }
              }),
              // Dimensi & Prinsip
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({ text: q.profilLulusanDimensi || "", bold: true, font: "Arial", size: 16, color: "0F766E" }),
                      new TextRun({ text: "\n\nPrinsip Pembelajaran:\n", bold: true, size: 14, font: "Arial", color: "475569" }),
                      ...parseInlineMarkdown(q.prinsipPM || "Berkesadaran, bermakna, dan menggembirakan.", 16)
                    ]
                  })
                ],
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  left: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                  right: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                },
                verticalAlign: VerticalAlign.CENTER,
                width: { size: colWidthsAnalysis[2], type: WidthType.PERCENTAGE },
                margins: { top: 80, bottom: 80, left: 100, right: 100 }
              })
            ]
          })
        );
      });

      childrenElements.push(
        new Table({
          rows: analysisRows,
          width: { size: 100, type: WidthType.PERCENTAGE }
        })
      );
    }

    // 5. DOCUMENT GENERATION
    const doc = new Document({
      sections: [
        {
          properties: {
            page: {
              size: {
                width: 11906, // A4 Width in twips
                height: 16838, // A4 Height in twips
              },
              margin: {
                top: 1080,    // 0.75in in twips (1440 * 0.75 = 1080)
                right: 1080,
                bottom: 1080,
                left: 1080,
              },
            },
          },
          children: childrenElements,
        }
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    
    const cleanSubject = subject.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const cleanKelas = kelas.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const filename = `soal_asesmen_${cleanSubject}_kelas_${cleanKelas || "X"}`;

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${filename}.docx"`,
      },
    });

  } catch (error: any) {
    console.error("Error creating Word/Docx document:", error);
    return NextResponse.json(
      { error: "Gagal membuat dokumen Word/Docx.", details: error.message },
      { status: 500 }
    );
  }
}
