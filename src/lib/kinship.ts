import type { Gender, Person } from "@/types/family";
import { displayName } from "@/lib/db-client";
import { getChildrenIds, getPersonMap } from "@/lib/tree";

export type KinshipResult = {
  labelAtoB: string;
  labelBtoA: string;
  summary: string;
  path: string[];
  via?: string;
  kind: "self" | "blood" | "affinity" | "none";
};

type AncestorInfo = { id: string; generation: number; path: string[] };

function genderWord(
  gender: Gender,
  male: string,
  female: string,
  neutral: string,
): string {
  if (gender === "male") return male;
  if (gender === "female") return female;
  return neutral;
}

/** All ancestors of personId: id → { generation, path from person up to ancestor } */
function collectAncestors(
  personId: string,
  map: Map<string, Person>,
): Map<string, AncestorInfo> {
  const out = new Map<string, AncestorInfo>();
  const queue: AncestorInfo[] = [
    { id: personId, generation: 0, path: [personId] },
  ];
  const seen = new Set<string>([personId]);

  while (queue.length) {
    const cur = queue.shift()!;
    const person = map.get(cur.id);
    if (!person) continue;
    for (const parentId of person.parentIds) {
      if (seen.has(parentId)) continue;
      seen.add(parentId);
      const next: AncestorInfo = {
        id: parentId,
        generation: cur.generation + 1,
        path: [...cur.path, parentId],
      };
      out.set(parentId, next);
      queue.push(next);
    }
  }
  return out;
}

function greatPrefix(n: number): string {
  if (n <= 0) return "";
  if (n === 1) return "pra";
  if (n === 2) return "prapra";
  return `pra×${n}`;
}

function ancestorLabel(generation: number, gender: Gender): string {
  if (generation === 1) return genderWord(gender, "ojciec", "matka", "rodzic");
  if (generation === 2)
    return genderWord(gender, "dziadek", "babcia", "dziadek/babcia");
  const prefix = greatPrefix(generation - 2);
  return genderWord(
    gender,
    `${prefix}dziadek`,
    `${prefix}babcia`,
    `${prefix}dziadek/babcia`,
  );
}

function descendantLabel(generation: number, gender: Gender): string {
  if (generation === 1) return genderWord(gender, "syn", "córka", "dziecko");
  if (generation === 2)
    return genderWord(gender, "wnuk", "wnuczka", "wnuk/wnuczka");
  const prefix = greatPrefix(generation - 2);
  return genderWord(
    gender,
    `${prefix}wnuk`,
    `${prefix}wnuczka`,
    `${prefix}wnuk/wnuczka`,
  );
}

function siblingLabel(gender: Gender, half: boolean): string {
  const base = genderWord(gender, "brat", "siostra", "rodzeństwo");
  return half ? `przyrodni${gender === "female" ? "a" : ""} ${base}` : base;
}

function uncleAuntLabel(gender: Gender, removed: number): string {
  const base = genderWord(gender, "wujek", "ciocia", "wujostwo");
  if (removed <= 0) return base;
  return `${greatPrefix(removed)}${base}`;
}

function niblingLabel(gender: Gender, removed: number): string {
  const base = genderWord(
    gender,
    "bratanek / siostrzeniec",
    "bratanica / siostrzenica",
    "bratanek/siostrzenica",
  );
  if (removed <= 0) return base;
  return `${greatPrefix(removed)}${base}`;
}

function cousinLabel(degree: number, removal: number, gender: Gender): string {
  const base = genderWord(gender, "kuzyn", "kuzynka", "kuzynostwo");
  if (degree <= 1 && removal === 0) return base;
  const parts: string[] = [base];
  if (degree > 1) parts.push(`${degree}. stopnia`);
  if (removal === 1) parts.push("raz odsunięty/a");
  else if (removal > 1) parts.push(`${removal}× odsunięty/a`);
  return parts.join(" ");
}

