"use client";

import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import type { Person } from "@/types/family";
import { buildDescendantList } from "@/lib/tree";
import { displayName, formatPolishDate } from "@/lib/db-client";

function personLine(person: Person, isSpouse: boolean): string {
  const prefix = isSpouse ? "małż. " : "";
  const birth = person.birthDate
    ? ` u. ${formatPolishDate(person.birthDate)}`
    : "";
  const death = person.deathDate
    ? ` z. ${formatPolishDate(person.deathDate)}`
    : "";
  return `${prefix}${displayName(person)}${birth}${death}`;
}

/** Hierarchical list PDF (A4 multi-page), inspired by printed genealogy docs. */
export function exportListPdf(
  people: Person[],
  rootId: string,
  title: string,
) {
  const entries = buildDescendantList(people, rootId);
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 16;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(title, margin, y);
  y += 7;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Twórca: Adam Lieske", margin, y);
  y += 10;

  for (const entry of entries) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    const indent = margin + entry.depth * 8;
    const gen = entry.isSpouse ? "" : `${entry.generation}. `;
    const line = `${gen}${personLine(entry.person, entry.isSpouse)}`;
    doc.setFont("helvetica", entry.isSpouse ? "normal" : "bold");
    doc.setFontSize(10);
    const lines = doc.splitTextToSize(line, pageWidth - indent - margin);
    doc.text(lines, indent, y);
    y += lines.length * 5.2;
  }

  doc.save("potrykus-drzewo-lista.pdf");
}

/** Capture the on-screen tree into a large A0 PDF. */
export async function exportTreeA0Pdf(elementId = "family-tree-canvas") {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Nie znaleziono widoku drzewa.");

  const canvas = await html2canvas(el, {
    backgroundColor: "#e7efe8",
    scale: 1.25,
    useCORS: true,
    logging: false,
  });

  // A0 = 841 × 1189 mm
  const doc = new jsPDF({
    orientation: canvas.width > canvas.height ? "landscape" : "portrait",
    unit: "mm",
    format: "a0",
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2 - 16;

  const ratio = Math.min(maxW / canvas.width, maxH / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  const x = (pageW - w) / 2;
  const y = margin + 12;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Drzewo rodziny Potrykus", margin, margin + 4);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Twórca: Adam Lieske · format A0", margin, margin + 10);

  const img = canvas.toDataURL("image/jpeg", 0.92);
  doc.addImage(img, "JPEG", x, y, w, h);
  doc.save("potrykus-drzewo-a0.pdf");
}
