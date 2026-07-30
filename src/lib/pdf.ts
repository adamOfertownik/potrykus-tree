"use client";

import { jsPDF } from "jspdf";
import type { Person } from "@/types/family";
import { buildDescendantList } from "@/lib/list";
import { getChildrenIds, getPersonMap } from "@/lib/tree";
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
          if (!r.ok)
            throw new Error("Nie udało się wczytać czcionki DejaVu Bold.");
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
      if (!entry.ancestorLast[i]) {
        doc.line(x, y - lineH * 0.35, x, y + lineH * 0.65);
      }
    } else {
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

    const indent =
      textStart +
      Math.floor(entry.railDepth) * colW +
      (entry.isSpouse ? colW * 0.5 : 0);
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

  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 125);
  doc.text(
    "Drzewo Potrykus — powiązania hierarchiczne",
    margin,
    pageH - margin / 2,
  );

  doc.save(
    format === "a0" ? "potrykus-drzewo-a0.pdf" : "potrykus-drzewo-lista.pdf",
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

/* ——— A0 graph (boxes + lines), max 2 sheets ——— */

type GraphNode = {
  id: string;
  person: Person;
  isSpouse: boolean;
  generation: number;
  /** Layout coords in abstract units before scale */
  x: number;
  y: number;
  parentKey?: string;
};

function collectGraphNodes(
  people: Person[],
  rootId: string,
  maxGenerations = 8,
): GraphNode[] {
  const map = getPersonMap(people);
  const root = map.get(rootId);
  if (!root) return [];

  const nodes: GraphNode[] = [];
  const visited = new Set<string>();

  type Q = {
    id: string;
    generation: number;
    parentKey?: string;
  };
  const queue: Q[] = [{ id: rootId, generation: 0 }];

  while (queue.length) {
    const cur = queue.shift()!;
    if (visited.has(cur.id) || cur.generation > maxGenerations) continue;
    visited.add(cur.id);
    const person = map.get(cur.id);
    if (!person) continue;

    nodes.push({
      id: cur.id,
      person,
      isSpouse: false,
      generation: cur.generation,
      x: 0,
      y: cur.generation,
      parentKey: cur.parentKey,
    });

    for (const spouseId of person.spouseIds) {
      const spouse = map.get(spouseId);
      if (!spouse || visited.has(`spouse:${cur.id}:${spouseId}`)) continue;
      visited.add(`spouse:${cur.id}:${spouseId}`);
      nodes.push({
        id: `spouse:${spouseId}`,
        person: spouse,
        isSpouse: true,
        generation: cur.generation,
        x: 0,
        y: cur.generation,
        parentKey: cur.id,
      });
    }

    for (const childId of getChildrenIds(people, cur.id)) {
      if (!visited.has(childId)) {
        queue.push({
          id: childId,
          generation: cur.generation + 1,
          parentKey: cur.id,
        });
      }
    }
  }

  // Assign x within each generation
  const byGen = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const list = byGen.get(n.generation) ?? [];
    list.push(n);
    byGen.set(n.generation, list);
  }

  let maxCols = 1;
  for (const [, list] of byGen) {
    // Keep blood people first, spouses immediately after their partner when possible
    list.sort((a, b) => {
      if (a.isSpouse !== b.isSpouse) return a.isSpouse ? 1 : -1;
      return a.person.lastName.localeCompare(b.person.lastName, "pl");
    });
    list.forEach((n, i) => {
      n.x = i;
    });
    maxCols = Math.max(maxCols, list.length);
  }

  // Normalize x to center generations of different widths
  for (const [, list] of byGen) {
    const offset = (maxCols - list.length) / 2;
    list.forEach((n) => {
      n.x += offset;
    });
  }

  return nodes;
}