function bloodLabels(
  genA: number,
  genB: number,
  genderA: Gender,
  genderB: Gender,
  halfSibling: boolean,
): { aToB: string; bToA: string } | null {
  // A is ancestor of B
  if (genB === 0 && genA > 0) {
    return {
      aToB: ancestorLabel(genA, genderA),
      bToA: descendantLabel(genA, genderB),
    };
  }
  // B is ancestor of A
  if (genA === 0 && genB > 0) {
    return {
      aToB: descendantLabel(genB, genderA),
      bToA: ancestorLabel(genB, genderB),
    };
  }
  // Siblings
  if (genA === 1 && genB === 1) {
    return {
      aToB: siblingLabel(genderA, halfSibling),
      bToA: siblingLabel(genderB, halfSibling),
    };
  }
  // Uncle/aunt — nephew/niece
  if (genA >= 2 && genB === 1) {
    const removed = genA - 2;
    return {
      aToB: uncleAuntLabel(genderA, removed),
      bToA: niblingLabel(genderB, removed),
    };
  }
  if (genB >= 2 && genA === 1) {
    const removed = genB - 2;
    return {
      aToB: niblingLabel(genderA, removed),
      bToA: uncleAuntLabel(genderB, removed),
    };
  }
  // Cousins (both at least 2 gens from LCA)
  if (genA >= 2 && genB >= 2) {
    const degree = Math.min(genA, genB) - 1;
    const removal = Math.abs(genA - genB);
    return {
      aToB: cousinLabel(degree, removal, genderA),
      bToA: cousinLabel(degree, removal, genderB),
    };
  }
  return null;
}

function shareParents(a: Person, b: Person): { full: boolean; half: boolean } {
  const shared = a.parentIds.filter((id) => b.parentIds.includes(id));
  if (shared.length >= 2) return { full: true, half: false };
  if (shared.length === 1) return { full: false, half: true };
  return { full: false, half: false };
}

function pathThroughLca(
  pathA: string[],
  pathB: string[],
  lcaId: string,
): string[] {
  const up = pathA.slice(); // personA … lca
  const down = pathB.slice().reverse(); // lca … personB — pathB is personB … lca
  // pathA ends with lca, pathB ends with lca
  const upToLca = up;
  const downFromLca = down.slice(1); // skip duplicate lca
  return [...upToLca, ...downFromLca];
}

function namesPath(ids: string[], map: Map<string, Person>): string[] {
  return ids.map((id) => {
    const p = map.get(id);
    return p ? displayName(p) : id;
  });
}

/** Spouse / in-law relationships (1–2 hops of affinity). */
function affinityRelation(
  a: Person,
  b: Person,
  map: Map<string, Person>,
  people: Person[],
): KinshipResult | null {
  if (a.spouseIds.includes(b.id) || b.spouseIds.includes(a.id)) {
    return {
      kind: "affinity",
      labelAtoB: genderWord(a.gender, "mąż", "żona", "małżonek/partner"),
      labelBtoA: genderWord(b.gender, "mąż", "żona", "małżonek/partner"),
      summary: "Małżeństwo / związek partnerski",
      path: [a.id, b.id],
    };
  }

  // A's spouse is blood-related to B
  for (const spouseId of a.spouseIds) {
    const spouse = map.get(spouseId);
    if (!spouse) continue;
    const blood = describeBlood(spouse, b, map, people);
    if (blood && blood.kind === "blood") {
      const inLaw = inLawFromSpouseBlood(a, blood.labelAtoB, true);
      const reverse = inLawFromSpouseBlood(b, blood.labelBtoA, false);
      return {
        kind: "affinity",
        labelAtoB: inLaw,
        labelBtoA: reverse,
        summary: `Przez małżonka/partnera: ${displayName(spouse)}`,
        path: [a.id, spouseId, ...blood.path.slice(1)],
        via: displayName(spouse),
      };
    }
  }

  // B's spouse is blood-related to A (symmetric catch)
  for (const spouseId of b.spouseIds) {
    const spouse = map.get(spouseId);
    if (!spouse) continue;
    const blood = describeBlood(a, spouse, map, people);
    if (blood && blood.kind === "blood") {
      return {
        kind: "affinity",
        labelAtoB: inLawFromSpouseBlood(a, blood.labelAtoB, false),
        labelBtoA: inLawFromSpouseBlood(b, blood.labelBtoA, true),
        summary: `Przez małżonka/partnera: ${displayName(spouse)}`,
        path: [...blood.path, b.id],
        via: displayName(spouse),
      };
    }
  }

  return null;
}

