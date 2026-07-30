"use client";

import { jsPDF } from "jspdf";
import type { Person } from "@/types/family";
import { buildDescendantList } from "@/lib/list";
import { displayName, formatPolishDate } from "@/lib/db-client";

type PdfFormat = "a4" | "a0";

let fontsReady: Promise<void> | null = null;
const fontCache: { normal?: string; bold?: string } = {};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function ensureFonts(doc: jsPDF): Promise<void> {
  if (!fontsReady) {
    fontsReady = (async () => {
      const [normalBuf, boldBuf] = await Promise.all([
        fetch("/fonts/DejaVuSans.ttf").then((r) => {
          if (!r.ok) throw new Error("Nie udało się wczytać czcionki DejaVu.");
          return r.arrayBuffer();
        }),
        fetch("/fonts/DejaVuSans-Bold.ttf").then((r) => {
          if (!r.ok) throw new Error("Nie udało się wczytać czcionki DejaVu Bold.");
          return r.arrayBuffer();
        }),
      ]);
      fontCache.normal = arrayBufferToBase64(normalBuf);
      fontCache.bold = arrayBufferToBase64(boldBuf);
    })();
  }
  await fontsReady;
  doc.addFileToVFS("DejaVuSans.ttf", fontCache.normal!);
  doc.addFont("DejaVuSans.ttf", "DejaVuSans", "normal");
  doc.addFileToVFS("DejaVuSans-Bold.ttf", fontCache.bold!);
  doc.addFont("DejaVuSans-Bold.ttf", "DejaVuSans", "bold");
}

function personLine(person: Person, isSpouse: boolean): string {
  const prefix = isSpouse ? "małż. " : "";
  const birth = person.birthDate
    ? `  u. ${formatPolishDate(person.birthDate)}`
    : "";
  const death = person.deathDate
    ? `  z. ${formatPolishDate(person.deathDate)}`
    : "";
  return `${prefix}${displayName(person)}${birth}${death}`;
}

function drawNestingRails(
  doc: jsPDF,
  entry: ReturnType<typeof buildDescendantList>[number],
  x0: number,
  y: number,
  lineH: number,
  colW: number,
) {
  doc.setDrawColor(140, 155, 145);
  doc.setLineWidth(0.25);

  const depth = Math.floor(entry.railDepth);
  for (let i = 0; i < depth; i++) {
    const x = x0 + i * colW + colW * 0.35;
    const isLastAtLevel =
      i === depth - 1
        ? entry.isLast && !entry.isSpouse
        : entry.ancestorLast[i] === true;

    if (i < depth - 1) {
      // continuing vertical for unfinished ancestors
      if (!entry.ancestorLast[i]) {
        doc.line(x, y - lineH * 0.35, x, y + lineH * 0.65);
      }
    } else {
      // elbow for this node
      const midY = y + 0.5;
      doc.line(x, y - lineH * 0.35, x, midY);
      doc.line(x, midY, x + colW * 0.45, midY);
      if (!isLastAtLevel && !entry.isSpouse) {
        doc.line(x, midY, x, y + lineH * 0.65);
      }
    }
  }

  if (entry.isSpouse && depth >= 0) {
    const x = x0 + Math.max(depth, 0) * colW + colW * 0.35;
    doc.setDrawColor(170, 150, 160);
    doc.line(x + 1, y + 0.5, x + colW * 0.35, y + 0.5);
  }
}

async function exportHierarchicalPdf(
  people: Person[],
  rootId: string,
  title: string,
  format: PdfFormat,
) {
  const entries = buildDescendantList(people, rootId);
  const isA0 = format === "a0";
  const doc = new jsPDF({
    orientation: isA0 ? "landscape" : "portrait",
    unit: "mm",
    format,
  });

  await ensureFonts(doc);

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = isA0 ? 28 : 16;
  const colW = isA0 ? 10 : 7;
  const fontSize = isA0 ? 11 : 10;
  const lineH = isA0 ? 7.2 : 6.2;
  const textStart = margin + 4;

  let y = margin;

  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(isA0 ? 22 : 15);
  doc.setTextColor(15, 60, 45);
  doc.text(title, margin, y);
  y += isA0 ? 9 : 7;

  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(isA0 ? 11 : 9);
  doc.setTextColor(70, 90, 80);
  doc.text(
    `Twórca: Adam Lieske  ·  ${entries.length} pozycji  ·  format ${format.toUpperCase()}`,
    margin,
    y,
  );
  y += isA0 ? 12 : 9;

  doc.setDrawColor(180, 200, 185);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);
  y += isA0 ? 8 : 6;

  for (const entry of entries) {
    if (y > pageH - margin - lineH) {
      doc.addPage();
      y = margin;
    }

    drawNestingRails(doc, entry, margin, y, lineH, colW);

    const indent = textStart + Math.floor(entry.railDepth) * colW + (entry.isSpouse ? colW * 0.5 : 0);
    const gen = entry.isSpouse ? "" : `${entry.generation}. `;
    const line = `${gen}${personLine(entry.person, entry.isSpouse)}`;

    doc.setFont("DejaVuSans", entry.isSpouse ? "normal" : "bold");
    doc.setFontSize(entry.isSpouse ? fontSize - 0.5 : fontSize);
    doc.setTextColor(
      entry.isSpouse ? 90 : 26,
      entry.isSpouse ? 90 : 46,
      entry.isSpouse ? 95 : 36,
    );

    const maxWidth = pageW - indent - margin;
    const wrapped = doc.splitTextToSize(line, maxWidth) as string[];
    doc.text(wrapped, indent, y + 1.2);
    y += Math.max(wrapped.length, 1) * lineH;
  }

  // Footer on last page
  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 125);
  doc.text(
    "Drzewo Potrykus — powiązania hierarchiczne",
    margin,
    pageH - margin / 2,
  );

  doc.save(
    format === "a0"
      ? "potrykus-drzewo-a0.pdf"
      : "potrykus-drzewo-lista.pdf",
  );
}

/** Hierarchical list PDF (A4), Polish fonts + nesting rails. */
export async function exportListPdf(
  people: Person[],
  rootId: string,
  title: string,
) {
  await exportHierarchicalPdf(people, rootId, title, "a4");
}

/**
 * Large A0 PDF with hierarchical nesting (vector).
 * More reliable than html2canvas for huge family trees.
 */
export async function exportTreeA0Pdf(
  people?: Person[],
  rootId?: string,
  title?: string,
) {
  if (!people?.length || !rootId) {
    throw new Error(
      "Brak danych do eksportu A0. Odśwież drzewo i spróbuj ponownie.",
    );
  }
  await exportHierarchicalPdf(
    people,
    rootId,
    title || "Drzewo rodziny Potrykus",
    "a0",
  );
}