function drawGraphPage(
  doc: jsPDF,
  nodes: GraphNode[],
  title: string,
  subtitle: string,
  pageIndex: number,
  pageCount: number,
) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const headerH = 22;

  const gens = Math.max(...nodes.map((n) => n.generation), 0) + 1;
  const cols = Math.max(...nodes.map((n) => n.x), 0) + 1;

  const availW = pageW - margin * 2;
  const availH = pageH - margin * 2 - headerH;

  const cardW = Math.min(52, Math.max(22, availW / Math.max(cols, 1) - 4));
  const cardH = Math.min(28, Math.max(14, availH / Math.max(gens, 1) - 8));
  const gapX = Math.min(10, Math.max(3, (availW - cols * cardW) / Math.max(cols, 1)));
  const gapY = Math.min(18, Math.max(6, (availH - gens * cardH) / Math.max(gens, 1)));

  const totalW = cols * cardW + Math.max(cols - 1, 0) * gapX;
  const totalH = gens * cardH + Math.max(gens - 1, 0) * gapY;
  const scale = Math.min(1, availW / totalW, availH / totalH);
  const cW = cardW * scale;
  const cH = cardH * scale;
  const gX = gapX * scale;
  const gY = gapY * scale;
  const originX = margin + (availW - (cols * cW + Math.max(cols - 1, 0) * gX)) / 2;
  const originY = margin + headerH;

  const pos = new Map<string, { cx: number; cy: number; x: number; y: number }>();
  for (const n of nodes) {
    const x = originX + n.x * (cW + gX);
    const y = originY + n.generation * (cH + gY);
    pos.set(n.id, { x, y, cx: x + cW / 2, cy: y + cH / 2 });
  }

  // Title
  doc.setFont("DejaVuSans", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 60, 45);
  doc.text(title, margin, margin + 6);
  doc.setFont("DejaVuSans", "normal");
  doc.setFontSize(8);
  doc.setTextColor(70, 90, 80);
  doc.text(
    `${subtitle}  ·  strona ${pageIndex}/${pageCount}  ·  Twórca: Adam Lieske`,
    margin,
    margin + 12,
  );

  // Links first
  doc.setDrawColor(95, 122, 106);
  doc.setLineWidth(0.4);
  for (const n of nodes) {
    if (!n.parentKey) continue;
    const parent = pos.get(n.parentKey);
    const child = pos.get(n.id);
    if (!parent || !child) continue;
    if (n.isSpouse) {
      doc.setDrawColor(160, 130, 140);
      doc.line(parent.x + cW, parent.y + cH / 2, child.x, child.y + cH / 2);
      doc.setDrawColor(95, 122, 106);
    } else {
      const midY = (parent.y + cH + child.y) / 2;
      doc.line(parent.cx, parent.y + cH, parent.cx, midY);
      doc.line(parent.cx, midY, child.cx, midY);
      doc.line(child.cx, midY, child.cx, child.y);
    }
  }

  // Cards
  const fontSize = Math.max(5.5, Math.min(9, cH * 0.28));
  for (const n of nodes) {
    const p = pos.get(n.id)!;
    const isFemale = n.person.gender === "female";
    const isMale = n.person.gender === "male";
    if (n.isSpouse) {
      doc.setFillColor(252, 246, 248);
      doc.setDrawColor(180, 140, 155);
    } else if (isFemale) {
      doc.setFillColor(252, 240, 244);
      doc.setDrawColor(196, 91, 122);
    } else if (isMale) {
      doc.setFillColor(235, 242, 252);
      doc.setDrawColor(47, 111, 237);
    } else {
      doc.setFillColor(245, 248, 245);
      doc.setDrawColor(120, 140, 125);
    }
    doc.setLineWidth(0.35);
    doc.roundedRect(p.x, p.y, cW, cH, 1.5, 1.5, "FD");

    doc.setFont("DejaVuSans", "bold");
    doc.setFontSize(fontSize);
    doc.setTextColor(26, 46, 36);
    const name = `${n.person.firstName} ${n.person.lastName}`;
    const lines = doc.splitTextToSize(name, cW - 3) as string[];
    doc.text(lines.slice(0, 2), p.x + cW / 2, p.y + 4.2, {
      align: "center",
    });

    const dates = [
      formatPolishDate(n.person.birthDate),
      formatPolishDate(n.person.deathDate),
    ]
      .filter(Boolean)
      .join(" – ");
    if (dates && cH > 16) {
      doc.setFont("DejaVuSans", "normal");
      doc.setFontSize(Math.max(4.5, fontSize - 1.2));
      doc.setTextColor(80, 100, 90);
      doc.text(dates, p.x + cW / 2, p.y + cH - 3, { align: "center" });
    }
  }
}

/**
 * A0 graph PDF of the focused branch — packed onto 1 page when possible,
 * otherwise split into max 2 sheets (by root children).
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

  const map = getPersonMap(people);
  const root = map.get(rootId);
  const label = title || "Drzewo rodziny Potrykus";
  const rootName = root ? displayName(root) : "gałąź";

  const childIds = getChildrenIds(people, rootId);
  const allNodes = collectGraphNodes(people, rootId);
  const tooWide = allNodes.length > 90 || childIds.length > 6;

  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a0",
  });
  await ensureFonts(doc);

  if (!tooWide || childIds.length <= 1) {
    drawGraphPage(
      doc,
      allNodes,
      label,
      `Graf od: ${rootName} · ${allNodes.length} kart`,
      1,
      1,
    );
  } else {
    // Split into two sheets by root children
    const mid = Math.ceil(childIds.length / 2);
    const groups = [childIds.slice(0, mid), childIds.slice(mid)];
    let page = 0;
    for (const group of groups) {
      if (!group.length) continue;
      page += 1;
      if (page > 1) doc.addPage();
      // Synthetic page: root + spouses + this half of descendants
      const subsetIds = new Set<string>([rootId, ...group]);
      // BFS descendants of group
      const q = [...group];
      while (q.length) {
        const id = q.shift()!;
        for (const c of getChildrenIds(people, id)) {
          if (!subsetIds.has(c)) {
            subsetIds.add(c);
            q.push(c);
          }
        }
        const p = map.get(id);
        p?.spouseIds.forEach((s) => subsetIds.add(s));
      }
      map.get(rootId)?.spouseIds.forEach((s) => subsetIds.add(s));

      const subsetPeople = people.filter(
        (p) => subsetIds.has(p.id) || p.spouseIds.some((s) => subsetIds.has(s)),
      );
      // Keep links: include people who are parents in subset
      const nodes = collectGraphNodes(subsetPeople, rootId);
      drawGraphPage(
        doc,
        nodes,
        label,
        `Graf od: ${rootName} · część ${page}/2 · ${nodes.length} kart`,
        page,
        2,
      );
      if (page >= 2) break;
    }
  }

  // Ensure we never exceed 2 pages
  const pages = doc.getNumberOfPages();
  if (pages > 2) {
    for (let i = pages; i > 2; i--) doc.deletePage(i);
  }

  doc.save(`potrykus-graf-a0-${rootId.slice(0, 24)}.pdf`);
}