function inLawFromSpouseBlood(
  person: Person,
  spouseRelationToOther: string,
  personIsTheSpouseSide: boolean,
): string {
  // Rough Polish in-law mapping from spouse's blood label
  const g = person.gender;
  const rel = spouseRelationToOther.toLowerCase();

  if (personIsTheSpouseSide) {
    // person is spouse of someone related to the other
    if (rel.includes("matka") || rel.includes("ojciec") || rel === "rodzic") {
      return genderWord(g, "ojczym", "macocha", "ojczym/macocha");
    }
    if (rel.includes("syn") || rel.includes("córka") || rel === "dziecko") {
      return genderWord(g, "zięć", "synowa", "zięć/synowa");
    }
    if (rel.includes("brat") || rel.includes("siostra")) {
      return genderWord(g, "szwagor", "bratowa", "szwagrostwo");
    }
    if (rel.includes("dziadek") || rel.includes("babcia")) {
      return `małżonek/partner (${spouseRelationToOther})`;
    }
    return `przez małżeństwo: ${spouseRelationToOther}`;
  }

  // person is blood-related to the other's spouse
  if (rel.includes("matka") || rel.includes("ojciec") || rel === "rodzic") {
    return genderWord(g, "teść", "teściowa", "teściowie");
  }
  if (rel.includes("syn") || rel.includes("córka") || rel === "dziecko") {
    // wait - if spouse's relation to other is "syn", then person is parent of spouse = teść to other
    // This branch: a is blood to spouse of b. blood.labelAtoB is how a relates to spouse.
    // If a is parent of spouse → a is teść of b
    // Actually handled above when personIsTheSpouseSide is false and spouseRelation is from a to spouse
  }
  if (
    rel.includes("ojciec") ||
    rel.includes("matka") ||
    rel === "rodzic" ||
    rel.includes("dziadek") ||
    rel.includes("babcia")
  ) {
    // a is ancestor of b's spouse → teść-like
    if (rel.includes("ojciec") || rel.includes("matka") || rel === "rodzic") {
      return genderWord(g, "teść", "teściowa", "teściowie");
    }
  }
  if (rel.includes("syn") || rel.includes("córka") || rel === "dziecko") {
    return genderWord(g, "zięć", "synowa", "zięć/synowa");
  }
  if (rel.includes("brat") || rel.includes("siostra")) {
    return genderWord(g, "szwagor", "bratowa / szwagierka", "szwagrostwo");
  }
  return `przez powinowactwo (${spouseRelationToOther})`;
}

