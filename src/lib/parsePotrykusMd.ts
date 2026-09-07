import type { FamilyDatabase, Gender, Person } from "@/types/family";

const MONTH: Record<string, string> = {
  sty: "01",
  lut: "02",
  mar: "03",
  kwi: "04",
  maj: "05",
  cze: "06",
  lip: "07",
  sie: "08",
  wrz: "09",
  paź: "10",
  paz: "10",
  lis: "11",
  gru: "12",
};

function slug(parts: string[]): string {
  return parts
    .join("-")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

function polishDate(raw: string): string | undefined {
  const t = raw.trim().replace(/\/\d+/g, "");
  const dmy = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  const full = t.match(/^(\d{1,2})\s+([A-Za-zżźćńółęąś]+)\s+(\d{4})$/i);
  if (full) {
    const mon = MONTH[full[2].toLowerCase()];
    return mon ? `${full[3]}-${mon}-${full[1].padStart(2, "0")}` : full[3];
  }
  const y = t.match(/^(\d{4})$/);
  return y?.[1];
}

function datesFrom(text: string): { birth?: string; death?: string } {
  const birth = text.match(/\b(?:u\.|ur\.)\s+([^–—,;]+?)(?=\s+[–—-]|\s+z\.|\s+zm\.|$|,)/i);
  const death = text.match(/\b(?:z\.|zm\.)\s+([^–,;(]+?)(?=,|;|$|\s+małż)/i);
  return {
    birth: birth ? polishDate(birth[1]) : undefined,
    death: death ? polishDate(death[1]) : undefined,
  };
}

function inferGender(firstName: string): Gender {
  const first = firstName.split(/\s+/)[0] || "";
  if (/a$/i.test(first) && !/^(Bolesław|Mikołaj|Barnaba|Kuba)$/i.test(first)) {
    return "female";
  }
  if (
    /anna|maria|helena|elżbieta|matylda|gertruda|urszula|kunegunda|apolonia|cecylia|teresa|ewa|zofia|jadwiga|barbara/i.test(
      first,
    )
  ) {
    return "female";
  }
  return "male";
}

function splitPersonName(raw: string): {
  firstName: string;
  lastName: string;
  maidenName?: string;
} {
  let name = raw
    .replace(/\*\*/g, "")
    .replace(/^\d+\.\s*/, "")
    .replace(/^\(\s*córka\s*\)\s*/i, "córka ")
    .replace(/★/g, "")
    .replace(/\(SZUKANA OSOBA\)/gi, "")
    .replace(/\(pełne drzewo.*/i, "")
    .replace(/\(patrz.*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  const maiden = name.match(/z d\.\s+([^,;(]+)/i);
  if (maiden) name = name.replace(/\s*z d\.\s+[^,;(]+/i, "").trim();
  name = name.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  const bits = name.split(" ").filter(Boolean);
  if (bits.length === 0) return { firstName: "nn", lastName: "nn" };
  if (bits.length === 1) {
    return { firstName: bits[0], lastName: "nn", maidenName: maiden?.[1]?.trim() };
  }
  return {
    firstName: bits.slice(0, -1).join(" "),
    lastName: bits[bits.length - 1],
    maidenName: maiden?.[1]?.trim(),
  };
}

function personId(first: string, last: string, birth?: string): string {
  return slug([first, last, birth?.slice(0, 4) || "x"]);
}

function parseOne(chunk: string): Omit<Person, "parentIds" | "spouseIds"> | null {
  const cleaned = chunk.replace(/\*\*/g, "").trim();
  if (!cleaned || cleaned.length < 3) return null;
  if (/^nn\b/i.test(cleaned)) return null;
  if (/pokolenie|źródło|uwaga:|patrz tam|patrz czę/i.test(cleaned)) return null;
  const namePart = cleaned
    .split(/\s+(?:u\.|ur\.|z\.|zm\.|małż)/i)[0]
    .split("→")[0]
    .replace(/,+$/, "")
    .trim();
  if (!namePart || namePart.length < 2) return null;
  const names = splitPersonName(namePart);
  if (names.firstName === "nn") return null;
  if (/^córka$/i.test(names.firstName)) {
    names.firstName = "córka";
  }
  const { birth, death } = datesFrom(cleaned);
  return {
    id: personId(names.firstName, names.lastName, birth),
    firstName: names.firstName,
    lastName: names.lastName,
    maidenName: names.maidenName,
    gender: inferGender(names.firstName),
    birthDate: birth,
    deathDate: death,
  };
}

function parseClause(text: string): { self: string; spouse?: string; kids: string[] } {
  let rest = text.replace(/\*\*/g, "").trim().replace(/^\d+\.\s*/, "");
  const kids: string[] = [];
  const arrow = rest.split("→");
  rest = arrow[0];
  if (arrow[1]) {
    for (const piece of arrow[1].split(/,/)) {
      const t = piece.replace(/^\s*\d+\.\s*/, "").trim();
      if (t && t.length > 1) kids.push(t);
    }
  }
  const malz = rest.split(/\bmałż\.?\s*(?:\d{1,2}\s+\w+\s+\d{4}\s+)?/i);
  return {
    self: malz[0].replace(/,+\s*$/, "").trim(),
    spouse: malz[1]?.split(/→/)[0]?.replace(/,+\s*$/, "").trim() || undefined,
    kids,
  };
}

class FamilyBuilder {
  byId = new Map<string, Person>();

  add(partial: Omit<Person, "parentIds" | "spouseIds"> & { parentIds?: string[] }): Person {
    const existing = this.byId.get(partial.id);
    if (existing) {
      existing.birthDate ||= partial.birthDate;
      existing.deathDate ||= partial.deathDate;
      existing.maidenName ||= partial.maidenName;
      for (const pid of partial.parentIds ?? []) {
        if (!existing.parentIds.includes(pid)) existing.parentIds.push(pid);
      }
      return existing;
    }
    const person: Person = {
      ...partial,
      parentIds: [...(partial.parentIds ?? [])],
      spouseIds: [],
    };
    this.byId.set(person.id, person);
    return person;
  }

  fromText(text: string, parentIds: string[] = []): Person | null {
    const parsed = parseOne(text);
    if (!parsed) return null;
    return this.add({ ...parsed, parentIds });
  }

  spouses(a?: Person | null, c?: Person | null) {
    if (!a || !c || a.id === c.id) return;
    if (!a.spouseIds.includes(c.id)) a.spouseIds.push(c.id);
    if (!c.spouseIds.includes(a.id)) c.spouseIds.push(a.id);
  }

  child(child: Person, parents: Person[]) {
    for (const p of parents) {
      if (!child.parentIds.includes(p.id)) child.parentIds.push(p.id);
    }
  }
}

function addFamilyUnit(
  b: FamilyBuilder,
  text: string,
  parents: Person[],
): { person: Person; partner?: Person } | null {
  const { self, spouse, kids } = parseClause(text);
  const person = b.fromText(self, parents.map((p) => p.id));
  if (!person) return null;
  b.child(person, parents);
  let partner: Person | undefined;
  if (spouse) {
    partner = b.fromText(spouse) ?? undefined;
    if (partner) b.spouses(person, partner);
  }
  const couple = [person, partner].filter(Boolean) as Person[];
  for (const kid of kids) {
    const inner = parseClause(kid);
    let parsed = parseOne(inner.self);
    if (!parsed) continue;
    if (parsed.lastName === "nn" && couple[0]) {
      parsed = {
        ...parsed,
        lastName: couple[1]?.lastName || couple[0].lastName,
      };
      parsed.id = personId(parsed.firstName, parsed.lastName, parsed.birthDate);
    }
    const ch = b.add({ ...parsed, parentIds: couple.map((p) => p.id) });
    b.child(ch, couple);
    if (inner.spouse) {
      const kp = b.fromText(inner.spouse);
      if (kp) b.spouses(ch, kp);
    }
  }
  return { person, partner };
}

export function parsePotrykusMarkdown(markdown: string): FamilyDatabase {
  const b = new FamilyBuilder();

  const wincenty = b.add({
    id: "wincenty-potrykus-1810",
    firstName: "Wincenty",
    lastName: "Potrykus",
    gender: "male",
    birthDate: "1810-04-08",
    deathDate: "1870-08-13",
    notes: "Vincentius Marcelinus — oś drzewa z dokumentu MD",
  });
  const anna = b.add({
    id: "anna-szymanska-1820",
    firstName: "Anna",
    lastName: "Szymańska",
    gender: "female",
    birthDate: "1820-04-17",
    deathDate: "1884-08-27",
  });
  b.spouses(wincenty, anna);

  const antonius = b.add({
    id: "antonius-potrykus-1751",
    firstName: "Antonius",
    lastName: "Potrykus",
    gender: "male",
    birthDate: "1751-10-26",
  });
  const heva = b.add({
    id: "heva-ewa-drogosch-1771",
    firstName: "Heva Ewa",
    lastName: "Drogosch",
    gender: "female",
    birthDate: "1771-05-31",
    deathDate: "1830-12-24",
  });
  b.spouses(antonius, heva);
  b.child(wincenty, [antonius, heva]);

  const martinus = b.add({
    id: "martinus-potrykus-x",
    firstName: "Martinus",
    lastName: "Potrykus",
    gender: "male",
  });
  const rosaliaS = b.add({
    id: "rosalia-sadach-1722",
    firstName: "Rosalia",
    lastName: "Sadach",
    gender: "female",
    birthDate: "1722-02-24",
  });
  b.spouses(martinus, rosaliaS);
  b.child(antonius, [martinus, rosaliaS]);

  const gottfried = b.add({
    id: "gottfried-sadach-x",
    firstName: "Gottfried",
    lastName: "Sadach",
    gender: "male",
  });
  const elisabeth = b.add({
    id: "elisabeth-potrykus-x",
    firstName: "Elisabeth",
    lastName: "Potrykus",
    gender: "female",
  });
  b.spouses(gottfried, elisabeth);
  b.child(rosaliaS, [gottfried, elisabeth]);

  const joannesP = b.add({
    id: "joannes-potrykus-1665",
    firstName: "Joannes",
    lastName: "Potrykus",
    gender: "male",
    birthDate: "1665",
    deathDate: "1752-10-21",
  });
  const regina = b.add({
    id: "regina-grabacz-1664",
    firstName: "Regina",
    lastName: "Grabacz",
    gender: "female",
    birthDate: "1664-08-31",
  });
  b.spouses(joannesP, regina);
  b.child(elisabeth, [joannesP, regina]);

  const ignatius = b.add({
    id: "ignatius-potrykus-1801",
    firstName: "Ignatius",
    lastName: "Potrykus",
    gender: "male",
    birthDate: "1801",
  });
  const ludwik = b.add({
    id: "ludwik-potrykus-1804",
    firstName: "Ludwik",
    lastName: "Potrykus",
    gender: "male",
    birthDate: "1804-05-20",
    deathDate: "1862-05-07",
  });
  const augustinus = b.add({
    id: "augustinus-joannes-potrykus-1814",
    firstName: "Augustinus Joannes",
    lastName: "Potrykus",
    gender: "male",
    birthDate: "1814-01-18",
  });
  b.child(ignatius, [antonius, heva]);
  b.child(ludwik, [antonius, heva]);
  b.child(augustinus, [antonius, heva]);

  let mode: "c2" | "c3" | "d" | "e" | null = null;
  const stack: { gen: number; person: Person; partner?: Person }[] = [];
  let fx: Person | undefined;
  let franciszek1884: Person | undefined;
  const annaMarzejon = b.add({
    id: "anna-elzbieta-marzejon-1852",
    firstName: "Anna Elżbieta",
    lastName: "Marzejon",
    gender: "female",
    birthDate: "1852-02-22",
  });

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let pendingCouple: Person | undefined;

  for (const raw of lines) {
    const line = raw.trim();
    if (/Dzieci Wincentego/i.test(line)) {
      mode = "c2";
      continue;
    }
    if (/Wnuki Wincentego|dzieci Franciszka Xawerego/i.test(line)) {
      mode = "c3";
      continue;
    }
    if (/SEKCJA D/i.test(line)) {
      mode = "d";
      stack.length = 0;
      continue;
    }
    if (/SEKCJA E/i.test(line)) {
      mode = "e";
      stack.length = 0;
      continue;
    }
    if (/^## Uwagi/i.test(line)) break;

    const malzOnly = line.replace(/\*\*/g, "").trim().match(/^małż\.?\s+(.*)$/i);
    if (malzOnly && pendingCouple) {
      const partner = b.fromText(malzOnly[1]);
      if (partner) b.spouses(pendingCouple, partner);
      continue;
    }

    if (!mode) continue;

    const stripped = line.replace(/&nbsp;/g, "").replace(/\*\*/g, "").replace(/^[-#★\s]+/, "");
    const gm = stripped.match(/^(\d+)\.\s+(.*)$/);
    if (!gm) continue;
    const gen = Number(gm[1]);
    const body = gm[2];
    if (/pokolenie/i.test(body)) continue;

    if (mode === "c2") {
      const unit = addFamilyUnit(b, body, [wincenty, anna]);
      if (unit && /franciszek/i.test(unit.person.firstName) && /xawery/i.test(unit.person.firstName)) {
        fx = unit.person;
        b.spouses(fx, annaMarzejon);
      }
      pendingCouple = unit?.person;
      continue;
    }

    if (mode === "c3") {
      const parents = fx ? [fx, ...fx.spouseIds.map((id) => b.byId.get(id)!).filter(Boolean)] : [wincenty, anna];
      const unit = addFamilyUnit(b, body, parents as Person[]);
      if (unit && /franciszek/i.test(unit.person.firstName) && unit.person.birthDate?.startsWith("1884")) {
        franciszek1884 = unit.person;
      }
      pendingCouple = unit?.person;
      continue;
    }

    if (mode === "d" || mode === "e") {
      const sectionParents =
        mode === "d"
          ? ([franciszek1884, franciszek1884 ? b.byId.get(franciszek1884.spouseIds[0]!) : undefined].filter(
              Boolean,
            ) as Person[])
          : [];
      while (stack.length && stack[stack.length - 1].gen >= gen) stack.pop();
      const inherited =
        stack.length > 0
          ? ([stack[stack.length - 1].person, stack[stack.length - 1].partner].filter(Boolean) as Person[])
          : mode === "e"
            ? []
            : sectionParents;
      const unit = addFamilyUnit(b, body, inherited);
      if (!unit) continue;
      if (mode === "e" && gen === 3 && inherited.length === 0 && fx) {
        b.child(unit.person, [fx, ...fx.spouseIds.map((id) => b.byId.get(id)!).filter(Boolean)] as Person[]);
      }
      stack.push({ gen, person: unit.person, partner: unit.partner });
      pendingCouple = unit.person;
    }
  }

  if (fx) {
    b.child(fx, [wincenty, anna]);
    b.spouses(fx, annaMarzejon);
    const ghost = b.byId.get("anna-elzbieta-marzejon-x");
    if (ghost) {
      b.spouses(fx, annaMarzejon);
      fx.spouseIds = fx.spouseIds.filter((id) => id !== ghost.id);
      annaMarzejon.spouseIds = annaMarzejon.spouseIds.filter((id) => id !== ghost.id);
      b.byId.delete(ghost.id);
      for (const p of b.byId.values()) {
        p.parentIds = p.parentIds.map((id) => (id === ghost.id ? annaMarzejon.id : id));
        p.spouseIds = p.spouseIds.filter((id) => id !== ghost.id);
      }
    }
  }

  const helenaG = [...b.byId.values()].find(
    (p) => /helena/i.test(p.firstName) && /gursk/i.test(p.lastName),
  );
  if (franciszek1884 && helenaG) b.spouses(franciszek1884, helenaG);

  if (fx && franciszek1884) {
    for (const p of b.byId.values()) {
      if (
        p.parentIds.includes(franciszek1884.id) &&
        p.parentIds.includes(fx.id)
      ) {
        p.parentIds = p.parentIds.filter((id) => id !== franciszek1884.id);
      }
    }
  }

  for (const p of b.byId.values()) {
    p.parentIds = [...new Set(p.parentIds)].filter((pid) => {
      const par = b.byId.get(pid);
      if (!par?.birthDate || !p.birthDate) return true;
      const gap = Number(p.birthDate.slice(0, 4)) - Number(par.birthDate.slice(0, 4));
      return gap >= 16 && gap <= 70;
    });
    p.spouseIds = [...new Set(p.spouseIds)];
  }

  const people = [...b.byId.values()].filter((p) => p.firstName !== "nn");

  return {
    meta: {
      title: "Drzewo rodziny Potrykus",
      rootPersonId: wincenty.id,
      creator: "Adam Lieske",
      updatedAt: new Date().toISOString(),
      description:
        "Zaimportowane z załączonego Markdowna. Żywe dane są w Neon, nie w git.",
    },
    people,
  };
}
