/** Separate overlapping family-chart relationship rails so each route is visible. */

type Point = [number, number];

type LinkDatum = {
  d?: Point[];
  curve?: boolean;
  spouse?: boolean;
};

const CLUSTER_PX = 10;
const GAP_PX = 16;
const MAX_SPREAD_PX = 88;
const LANE_STROKES = ["#9db8a6", "#d2c08a", "#8eb4c4", "#c9a48a", "#b4c47a"];

function linkDatum(path: SVGPathElement): LinkDatum | null {
  const data = (path as SVGPathElement & { __data__?: LinkDatum }).__data__;
  if (!data?.d?.length) return null;
  return data;
}

function midY(pts: Point[]): number | null {
  if (pts.length < 4) return null;
  return pts[2][1];
}

function clusterKey(hy: number): number {
  return Math.round(hy / CLUSTER_PX) * CLUSTER_PX;
}

function xSpan(pts: Point[]): [number, number] {
  const xs = pts.map((p) => p[0]);
  return [Math.min(...xs), Math.max(...xs)];
}

function spansOverlap(a: [number, number], b: [number, number], pad = 12): boolean {
  return a[0] <= b[1] + pad && b[0] <= a[1] + pad;
}

function overlapGroups<T extends { pts: Point[] }>(items: T[]): T[][] {
  const spans = items.map((item) => xSpan(item.pts));
  const parent = items.map((_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (spansOverlap(spans[i], spans[j])) {
        parent[find(j)] = find(i);
      }
    }
  }
  const buckets = new Map<number, T[]>();
  items.forEach((item, i) => {
    const root = find(i);
    const list = buckets.get(root) ?? [];
    list.push(item);
    buckets.set(root, list);
  });
  return [...buckets.values()];
}

function orthogonalPath(pts: Point[], hyOffset: number): string {
  const start = pts[0];
  const end = pts[pts.length - 1];
  if (pts.length < 4) {
    return `M${start[0]},${start[1]} L${end[0]},${end[1]}`;
  }
  const hy = pts[2][1] + hyOffset;
  if (start[0] === end[0]) {
    return `M${start[0]},${start[1]} L${end[0]},${end[1]}`;
  }
  return `M${start[0]},${start[1]} L${start[0]},${hy} L${end[0]},${hy} L${end[0]},${end[1]}`;
}

export function separateChartLinks(host: HTMLElement): void {
  const paths = Array.from(host.querySelectorAll<SVGPathElement>("path.link"));
  const curved: { path: SVGPathElement; pts: Point[]; hy: number }[] = [];

  for (const path of paths) {
    const data = linkDatum(path);
    if (!data?.d) continue;
    path.setAttribute("fill", "none");
    path.setAttribute("stroke-linejoin", "round");
    path.setAttribute("stroke-linecap", "round");
    if (data.spouse || !data.curve) {
      path.setAttribute("d", orthogonalPath(data.d, 0));
      continue;
    }
    const hy = midY(data.d);
    if (hy == null) continue;
    curved.push({ path, pts: data.d, hy });
  }

  const groups = new Map<number, typeof curved>();
  for (const item of curved) {
    const key = clusterKey(item.hy);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }

  for (const hyGroup of groups.values()) {
    for (const group of overlapGroups(hyGroup)) {
      group.sort((a, b) => a.pts[0][0] - b.pts[0][0] || a.pts[0][1] - b.pts[0][1]);
      const n = group.length;
      const step =
        n > 1 ? Math.min(GAP_PX, (MAX_SPREAD_PX * 2) / Math.max(n - 1, 1)) : 0;
      group.forEach((item, i) => {
        const offset = n > 1 ? (i - (n - 1) / 2) * step : 0;
        item.path.setAttribute("d", orthogonalPath(item.pts, offset));
        item.path.dataset.linkLane = String(i);
        if (!item.path.classList.contains("f3-path-to-main")) {
          item.path.setAttribute(
            "stroke",
            LANE_STROKES[i % LANE_STROKES.length],
          );
        }
      });
    }
  }
}