function describeBlood(
  a: Person,
  b: Person,
  map: Map<string, Person>,
  _people: Person[],
): KinshipResult | null {
  if (a.id === b.id) {
    return {
      kind: "self",
      labelAtoB: "ta sama osoba",
      labelBtoA: "ta sama osoba",
      summary: "To ta sama osoba",
      path: [a.id],
    };
  }

  const ancA = collectAncestors(a.id, map);
  const ancB = collectAncestors(b.id, map);

  // Is A ancestor of B?
  if (ancB.has(a.id)) {
    const info = ancB.get(a.id)!;
    const labels = bloodLabels(info.generation, 0, a.gender, b.gender, false)!;
    return {
      kind: "blood",
      labelAtoB: labels.aToB,
      labelBtoA: labels.bToA,
      summary: "Pokrewieństwo w linii prostej",
      path: info.path.slice().reverse(), // a … b
      via: displayName(a),
    };
  }
  // Is B ancestor of A?
  if (ancA.has(b.id)) {
    const info = ancA.get(b.id)!;
    const labels = bloodLabels(0, info.generation, a.gender, b.gender, false)!;
    return {
      kind: "blood",
      labelAtoB: labels.aToB,
      labelBtoA: labels.bToA,
      summary: "Pokrewieństwo w linii prostej",
      path: info.path, // a … b
      via: displayName(b),
    };
  }

  // LCA among shared ancestors — pick closest (min genA+genB, then min max)
  let best: {
    lcaId: string;
    genA: number;
    genB: number;
    pathA: string[];
    pathB: string[];
  } | null = null;

  for (const [id, infoA] of ancA) {
    const infoB = ancB.get(id);
    if (!infoB) continue;
    const score = infoA.generation + infoB.generation;
    const depth = Math.max(infoA.generation, infoB.generation);
    if (
      !best ||
      score < best.genA + best.genB ||
      (score === best.genA + best.genB &&
        depth < Math.max(best.genA, best.genB))
    ) {
      best = {
        lcaId: id,
        genA: infoA.generation,
        genB: infoB.generation,
        pathA: infoA.path,
        pathB: infoB.path,
      };
    }
  }

  if (!best) return null;

  const half =
    best.genA === 1 && best.genB === 1
      ? shareParents(a, b).half && !shareParents(a, b).full
      : false;

  const labels = bloodLabels(
    best.genA,
    best.genB,
    a.gender,
    b.gender,
    half,
  );
  if (!labels) return null;

  const lca = map.get(best.lcaId);
  const pathIds = pathThroughLca(best.pathA, best.pathB, best.lcaId);

  let summary = lca
    ? `Wspólny przodek: ${displayName(lca)}`
    : "Pokrewieństwo boczne";
  if (best.genA === 1 && best.genB === 1) {
    summary = half ? "Przyrodnie rodzeństwo" : "Rodzeństwo";
  }

  return {
    kind: "blood",
    labelAtoB: labels.aToB,
    labelBtoA: labels.bToA,
    summary,
    path: pathIds,
    via: lca ? displayName(lca) : undefined,
  };
}

/**
 * Describe who A is to B (and reverse).
 * Prefers blood; falls back to common in-law (affinity) ties.
 */
export function describeKinship(
  people: Person[],
  personAId: string,
  personBId: string,
): KinshipResult {
  const map = getPersonMap(people);
  const a = map.get(personAId);
  const b = map.get(personBId);

  if (!a || !b) {
    return {
      kind: "none",
      labelAtoB: "nieznane",
      labelBtoA: "nieznane",
      summary: "Nie znaleziono jednej z osób w bazie.",
      path: [],
    };
  }

  const blood = describeBlood(a, b, map, people);
  if (blood) {
    return {
      ...blood,
      path: namesPath(blood.path, map),
    };
  }

  const aff = affinityRelation(a, b, map, people);
  if (aff) {
    return {
      ...aff,
      path: namesPath(aff.path, map),
    };
  }

  // Last resort: sibling-in-law via checking if any of A's siblings married B
  for (const sibling of people) {
    if (sibling.id === a.id) continue;
    const sibShare = shareParents(a, sibling);
    if (!sibShare.full && !sibShare.half) continue;
    if (sibling.spouseIds.includes(b.id)) {
      return {
        kind: "affinity",
        labelAtoB: genderWord(a.gender, "szwagor", "bratowa / szwagierka", "szwagrostwo"),
        labelBtoA: genderWord(b.gender, "szwagor", "bratowa / szwagierka", "szwagrostwo"),
        summary: `Przez rodzeństwo: ${displayName(sibling)}`,
        path: namesPath([a.id, sibling.id, b.id], map),
        via: displayName(sibling),
      };
    }
  }

  return {
    kind: "none",
    labelAtoB: "brak znanego pokrewieństwa",
    labelBtoA: "brak znanego pokrewieństwa",
    summary:
      "Nie znaleziono wspólnego przodka ani oczywistego powinowactwa w danych.",
    path: [],
  };
}

/** Small helper exported for reuse */
export function relatedChildren(
  people: Person[],
  personId: string,
): string[] {
  return getChildrenIds(people, personId);
}
