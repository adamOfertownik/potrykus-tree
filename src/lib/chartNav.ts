import type { Person } from "@/types/family";
import type { ChartTreeNode } from "@/lib/chartOverview";
import { getChildrenIds } from "@/lib/tree";

export type NavDirection = "left" | "right" | "up" | "down";

const SAME_ROW = 80;

function closestByX(nodes: ChartTreeNode[], x: number): ChartTreeNode | null {
  if (!nodes.length) return null;
  return nodes.reduce((best, node) =>
    Math.abs(node.x - x) < Math.abs(best.x - x) ? node : best,
  );
}

function nearestOnRow(
  nodes: ChartTreeNode[],
  current: ChartTreeNode,
  dir: "left" | "right",
): ChartTreeNode | null {
  const row = nodes.filter(
    (node) =>
      node.id !== current.id && Math.abs(node.y - current.y) <= SAME_ROW,
  );
  const side =
    dir === "left"
      ? row.filter((node) => node.x < current.x)
      : row.filter((node) => node.x > current.x);
  if (!side.length) return null;
  return side.reduce((best, node) =>
    Math.abs(node.x - current.x) < Math.abs(best.x - current.x) ? node : best,
  );
}

/**
 * Next person in the rendered chart: relatives first, then nearest card.
 * Up/down skip a few pixels — they jump a generation.
 */
export function neighborInDirection(
  nodes: ChartTreeNode[],
  people: Person[],
  currentId: string,
  dir: NavDirection,
): string | null {
  const current = nodes.find((node) => node.id === currentId);
  if (!current) return null;
  const inTree = new Set(nodes.map((node) => node.id));
  const person = people.find((p) => p.id === currentId);

  if (dir === "up" && person) {
    const parents = person.parentIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is ChartTreeNode => Boolean(node));
    const pick = closestByX(parents, current.x);
    if (pick) return pick.id;
  }

  if (dir === "down" && person) {
    const children = getChildrenIds(people, currentId)
      .filter((id) => inTree.has(id))
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is ChartTreeNode => Boolean(node));
    const pick = closestByX(children, current.x);
    if (pick) return pick.id;
  }

  if ((dir === "left" || dir === "right") && person) {
    const relatives = [
      ...person.spouseIds,
      ...people
        .filter(
          (other) =>
            other.id !== person.id &&
            other.parentIds.some((id) => person.parentIds.includes(id)),
        )
        .map((other) => other.id),
    ];
    const onRow = relatives
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node): node is ChartTreeNode => Boolean(node));
    const side =
      dir === "left"
        ? onRow.filter((node) => node.x < current.x)
        : onRow.filter((node) => node.x > current.x);
    const pick = closestByX(side, current.x);
    if (pick) return pick.id;
    const geometric = nearestOnRow(nodes, current, dir);
    if (geometric) return geometric.id;
  }

  const others = nodes.filter((node) => node.id !== currentId);
  if (dir === "up") {
    const above = others.filter((node) => node.y < current.y - 40);
    const pick = closestByX(above, current.x);
    return pick?.id ?? null;
  }
  if (dir === "down") {
    const below = others.filter((node) => node.y > current.y + 40);
    const pick = closestByX(below, current.x);
    return pick?.id ?? null;
  }
  return nearestOnRow(nodes, current, dir)?.id ?? null;
}
