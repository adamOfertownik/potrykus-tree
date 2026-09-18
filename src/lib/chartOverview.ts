import type { Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { getChildrenIds, getPersonMap } from "@/lib/tree";

export type ChartTreeNode = {
  id: string;
  x: number;
  y: number;
  depth: number;
  isAncestry: boolean;
  isSpouse: boolean;
};

export type BranchLabel = {
  id: string;
  title: string;
  subtitle: string;
  /** Pokolenie od pnia Franciszka (P018), jak na liście. */
  generation?: number;
  x: number;
  y: number;
  width: number;
  count: number;
};

export type GenerationBand = {
  key: string;
  y: number;
  label: string;
  digit: string;
};

const MIN_BRANCH_WIDTH = 200;
const MIN_DESCENDANTS = 2;

/** Franciszek Xawery Potrykus — stały pień numeracji pokoleń. */
export const GENERATION_TRUNK_ID = "P018";

const TRUNK_SEARCH_ALIASES = [
  "pien",
  "pień",
  "pien rodziny",
  "pień rodziny",
  "franciszek xawery",
  "xawery potrykus",
  "pien franciszka xawerego",
  "pień franciszka xawerego",
];

/** Podpowiedź w wyszukiwarce dla pnia i jego małżonka. */
export function generationTrunkHint(
  personId: string,
  people: Person[],
): string {
  if (personId === GENERATION_TRUNK_ID) {
    return "pień rodziny · Franciszek Xawery Potrykus";
  }
  const person = getPersonMap(people).get(personId);
  if (!person) return "";
  if (person.spouseIds.includes(GENERATION_TRUNK_ID)) {
    return "małżonek pnia Franciszka Xawerego";
  }
  const gen = generationIndexByPersonId(people).get(personId);
  if (gen != null && gen < 0) {
    return `przodek pnia (${-gen} pok. w górę)`;
  }
  return "";
}

/** Słowa trafiające do wyszukiwania po pniu Franciszka Xawerego. */
export function generationTrunkSearchHaystack(
  personId: string,
  people: Person[],
): string {
  if (personId === GENERATION_TRUNK_ID) {
    return TRUNK_SEARCH_ALIASES.join(" ");
  }
  return generationTrunkHint(personId, people);
}

export function generationIndexByPersonId(
  people: Person[],
  trunkId = GENERATION_TRUNK_ID,
): Map<string, number> {
  const map = getPersonMap(people);
  const gen = new Map<string, number>();
  if (!map.has(trunkId)) return gen;
  gen.set(trunkId, 0);

  const down = [trunkId];
  for (let i = 0; i < down.length; i++) {
    const id = down[i]!;
    const g = gen.get(id) ?? 0;
    for (const childId of getChildrenIds(people, id)) {
      if (gen.has(childId)) continue;
      gen.set(childId, g + 1);
      down.push(childId);
    }
  }

  const up = [trunkId];
  for (let i = 0; i < up.length; i++) {
    const id = up[i]!;
    const g = gen.get(id) ?? 0;
    const person = map.get(id);
    if (!person) continue;
    for (const parentId of person.parentIds) {
      if (!map.has(parentId) || gen.has(parentId)) continue;
      gen.set(parentId, g - 1);
      up.push(parentId);
    }
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const person of people) {
      const g = gen.get(person.id);
      if (g == null) continue;
      for (const spouseId of person.spouseIds) {
        if (!map.has(spouseId) || gen.has(spouseId)) continue;
        gen.set(spouseId, g);
        changed = true;
      }
    }
  }
  return gen;
}

export function nodesFromChartTree(
  tree: { data?: unknown[] } | null | undefined,
): ChartTreeNode[] {
  const rows = tree?.data;
  if (!Array.isArray(rows)) return [];
  const out: ChartTreeNode[] = [];
  for (const raw of rows) {
    const d = raw as {
      x?: number;
      y?: number;
      depth?: number;
      is_ancestry?: boolean;
      spouse?: unknown;
      data?: { id?: string };
    };
    const id = d.data?.id;
    if (!id || typeof d.x !== "number" || typeof d.y !== "number") continue;
    out.push({
      id,
      x: d.x,
      y: d.y,
      depth: Number(d.depth ?? 0),
      isAncestry: Boolean(d.is_ancestry),
      isSpouse: Boolean(d.spouse),
    });
  }
  return out;
}

function descendantIds(people: Person[], rootId: string): Set<string> {
  const seen = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    for (const childId of getChildrenIds(people, id)) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      queue.push(childId);
    }
  }
  return seen;
}

function plPeople(n: number): string {
  const abs = Math.abs(n);
  if (abs === 1) return "1 osoba";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${n} osoby`;
  }
  return `${n} osób`;
}

/** Jak na liście rodziny — jeden pień, jedno „1.” */
export function formatBranchGeneration(gen: number | undefined): string {
  if (gen == null) return "";
  if (gen === 0) return "Pień";
  if (gen < 0) return `Przodkowie ${-gen}`;
  return `${gen}. pokolenie`;
}

function branchTitle(
  person: Person,
  count: number,
  generation?: number,
): {
  title: string;
  subtitle: string;
} {
  const title = `${person.firstName} ${person.lastName}`.trim();
  const maiden =
    person.maidenName && person.maidenName !== person.lastName
      ? `z d. ${person.maidenName}`
      : "";
  const peopleLabel = count > 1 ? `${plPeople(count)} w gałęzi` : "";
  const subtitle = [maiden, peopleLabel].filter(Boolean).join(" · ");
  return { title, subtitle };
}

export type BranchLabelMode = "overview" | "next";

export function pickBranchLabels(
  nodes: ChartTreeNode[],
  people: Person[],
  mode: BranchLabelMode = "overview",
): BranchLabel[] {
  if (nodes.length < (mode === "next" ? 3 : 6)) return [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const candidates = nodes.filter(
    (n) => !n.isSpouse && !n.isAncestry && nodeById.has(n.id),
  );

  const extents = new Map<
    string,
    { minX: number; maxX: number; y: number; count: number }
  >();
  for (const node of candidates) {
    const ids = descendantIds(people, node.id);
    let minX = node.x;
    let maxX = node.x;
    let count = 0;
    for (const id of ids) {
      const other = nodeById.get(id);
      if (!other) continue;
      count += 1;
      minX = Math.min(minX, other.x);
      maxX = Math.max(maxX, other.x);
    }
    extents.set(node.id, { minX, maxX, y: node.y, count });
  }

  const byDepth = new Map<number, ChartTreeNode[]>();
  for (const node of candidates) {
    const ext = extents.get(node.id);
    if (!ext) continue;
    const width = ext.maxX - ext.minX;
    if (width < MIN_BRANCH_WIDTH && ext.count < MIN_DESCENDANTS) continue;
    if (node.depth < 1) continue;
    const list = byDepth.get(node.depth) ?? [];
    list.push(node);
    byDepth.set(node.depth, list);
  }

  let bestHeads: ChartTreeNode[] = [];
  if (mode === "next") {
    let bestDepth = Infinity;
    for (const [depth, list] of byDepth) {
      if (list.length < 1) continue;
      if (depth < bestDepth) {
        bestDepth = depth;
        bestHeads = list;
      }
    }
  } else {
    let bestScore = -1;
    for (const [depth, list] of byDepth) {
      if (list.length < 2) continue;
      const n = list.length;
      const sizeScore = n <= 8 ? n * 3 : Math.max(4, 24 - (n - 8));
      const score = sizeScore + depth * 0.25;
      if (score > bestScore) {
        bestScore = score;
        bestHeads = list;
      }
    }
  }
  if (bestHeads.length < 1) return [];
  if (mode === "overview" && bestHeads.length < 2) return [];

  const genByPerson = generationIndexByPersonId(people);

  const chosen = new Set(bestHeads.map((n) => n.id));
  if (mode === "overview") {
    const extraDepth = bestHeads[0] ? bestHeads[0].depth + 1 : -1;
    for (const node of candidates) {
      if (node.depth !== extraDepth || chosen.has(node.id)) continue;
      const ext = extents.get(node.id);
      if (!ext || ext.count < 8 || ext.maxX - ext.minX < 360) continue;
      chosen.add(node.id);
      bestHeads.push(node);
    }
  }

  const labels: BranchLabel[] = [];
  for (const node of bestHeads) {
    const person = byId.get(node.id);
    const ext = extents.get(node.id);
    if (!person || !ext) continue;
    const generation = genByPerson.get(node.id);
    const { title, subtitle } = branchTitle(person, ext.count, generation);
    labels.push({
      id: node.id,
      title,
      subtitle: subtitle || displayName(person),
      generation,
      x: (ext.minX + ext.maxX) / 2,
      y: node.y,
      width: Math.max(ext.maxX - ext.minX, 240),
      count: ext.count,
    });
  }
  const sorted = labels.sort((a, b) => a.x - b.x);
  if (mode !== "overview") return sorted;
  return ensureGenerationTrunkBranchLabel(sorted, nodes, people, extents, nodeById);
}

function ensureGenerationTrunkBranchLabel(
  labels: BranchLabel[],
  nodes: ChartTreeNode[],
  people: Person[],
  extents: Map<string, { minX: number; maxX: number; y: number; count: number }>,
  nodeById: Map<string, ChartTreeNode>,
): BranchLabel[] {
  const trunkId = GENERATION_TRUNK_ID;
  const person = people.find((p) => p.id === trunkId);
  const node = nodes.find((n) => n.id === trunkId && !n.isSpouse);
  if (!person || !node) return labels;

  let ext = extents.get(trunkId);
  if (!ext) {
    const ids = descendantIds(people, trunkId);
    let minX = node.x;
    let maxX = node.x;
    let count = 0;
    for (const id of ids) {
      const other = nodeById.get(id);
      if (!other) continue;
      count += 1;
      minX = Math.min(minX, other.x);
      maxX = Math.max(maxX, other.x);
    }
    ext = { minX, maxX, y: node.y, count };
  }

  const trunkLabel: BranchLabel = {
    id: trunkId,
    title: displayName(person, people),
    subtitle: ext.count > 1 ? `${plPeople(ext.count)} w gałęzi` : "",
    generation: 0,
    x: (ext.minX + ext.maxX) / 2,
    y: node.y,
    width: Math.max(ext.maxX - ext.minX, 240),
    count: ext.count,
  };

  const idx = labels.findIndex((label) => label.id === trunkId);
  if (idx >= 0) {
    labels[idx] = { ...labels[idx], ...trunkLabel, generation: 0 };
    return labels;
  }
  return [...labels, trunkLabel].sort((a, b) => a.x - b.x);
}

export function pickGenerationBands(
  nodes: ChartTreeNode[],
  people: Person[] = [],
): GenerationBand[] {
  const fromTrunk = people.length
    ? generationIndexByPersonId(people)
    : new Map<string, number>();
  const rows = new Map<
    number,
    { y: number; gen: number; ancestry: boolean; depth: number }
  >();
  for (const node of nodes) {
    if (node.isSpouse) continue;
    const trunkGen = fromTrunk.get(node.id);
    const key =
      trunkGen != null ? trunkGen : node.isAncestry ? -node.depth : node.depth;
    const prev = rows.get(key);
    if (!prev || node.y < prev.y) {
      rows.set(key, {
        y: node.y,
        gen: trunkGen ?? (node.isAncestry ? -node.depth : node.depth),
        ancestry: node.isAncestry,
        depth: node.depth,
      });
    }
  }
  return [...rows.entries()]
    .sort((a, b) => a[1].y - b[1].y)
    .map(([, row]) => {
      const n = row.gen;
      const label =
        n === 0
          ? "Pień"
          : n > 0
            ? `Pokolenie ${n}`
            : `Przodkowie ${-n}`;
      return {
        key: `gen-${n}`,
        y: row.y,
        label,
        digit: n === 0 ? "Pień" : String(Math.abs(n)),
      };
    });
}

export function overviewVisible(zoom: number): boolean {
  return zoom < 0.92;
}

/** Branch headers fade when zooming in. Generation labels stay visible. */
export function overviewOpacity(zoom: number): number {
  if (zoom >= 0.95) return 0;
  if (zoom <= 0.62) return 1;
  return (0.95 - zoom) / 0.33;
}
