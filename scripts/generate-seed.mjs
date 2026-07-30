/**
 * Seed generator for Potrykus family tree.
 * Data transcribed from printed genealogical pages (Franciszek Xawery Potrykus descendants).
 * Run: node scripts/generate-seed.mjs
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

/** @typedef {{ id: string, firstName: string, lastName: string, maidenName?: string, gender: 'male'|'female'|'unknown', birthDate?: string, deathDate?: string, photoUrl?: string, phone?: string, notes?: string, parentIds: string[], spouseIds: string[] }} Person */

/** @type {Person[]} */
const people = [];
const byKey = new Map();

function idOf(...parts) {
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

function add(p) {
  if (byKey.has(p.id)) {
    const existing = byKey.get(p.id);
    // merge sparse fields
    for (const k of Object.keys(p)) {
      if (p[k] != null && p[k] !== "" && (existing[k] == null || existing[k] === "" || (Array.isArray(existing[k]) && existing[k].length === 0))) {
        existing[k] = p[k];
      }
    }
    if (p.parentIds?.length) {
      existing.parentIds = [...new Set([...existing.parentIds, ...p.parentIds])];
    }
    if (p.spouseIds?.length) {
      existing.spouseIds = [...new Set([...existing.spouseIds, ...p.spouseIds])];
    }
    return existing;
  }
  const person = {
    photoUrl: undefined,
    phone: undefined,
    notes: undefined,
    maidenName: undefined,
    ...p,
    parentIds: [...(p.parentIds || [])],
    spouseIds: [...(p.spouseIds || [])],
  };
  people.push(person);
  byKey.set(person.id, person);
  return person;
}

function linkSpouses(aId, bId) {
  const a = byKey.get(aId);
  const b = byKey.get(bId);
  if (!a || !b) return;
  if (!a.spouseIds.includes(bId)) a.spouseIds.push(bId);
  if (!b.spouseIds.includes(aId)) b.spouseIds.push(aId);
}

function person(opts) {
  const id =
    opts.id ||
    idOf(opts.firstName, opts.lastName, opts.birthDate || opts.maidenName || "x");
  return add({
    id,
    firstName: opts.firstName,
    lastName: opts.lastName,
    maidenName: opts.maidenName,
    gender: opts.gender,
    birthDate: opts.birthDate,
    deathDate: opts.deathDate,
    phone: opts.phone,
    notes: opts.notes,
    parentIds: opts.parentIds || [],
    spouseIds: opts.spouseIds || [],
  });
}

// ——— Generation 1: Franciszek Xawery Potrykus (root) ———
const fx = person({
  id: "franciszek-xawery-potrykus",
  firstName: "Franciszek Xawery",
  lastName: "Potrykus",
  gender: "male",
  notes: "Przodek — potomkowie według dokumentu rodzinnego",
});

// Gen 2 siblings (from page 6)
const leokadia = person({
  firstName: "Leokadia Elizabeth",
  lastName: "Potrykus",
  gender: "female",
  birthDate: "1888-11-19",
  parentIds: [fx.id],
});
const xaverAdam = person({
  firstName: "Xaver Adam",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1890-01-25",
  parentIds: [fx.id],
});
const jozefEdward = person({
  firstName: "Józef Edward",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1891-10-26",
  deathDate: "1950-11-19",
  parentIds: [fx.id],
});
const matyldaDrzezd = person({
  firstName: "Matylda",
  lastName: "Potrykus",
  maidenName: "Drzeżdżon",
  gender: "female",
  birthDate: "1895-12-10",
  deathDate: "1980-07-13",
});
linkSpouses(jozefEdward.id, matyldaDrzezd.id);

person({
  firstName: "Eryka",
  lastName: "Potrykus",
  gender: "female",
  birthDate: "1925-02-27",
  deathDate: "1999-03-12",
  parentIds: [jozefEdward.id, matyldaDrzezd.id],
});
person({
  firstName: "Matylda",
  lastName: "Potrykus",
  gender: "female",
  parentIds: [jozefEdward.id, matyldaDrzezd.id],
});
person({
  firstName: "Brunon",
  lastName: "Potrykus",
  gender: "male",
  parentIds: [jozefEdward.id, matyldaDrzezd.id],
});
person({
  firstName: "Władysław",
  lastName: "Potrykus",
  gender: "male",
  id: "wladyslaw-potrykus-jozef-edward",
  parentIds: [jozefEdward.id, matyldaDrzezd.id],
});

person({
  firstName: "Theophil (Teofil)",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1893-10-11",
  deathDate: "1899-06-19",
  parentIds: [fx.id],
});

const antoni = person({
  firstName: "Antoni",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1897-05-04",
  deathDate: "1945-03-27",
  parentIds: [fx.id],
});
const gertruda = person({
  firstName: "Gertruda",
  lastName: "Potrykus",
  maidenName: "Dorsch",
  gender: "female",
  birthDate: "1900-11-13",
  deathDate: "1988-07-16",
  notes: "ślub 3 lip 1921",
});
linkSpouses(antoni.id, gertruda.id);

// ——— Antoni & Gertruda line ———
const grzegorz = person({
  firstName: "Grzegorz",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1922-09-10",
  deathDate: "2001-09-25",
  parentIds: [antoni.id, gertruda.id],
});
const urszula = person({
  firstName: "Urszula",
  lastName: "Potrykus",
  maidenName: "Engling",
  gender: "female",
  birthDate: "1922-08-30",
  deathDate: "2004-06-11",
});
linkSpouses(grzegorz.id, urszula.id);

const wieslawa = person({
  firstName: "Wiesława",
  lastName: "Schroeder",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1949-05-14",
  deathDate: "2003-04-23",
  parentIds: [grzegorz.id, urszula.id],
});
const ryszardSch = person({
  firstName: "Ryszard",
  lastName: "Schroeder",
  gender: "male",
});
linkSpouses(wieslawa.id, ryszardSch.id);
person({
  firstName: "Izabela",
  lastName: "Schroeder",
  gender: "female",
  parentIds: [wieslawa.id, ryszardSch.id],
});
person({
  firstName: "Przemysław",
  lastName: "Schroeder",
  gender: "male",
  parentIds: [wieslawa.id, ryszardSch.id],
});

const irenaP = person({
  firstName: "Irena",
  lastName: "Konieczny",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1950",
  parentIds: [grzegorz.id, urszula.id],
});
const miroslawK = person({
  firstName: "Mirosław",
  lastName: "Konieczny",
  gender: "male",
});
linkSpouses(irenaP.id, miroslawK.id);
person({
  firstName: "Dominik",
  lastName: "Konieczny",
  gender: "male",
  parentIds: [irenaP.id, miroslawK.id],
});

const mieczyslaw = person({
  firstName: "Mieczysław",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1951-11-16",
  parentIds: [grzegorz.id, urszula.id],
});
const renata = person({
  firstName: "Renata",
  lastName: "Potrykus",
  maidenName: "Figlarek",
  gender: "female",
  birthDate: "1951",
  deathDate: "2012-10-18",
});
linkSpouses(mieczyslaw.id, renata.id);
person({
  firstName: "Piotr",
  lastName: "Potrykus",
  gender: "male",
  id: "piotr-potrykus-mieczyslaw",
  parentIds: [mieczyslaw.id, renata.id],
});
person({
  firstName: "Sławomir",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1972-05-30",
  id: "slawomir-potrykus-mieczyslaw",
  parentIds: [mieczyslaw.id, renata.id],
});

const andrzejP = person({
  firstName: "Andrzej",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1954-09-10",
  parentIds: [grzegorz.id, urszula.id],
});
const bozenaPal = person({
  firstName: "Bożena",
  lastName: "Potrykus",
  maidenName: "Palach",
  gender: "female",
  birthDate: "1955-09-04",
});
linkSpouses(andrzejP.id, bozenaPal.id);

const marianP = person({
  firstName: "Marian",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1957-12-22",
  parentIds: [grzegorz.id, urszula.id],
});
const mariaKarcz = person({
  firstName: "Maria",
  lastName: "Potrykus",
  maidenName: "Karczewska",
  gender: "female",
  birthDate: "1954-09-13",
});
linkSpouses(marianP.id, mariaKarcz.id);
const danielP = person({
  firstName: "Daniel",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1978-07-10",
  parentIds: [marianP.id, mariaKarcz.id],
});
const kingaPur = person({
  firstName: "Kinga",
  lastName: "Potrykus",
  maidenName: "Purzycka",
  gender: "female",
});
linkSpouses(danielP.id, kingaPur.id);

// ——— Major gen-3 line under FX (Stanisław, Józef, Władysław, Walerian, Helena, Bronisław, Antoni 1924) ———
// These appear as children of an intermediate generation; we attach them under a placeholder "linia główna"
// For clarity we model them as children of FX's descendant line via a synthetic mid-generation
// Actually documents show them as gen 3 under Franciszek Xawery - so parent is FX or his son.
// We'll attach gen-3 Potrykus siblings as children of a "pokolenie 2 — linia główna" person representing the connecting ancestor.

const liniaGlowna = person({
  id: "linia-glowna-potrykus",
  firstName: "Linia główna",
  lastName: "Potrykus",
  gender: "unknown",
  notes: "Łącznik pokoleniowy (dane przodka do uzupełnienia z pełnego dokumentu)",
  parentIds: [fx.id],
});

// Helena Potrykus + Józef Hallmann
const helena = person({
  firstName: "Helena",
  lastName: "Hallmann",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1921-07-20",
  deathDate: "1998-12-19",
  parentIds: [liniaGlowna.id],
});
const jozefHall = person({
  firstName: "Józef",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1909-11-12",
  deathDate: "1999-06-09",
  notes: "ślub 11 lis 1947",
});
linkSpouses(helena.id, jozefHall.id);

const genowefa = person({
  firstName: "Genowefa",
  lastName: "Szornak",
  maidenName: "Hallmann",
  gender: "female",
  birthDate: "1948-09-06",
  parentIds: [helena.id, jozefHall.id],
});
const karolSz = person({
  firstName: "Karol",
  lastName: "Szornak",
  gender: "male",
  birthDate: "1941-10-19",
  deathDate: "2008-05-17",
});
linkSpouses(genowefa.id, karolSz.id);

const hannaSz = person({
  firstName: "Hanna",
  lastName: "Miotk",
  maidenName: "Szornak",
  gender: "female",
  birthDate: "1968-09-18",
  parentIds: [genowefa.id, karolSz.id],
});
const jozefMiotk = person({
  firstName: "Józef",
  lastName: "Miotk",
  gender: "male",
  birthDate: "1968-01-09",
});
linkSpouses(hannaSz.id, jozefMiotk.id);
for (const [fn, bd] of [
  ["Oskar", "1996-05-01"],
  ["Eryk", "1998-03-14"],
  ["Dawid", "1999-07-15"],
  ["Kacper", "2005-01-06"],
]) {
  person({
    firstName: fn,
    lastName: "Miotk",
    gender: "male",
    birthDate: bd,
    parentIds: [hannaSz.id, jozefMiotk.id],
  });
}

const grzegorzSz = person({
  firstName: "Grzegorz",
  lastName: "Szornak",
  gender: "male",
  birthDate: "1971-03-12",
  parentIds: [genowefa.id, karolSz.id],
});
const beataSz = person({
  firstName: "Beata",
  lastName: "Szornak",
  maidenName: "Szeszko",
  gender: "female",
  birthDate: "1971-08-16",
});
linkSpouses(grzegorzSz.id, beataSz.id);
person({
  firstName: "Aleksandra",
  lastName: "Szornak",
  gender: "female",
  birthDate: "1992-11-27",
  parentIds: [grzegorzSz.id, beataSz.id],
});

const malgorzataSz = person({
  firstName: "Małgorzata",
  lastName: "Boczyński",
  maidenName: "Szornak",
  gender: "female",
  birthDate: "1976-09-15",
  parentIds: [genowefa.id, karolSz.id],
});
const grzegorzBoc = person({
  firstName: "Grzegorz",
  lastName: "Boczyński",
  gender: "male",
  birthDate: "1981-09-09",
});
linkSpouses(malgorzataSz.id, grzegorzBoc.id);
person({
  firstName: "Kamil",
  lastName: "Boczyński",
  gender: "male",
  birthDate: "2003-07-10",
  parentIds: [malgorzataSz.id, grzegorzBoc.id],
});

// More Hallmann children of Helena
const helenaHallmann = person({
  firstName: "Helena",
  lastName: "Kiepke",
  maidenName: "Hallmann",
  gender: "female",
  birthDate: "1949-09-22",
  parentIds: [helena.id, jozefHall.id],
});
const herbertK = person({
  firstName: "Herbert",
  lastName: "Kiepke",
  gender: "male",
  birthDate: "1943-09-17",
  deathDate: "1987-02-14",
});
linkSpouses(helenaHallmann.id, herbertK.id);
person({
  firstName: "Gabriela",
  lastName: "Kiepke",
  gender: "female",
  birthDate: "1972-07-14",
  parentIds: [helenaHallmann.id, herbertK.id],
});
const marekK = person({
  firstName: "Marek",
  lastName: "Kiepke",
  gender: "male",
  birthDate: "1974-06-14",
  parentIds: [helenaHallmann.id, herbertK.id],
});
const marzenaO = person({
  firstName: "Marzena",
  lastName: "Kiepke",
  maidenName: "Okoń",
  gender: "female",
  birthDate: "1973-05-20",
});
linkSpouses(marekK.id, marzenaO.id);
person({
  firstName: "Kinga",
  lastName: "Kiepke",
  gender: "female",
  birthDate: "2007-04-08",
  parentIds: [marekK.id, marzenaO.id],
});
person({
  firstName: "Konrad",
  lastName: "Kiepke",
  gender: "male",
  birthDate: "2009-06-18",
  parentIds: [marekK.id, marzenaO.id],
});
const teresaK = person({
  firstName: "Teresa",
  lastName: "Kosmala",
  maidenName: "Kiepke",
  gender: "female",
  birthDate: "1977-10-31",
  parentIds: [helenaHallmann.id, herbertK.id],
});
const tomaszKos = person({
  firstName: "Tomasz",
  lastName: "Kosmala",
  gender: "male",
});
linkSpouses(teresaK.id, tomaszKos.id);
person({
  firstName: "Nikodem",
  lastName: "Kosmala",
  gender: "male",
  birthDate: "2005-11-08",
  parentIds: [teresaK.id, tomaszKos.id],
});
person({
  firstName: "Mateusz",
  lastName: "Kosmala",
  gender: "male",
  birthDate: "2009-11-15",
  parentIds: [teresaK.id, tomaszKos.id],
});

person({
  firstName: "Adam",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1950-11-24",
  deathDate: "1950-11-24",
  parentIds: [helena.id, jozefHall.id],
});
person({
  firstName: "Łucja",
  lastName: "Hallmann",
  gender: "female",
  birthDate: "1951-12-12",
  deathDate: "1959-07-22",
  parentIds: [helena.id, jozefHall.id],
});

const franHall = person({
  firstName: "Franciszek",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1953-02-19",
  parentIds: [helena.id, jozefHall.id],
});
const ludgarda = person({
  firstName: "Ludgarda",
  lastName: "Hallmann",
  maidenName: "Górska",
  gender: "female",
  birthDate: "1954-12-24",
});
linkSpouses(franHall.id, ludgarda.id);
const monikaH = person({
  firstName: "Monika",
  lastName: "Czujkowski",
  maidenName: "Hallmann",
  gender: "female",
  birthDate: "1979-10-02",
  parentIds: [franHall.id, ludgarda.id],
});
const piotrCz = person({
  firstName: "Piotr",
  lastName: "Czujkowski",
  gender: "male",
});
linkSpouses(monikaH.id, piotrCz.id);
const magdaH = person({
  firstName: "Magdalena",
  lastName: "Marszall",
  maidenName: "Hallmann",
  gender: "female",
  birthDate: "1981-07-06",
  parentIds: [franHall.id, ludgarda.id],
});
const marcinMars = person({
  firstName: "Marcin",
  lastName: "Marszall",
  gender: "male",
  birthDate: "1980-07-03",
});
linkSpouses(magdaH.id, marcinMars.id);
person({
  firstName: "Aleksandra",
  lastName: "Marszall",
  gender: "female",
  birthDate: "2007-11-17",
  parentIds: [magdaH.id, marcinMars.id],
});

person({
  firstName: "Stanisław",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1955-05-12",
  deathDate: "2004-01-24",
  parentIds: [helena.id, jozefHall.id],
});

const jozefHall2 = person({
  firstName: "Józef",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1957-07-30",
  id: "jozef-hallmann-1957",
  parentIds: [helena.id, jozefHall.id],
});
const miroslawaKars = person({
  firstName: "Mirosława",
  lastName: "Hallmann",
  maidenName: "Karsznia",
  gender: "female",
  birthDate: "1959-11-25",
});
linkSpouses(jozefHall2.id, miroslawaKars.id);
const lukaszH = person({
  firstName: "Łukasz",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1981-05-26",
  parentIds: [jozefHall2.id, miroslawaKars.id],
});
const aleksandraGr = person({
  firstName: "Aleksandra",
  lastName: "Hallmann",
  maidenName: "Grubba",
  gender: "female",
  birthDate: "1982-12-14",
});
linkSpouses(lukaszH.id, aleksandraGr.id);
person({
  firstName: "Maja",
  lastName: "Hallmann",
  gender: "female",
  birthDate: "2003-04-17",
  parentIds: [lukaszH.id, aleksandraGr.id],
});

const marianHall = person({
  firstName: "Marian",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1960-03-25",
  parentIds: [helena.id, jozefHall.id],
});
const anitaKol = person({
  firstName: "Anita",
  lastName: "Hallmann",
  maidenName: "Kołoszyńska",
  gender: "female",
  birthDate: "1963-10-16",
});
linkSpouses(marianHall.id, anitaKol.id);
const monikaHall2 = person({
  firstName: "Monika",
  lastName: "Witkowski",
  maidenName: "Hallmann",
  gender: "female",
  birthDate: "1983-04-13",
  id: "monika-hallmann-1983",
  parentIds: [marianHall.id, anitaKol.id],
});
const waldemarWit = person({
  firstName: "Waldemar",
  lastName: "Witkowski",
  gender: "male",
  birthDate: "1981-08-09",
});
linkSpouses(monikaHall2.id, waldemarWit.id);
person({
  firstName: "Melisa",
  lastName: "Witkowska",
  gender: "female",
  parentIds: [monikaHall2.id, waldemarWit.id],
});
person({
  firstName: "Róża",
  lastName: "Witkowska",
  gender: "female",
  birthDate: "2004-06-12",
  parentIds: [monikaHall2.id, waldemarWit.id],
});
const boguslawaH = person({
  firstName: "Bogusława",
  lastName: "Lehman",
  maidenName: "Hallmann",
  gender: "female",
  birthDate: "1983",
  parentIds: [marianHall.id, anitaKol.id],
});
const tomaszLeh = person({
  firstName: "Tomasz",
  lastName: "Lehman",
  gender: "male",
});
linkSpouses(boguslawaH.id, tomaszLeh.id);
person({
  firstName: "Jadwiga",
  lastName: "Hallmann",
  gender: "female",
  birthDate: "1992-10-15",
  parentIds: [marianHall.id, anitaKol.id],
});
person({
  firstName: "Weronika",
  lastName: "Hallmann",
  gender: "female",
  birthDate: "1994-01-13",
  deathDate: "2008-02-03",
  parentIds: [marianHall.id, anitaKol.id],
});
person({
  firstName: "Józef",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1996-04-27",
  id: "jozef-hallmann-1996",
  parentIds: [marianHall.id, anitaKol.id],
});

const bronislawH = person({
  firstName: "Bronisław",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1961-12-11",
  parentIds: [helena.id, jozefHall.id],
});
const bozenaMach = person({
  firstName: "Bożena",
  lastName: "Hallmann",
  maidenName: "Machalińska",
  gender: "female",
  birthDate: "1965-04-26",
});
linkSpouses(bronislawH.id, bozenaMach.id);
const katarzynaH = person({
  firstName: "Katarzyna",
  lastName: "Drzeżdżon",
  maidenName: "Hallmann",
  gender: "female",
  birthDate: "1983-11-30",
  parentIds: [bronislawH.id, bozenaMach.id],
});
const bartoszDrz = person({
  firstName: "Bartosz",
  lastName: "Drzeżdżon",
  gender: "male",
});
linkSpouses(katarzynaH.id, bartoszDrz.id);
person({
  firstName: "Anna",
  lastName: "Drzeżdżon",
  gender: "female",
  birthDate: "2006-11-18",
  parentIds: [katarzynaH.id, bartoszDrz.id],
});
person({
  firstName: "Radosław",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1988-12-06",
  parentIds: [bronislawH.id, bozenaMach.id],
});

const czeslawH = person({
  firstName: "Czesław",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1963-07-01",
  parentIds: [helena.id, jozefHall.id],
});
const mariaKol = person({
  firstName: "Maria",
  lastName: "Hallmann",
  maidenName: "Kołoszyńska",
  gender: "female",
});
linkSpouses(czeslawH.id, mariaKol.id);
person({
  firstName: "Michał Przemysław",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1990-08-13",
  parentIds: [czeslawH.id, mariaKol.id],
});
person({
  firstName: "Bartosz",
  lastName: "Hallmann",
  gender: "male",
  birthDate: "1993-05-11",
  parentIds: [czeslawH.id, mariaKol.id],
});

// ——— Bronisław Potrykus 1922 ———
const bronislawP = person({
  firstName: "Bronisław",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1922-10-31",
  parentIds: [liniaGlowna.id],
});
const stanislawaHol = person({
  firstName: "Stanisława",
  lastName: "Potrykus",
  maidenName: "Hollender",
  gender: "female",
});
linkSpouses(bronislawP.id, stanislawaHol.id);
person({
  firstName: "Jan",
  lastName: "Potrykus",
  gender: "male",
  id: "jan-potrykus-bronislaw",
  parentIds: [bronislawP.id, stanislawaHol.id],
});
person({
  firstName: "Bronisław",
  lastName: "Potrykus",
  gender: "male",
  id: "bronislaw-potrykus-jr",
  parentIds: [bronislawP.id, stanislawaHol.id],
});

// ——— Antoni Potrykus 1924 + Teresa ———
const antoni24 = person({
  firstName: "Antoni",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1924-04-23",
  deathDate: "1989-03-06",
  id: "antoni-potrykus-1924",
  parentIds: [liniaGlowna.id],
});
const teresaKup = person({
  firstName: "Teresa",
  lastName: "Potrykus",
  maidenName: "Kupferschmidt",
  gender: "female",
  birthDate: "1930-08-06",
});
linkSpouses(antoni24.id, teresaKup.id);
const mariaPion = person({
  firstName: "Maria",
  lastName: "Piontek",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1954-02-17",
  parentIds: [antoni24.id, teresaKup.id],
});
const adamPion = person({
  firstName: "Adam",
  lastName: "Piontek",
  gender: "male",
  birthDate: "1941-01-27",
});
linkSpouses(mariaPion.id, adamPion.id);

const danielPion = person({
  firstName: "Daniel",
  lastName: "Piontek",
  gender: "male",
  birthDate: "1977-02-12",
  parentIds: [mariaPion.id, adamPion.id],
});
const urszulaKlon = person({
  firstName: "Urszula",
  lastName: "Piontek",
  maidenName: "Klonowska",
  gender: "female",
  birthDate: "1984-08-14",
});
linkSpouses(danielPion.id, urszulaKlon.id);
person({
  firstName: "Dawid",
  lastName: "Piontek",
  gender: "male",
  birthDate: "2004-06-01",
  parentIds: [danielPion.id, urszulaKlon.id],
});
person({
  firstName: "Aleksandra",
  lastName: "Piontek",
  gender: "female",
  birthDate: "2007-07-29",
  parentIds: [danielPion.id, urszulaKlon.id],
});

const lucynaPion = person({
  firstName: "Lucyna",
  lastName: "Trendel",
  maidenName: "Piontek",
  gender: "female",
  birthDate: "1978-08-15",
  parentIds: [mariaPion.id, adamPion.id],
});
const arkadiuszTren = person({
  firstName: "Arkadiusz Stanisław",
  lastName: "Trendel",
  gender: "male",
  birthDate: "1975-12-11",
});
linkSpouses(lucynaPion.id, arkadiuszTren.id);
for (const [fn, bd, g] of [
  ["Dominika", "1995-09-24", "female"],
  ["Damian", "1997-04-07", "male"],
  ["Kordian", "1998-06-03", "male"],
]) {
  person({
    firstName: fn,
    lastName: "Trendel",
    gender: g,
    birthDate: bd,
    parentIds: [lucynaPion.id, arkadiuszTren.id],
  });
}

const mariaPion2 = person({
  firstName: "Maria",
  lastName: "Antosiewicz",
  maidenName: "Piontek",
  gender: "female",
  birthDate: "1979-08-17",
  id: "maria-piontek-1979",
  parentIds: [mariaPion.id, adamPion.id],
});
const michalAnt = person({
  firstName: "Michał",
  lastName: "Antosiewicz",
  gender: "male",
  birthDate: "1975-08-31",
});
linkSpouses(mariaPion2.id, michalAnt.id);
person({
  firstName: "Amadeusz",
  lastName: "Antosiewicz",
  gender: "male",
  birthDate: "2006-06-03",
  parentIds: [mariaPion2.id, michalAnt.id],
});

const elzbietaPion = person({
  firstName: "Elżbieta",
  lastName: "Czarnecki",
  maidenName: "Piontek",
  gender: "female",
  birthDate: "1983-04-14",
  parentIds: [mariaPion.id, adamPion.id],
});
const marekCzar = person({
  firstName: "Marek",
  lastName: "Czarnecki",
  gender: "male",
  birthDate: "1963-07-14",
});
linkSpouses(elzbietaPion.id, marekCzar.id);
person({
  firstName: "Fabian",
  lastName: "Piontek",
  gender: "male",
  birthDate: "2004-11-29",
  parentIds: [elzbietaPion.id, marekCzar.id],
  notes: "Nazwisko według dokumentu rodzinnego",
});
person({
  firstName: "Barbara",
  lastName: "Piontek",
  gender: "female",
  birthDate: "1992-09-02",
  parentIds: [mariaPion.id, adamPion.id],
});

// ——— Stanisław Potrykus 1925 ———
const stanislaw25 = person({
  firstName: "Stanisław",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1925-11-12",
  deathDate: "1993-12-16",
  parentIds: [liniaGlowna.id],
});
const rozalia = person({
  firstName: "Rozalia",
  lastName: "Potrykus",
  maidenName: "Kollek",
  gender: "female",
  birthDate: "1925-11-16",
  deathDate: "2009-05-28",
  notes: "ślub 1948",
});
linkSpouses(stanislaw25.id, rozalia.id);

const tadeuszP = person({
  firstName: "Tadeusz",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1949-06-20",
  parentIds: [stanislaw25.id, rozalia.id],
});
const ewaKrol = person({
  firstName: "Ewa",
  lastName: "Potrykus",
  maidenName: "Królikowska",
  gender: "female",
  birthDate: "1952-01-31",
});
linkSpouses(tadeuszP.id, ewaKrol.id);
const aleksandraP = person({
  firstName: "Aleksandra",
  lastName: "Wojciechowski",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1973-05-31",
  parentIds: [tadeuszP.id, ewaKrol.id],
});
const piotrWoj = person({
  firstName: "Piotr",
  lastName: "Wojciechowski",
  gender: "male",
});
linkSpouses(aleksandraP.id, piotrWoj.id);
person({
  firstName: "Maja",
  lastName: "Wojciechowska",
  gender: "female",
  birthDate: "2009-03-06",
  parentIds: [aleksandraP.id, piotrWoj.id],
});
person({
  firstName: "Błażej",
  lastName: "Wojciechowski",
  gender: "male",
  birthDate: "2010-12",
  parentIds: [aleksandraP.id, piotrWoj.id],
});
person({
  firstName: "Agnieszka",
  lastName: "Potrykus",
  gender: "female",
  birthDate: "1986-08-18",
  id: "agnieszka-potrykus-1986",
  parentIds: [tadeuszP.id, ewaKrol.id],
});

const elzbietaLieder = person({
  firstName: "Elżbieta",
  lastName: "Lieder",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1959-03-05",
  parentIds: [stanislaw25.id, rozalia.id],
  notes: "Ciocia Ela — organizacja spotkań rodzinnych",
  phone: undefined, // sensitive — fill privately
});
const jerzyLieder = person({
  firstName: "Jerzy",
  lastName: "Lieder",
  gender: "male",
  birthDate: "1956-09-07",
});
linkSpouses(elzbietaLieder.id, jerzyLieder.id);

const iwonaL = person({
  firstName: "Iwona",
  lastName: "Kryszewski",
  maidenName: "Lieder",
  gender: "female",
  birthDate: "1985-07-22",
  parentIds: [elzbietaLieder.id, jerzyLieder.id],
});
const karolKry = person({
  firstName: "Karol",
  lastName: "Kryszewski",
  gender: "male",
  birthDate: "1982",
  notes: "ślub 28 sty 2012",
});
linkSpouses(iwonaL.id, karolKry.id);
person({
  firstName: "Maciej",
  lastName: "Lieder",
  gender: "male",
  birthDate: "1988-02-13",
  parentIds: [elzbietaLieder.id, jerzyLieder.id],
});
person({
  firstName: "Rafał",
  lastName: "Lieder",
  gender: "male",
  birthDate: "1990-11-05",
  parentIds: [elzbietaLieder.id, jerzyLieder.id],
});

// ——— Józef Potrykus 1927 ———
const jozef27 = person({
  firstName: "Józef",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1927-02-08",
  deathDate: "2001-07-04",
  parentIds: [liniaGlowna.id],
});
const jadwigaTren = person({
  firstName: "Jadwiga",
  lastName: "Potrykus",
  maidenName: "Trendel",
  gender: "female",
  birthDate: "1928-06-27",
  deathDate: "2008-07-06",
});
linkSpouses(jozef27.id, jadwigaTren.id);

const malgorzataOkroj = person({
  firstName: "Małgorzata",
  lastName: "Okrój",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1954-04-04",
  parentIds: [jozef27.id, jadwigaTren.id],
});
const janOkroj = person({
  firstName: "Jan",
  lastName: "Okrój",
  gender: "male",
  birthDate: "1954-06-20",
});
linkSpouses(malgorzataOkroj.id, janOkroj.id);

const fran56 = person({
  firstName: "Franciszek",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1956-01-29",
  deathDate: "2009-08-07",
  id: "franciszek-potrykus-1956",
  parentIds: [jozef27.id, jadwigaTren.id],
});
const irenaPac = person({
  firstName: "Irena",
  lastName: "Potrykus",
  maidenName: "Paczul",
  gender: "female",
  birthDate: "1956-02-26",
});
linkSpouses(fran56.id, irenaPac.id);

const sylwia = person({
  firstName: "Sylwia",
  lastName: "Chmiel",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1979-08-01",
  parentIds: [fran56.id, irenaPac.id],
});
const adrianCh = person({
  firstName: "Adrian",
  lastName: "Chmiel",
  gender: "male",
  birthDate: "1982-03-05",
});
linkSpouses(sylwia.id, adrianCh.id);
for (const [fn, bd, g] of [
  ["Natalia", "2003-06-24", "female"],
  ["Marcin", "2006-04-02", "male"],
  ["Mateusz", "2008-12-28", "male"],
]) {
  person({
    firstName: fn,
    lastName: "Chmiel",
    gender: g,
    birthDate: bd,
    parentIds: [sylwia.id, adrianCh.id],
  });
}

const justynaJak = person({
  firstName: "Justyna",
  lastName: "Jakubczyk",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1987-01-10",
  parentIds: [fran56.id, irenaPac.id],
});
const lukaszJak = person({
  firstName: "Łukasz",
  lastName: "Jakubczyk",
  gender: "male",
  birthDate: "1987-08-25",
});
linkSpouses(justynaJak.id, lukaszJak.id);
person({
  firstName: "Jakub",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "2008-11-08",
  id: "jakub-potrykus-2008",
  parentIds: [justynaJak.id, lukaszJak.id],
  notes: "Nazwisko według dokumentu",
});

// ——— Władysław Potrykus 1928 + Maria Hallmann ———
const wladyslaw28 = person({
  firstName: "Władysław",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1928-06-11",
  deathDate: "1997-11-18",
  parentIds: [liniaGlowna.id],
});
const mariaHallSpouse = person({
  firstName: "Maria",
  lastName: "Potrykus",
  maidenName: "Hallmann",
  gender: "female",
  birthDate: "1936-04-25",
});
linkSpouses(wladyslaw28.id, mariaHallSpouse.id);

const stanislaw56 = person({
  firstName: "Stanisław",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1956-05-18",
  deathDate: "1997-06-22",
  id: "stanislaw-potrykus-1956",
  parentIds: [wladyslaw28.id, mariaHallSpouse.id],
});
const malgorzataKol = person({
  firstName: "Małgorzata",
  lastName: "Potrykus",
  maidenName: "Kollek",
  gender: "female",
  birthDate: "1959-06-28",
});
linkSpouses(stanislaw56.id, malgorzataKol.id);
person({
  firstName: "Weronika",
  lastName: "Potrykus",
  gender: "female",
  birthDate: "1985-08-09",
  parentIds: [stanislaw56.id, malgorzataKol.id],
});

const jadwigaTarn = person({
  firstName: "Jadwiga",
  lastName: "Tarnowski",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1957-08-17",
  parentIds: [wladyslaw28.id, mariaHallSpouse.id],
});
const kazimierzTar = person({
  firstName: "Kazimierz",
  lastName: "Tarnowski",
  gender: "male",
  birthDate: "1954-12-11",
});
linkSpouses(jadwigaTarn.id, kazimierzTar.id);

const dorotaTar = person({
  firstName: "Dorota",
  lastName: "Sikora",
  maidenName: "Tarnowska",
  gender: "female",
  birthDate: "1978-03-07",
  parentIds: [jadwigaTarn.id, kazimierzTar.id],
});
const bogdanSik = person({
  firstName: "Bogdan",
  lastName: "Sikora",
  gender: "male",
  birthDate: "1969-04-18",
});
linkSpouses(dorotaTar.id, bogdanSik.id);
person({
  firstName: "Paulina",
  lastName: "Sikora",
  gender: "female",
  birthDate: "1998-04-28",
  parentIds: [dorotaTar.id, bogdanSik.id],
});
person({
  firstName: "Klaudia",
  lastName: "Sikora",
  gender: "female",
  birthDate: "1999-05-21",
  parentIds: [dorotaTar.id, bogdanSik.id],
});

const katarzynaTar = person({
  firstName: "Katarzyna",
  lastName: "Wikowski",
  maidenName: "Tarnowska",
  gender: "female",
  birthDate: "1979-11-29",
  parentIds: [jadwigaTarn.id, kazimierzTar.id],
});
const ryszardWik = person({
  firstName: "Ryszard",
  lastName: "Wikowski",
  gender: "male",
  birthDate: "1978-12-01",
});
linkSpouses(katarzynaTar.id, ryszardWik.id);
person({
  firstName: "Tomasz",
  lastName: "Wikowski",
  gender: "male",
  birthDate: "2003-04-12",
  parentIds: [katarzynaTar.id, ryszardWik.id],
});
person({
  firstName: "Agnieszka",
  lastName: "Wikowska",
  gender: "female",
  birthDate: "2007-05-09",
  parentIds: [katarzynaTar.id, ryszardWik.id],
});

const malgorzataTar = person({
  firstName: "Małgorzata",
  lastName: "Wikowski",
  maidenName: "Tarnowska",
  gender: "female",
  birthDate: "1984-06-01",
  parentIds: [jadwigaTarn.id, kazimierzTar.id],
});
const marekWik = person({
  firstName: "Marek",
  lastName: "Wikowski",
  gender: "male",
});
linkSpouses(malgorzataTar.id, marekWik.id);
person({
  firstName: "Aleksander",
  lastName: "Wikowski",
  gender: "male",
  birthDate: "2009-09-01",
  parentIds: [malgorzataTar.id, marekWik.id],
});
person({
  firstName: "Karol",
  lastName: "Tarnowski",
  gender: "male",
  birthDate: "1994-07",
  parentIds: [jadwigaTarn.id, kazimierzTar.id],
});

// Maria Potrykus + Brunon Lieske — Adam Lieske branch
const mariaLieske = person({
  firstName: "Maria",
  lastName: "Lieske",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1959-09-08",
  parentIds: [wladyslaw28.id, mariaHallSpouse.id],
  notes: "Maryśka Lieske — organizacja spotkań rodzinnych",
});
const brunonLieske = person({
  firstName: "Brunon Tadeusz",
  lastName: "Lieske",
  gender: "male",
  birthDate: "1956-08-26",
});
linkSpouses(mariaLieske.id, brunonLieske.id);

const andrzejLieske = person({
  firstName: "Andrzej",
  lastName: "Lieske",
  gender: "male",
  birthDate: "1981-06-07",
  parentIds: [mariaLieske.id, brunonLieske.id],
});
const annaMiotk = person({
  firstName: "Anna",
  lastName: "Lieske",
  maidenName: "Miotk",
  gender: "female",
  birthDate: "1983-04-17",
});
linkSpouses(andrzejLieske.id, annaMiotk.id);
person({
  firstName: "Sandra",
  lastName: "Lieske",
  gender: "female",
  birthDate: "2003-09-24",
  parentIds: [andrzejLieske.id, annaMiotk.id],
});
person({
  firstName: "Inga",
  lastName: "Lieske",
  gender: "female",
  birthDate: "2009-08-20",
  parentIds: [andrzejLieske.id, annaMiotk.id],
});

person({
  firstName: "Krystian",
  lastName: "Lieske",
  gender: "male",
  birthDate: "1983-06-13",
  deathDate: "1996-03-04",
  parentIds: [mariaLieske.id, brunonLieske.id],
});
person({
  firstName: "Barbara",
  lastName: "Lieske",
  gender: "female",
  birthDate: "1995-01-27",
  parentIds: [mariaLieske.id, brunonLieske.id],
});
person({
  firstName: "Adam",
  lastName: "Lieske",
  gender: "male",
  birthDate: "1997-12-11",
  parentIds: [mariaLieske.id, brunonLieske.id],
  notes: "Twórca aplikacji Drzewo Potrykus",
  id: "adam-lieske",
});

// ——— Walerian Potrykus ———
const walerian = person({
  firstName: "Walerian",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1929-09-12",
  parentIds: [liniaGlowna.id],
});
const bernadeta = person({
  firstName: "Bernadeta",
  lastName: "Potrykus",
  maidenName: "Groth",
  gender: "female",
  birthDate: "1936-12-03",
});
linkSpouses(walerian.id, bernadeta.id);

const teresaKost = person({
  firstName: "Teresa",
  lastName: "Kostrach",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1957-05-15",
  parentIds: [walerian.id, bernadeta.id],
});
const romanKost = person({
  firstName: "Roman",
  lastName: "Kostrach",
  gender: "male",
});
linkSpouses(teresaKost.id, romanKost.id);
person({
  firstName: "Marcin",
  lastName: "Kostrach",
  gender: "male",
  birthDate: "1984-12-11",
  parentIds: [teresaKost.id, romanKost.id],
});
const annaKost = person({
  firstName: "Anna",
  lastName: "Kułakowski",
  maidenName: "Kostrach",
  gender: "female",
  parentIds: [teresaKost.id, romanKost.id],
});
const kulakowski = person({
  firstName: "(małż.)",
  lastName: "Kułakowski",
  gender: "male",
});
linkSpouses(annaKost.id, kulakowski.id);
person({
  firstName: "Alicja",
  lastName: "Kostrach",
  gender: "female",
  parentIds: [teresaKost.id, romanKost.id],
});

const annaFrank = person({
  firstName: "Anna",
  lastName: "Frankowski",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1959-06-05",
  parentIds: [walerian.id, bernadeta.id],
});
const ireneuszFr = person({
  firstName: "Ireneusz",
  lastName: "Frankowski",
  gender: "male",
  birthDate: "1958-05-15",
});
linkSpouses(annaFrank.id, ireneuszFr.id);
const rafalFr = person({
  firstName: "Rafał",
  lastName: "Frankowski",
  gender: "male",
  birthDate: "1978-05-02",
  parentIds: [annaFrank.id, ireneuszFr.id],
});
const karinaKar = person({
  firstName: "Karina",
  lastName: "Frankowski",
  maidenName: "Karnowska",
  gender: "female",
  birthDate: "1978-09-23",
});
linkSpouses(rafalFr.id, karinaKar.id);
person({
  firstName: "Maksymilian",
  lastName: "Frankowski",
  gender: "male",
  birthDate: "2003-01-12",
  parentIds: [rafalFr.id, karinaKar.id],
});
person({
  firstName: "Mateusz",
  lastName: "Frankowski",
  gender: "male",
  birthDate: "2006-08-04",
  parentIds: [rafalFr.id, karinaKar.id],
});

// ——— Page 2 branch: Józef Potrykus 1953 etc (children of unnamed gen3) ———
const branchPage2 = person({
  id: "galaz-page2-potrykus",
  firstName: "Gałąź (str. 2)",
  lastName: "Potrykus",
  gender: "unknown",
  notes: "Przodek do uzupełnienia — dzieci z dokumentu str. 2",
  parentIds: [liniaGlowna.id],
});

const jozef53 = person({
  firstName: "Józef",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1953-01-22",
  parentIds: [branchPage2.id],
});
const grazynaMon = person({
  firstName: "Grażyna",
  lastName: "Potrykus",
  maidenName: "Moniuszko",
  gender: "female",
  birthDate: "1953-11-30",
});
linkSpouses(jozef53.id, grazynaMon.id);
const przemek = person({
  firstName: "Przemek",
  lastName: "Potrykus",
  gender: "male",
  parentIds: [jozef53.id, grazynaMon.id],
});
const joannaP = person({
  firstName: "Joanna",
  lastName: "Potrykus",
  gender: "female",
});
linkSpouses(przemek.id, joannaP.id);
person({
  firstName: "Franciszek",
  lastName: "Potrykus",
  gender: "male",
  id: "franciszek-potrykus-przemek",
  parentIds: [przemek.id, joannaP.id],
});
person({
  firstName: "Julia",
  lastName: "Potrykus",
  gender: "female",
  parentIds: [przemek.id, joannaP.id],
});
const marcin82 = person({
  firstName: "Marcin",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1982-03-18",
  parentIds: [jozef53.id, grazynaMon.id],
});
const agnieszkaLoz = person({
  firstName: "Agnieszka",
  lastName: "Potrykus",
  maidenName: "Łozińska",
  gender: "female",
});
linkSpouses(marcin82.id, agnieszkaLoz.id);
person({
  firstName: "Stanisław",
  lastName: "Potrykus",
  gender: "male",
  id: "stanislaw-potrykus-marcin",
  parentIds: [marcin82.id, agnieszkaLoz.id],
});

person({
  firstName: "Franciszek",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1956-06-16",
  id: "franciszek-potrykus-1956-06",
  parentIds: [branchPage2.id],
});

const annaLesniak = person({
  firstName: "Anna",
  lastName: "Leśniak",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1959-04-23",
  parentIds: [branchPage2.id],
  notes: "Ania Leśniak — organizacja spotkań rodzinnych",
});
const jozefLesniak = person({
  firstName: "Józef",
  lastName: "Leśniak",
  gender: "male",
  birthDate: "1953-12-23",
});
linkSpouses(annaLesniak.id, jozefLesniak.id);

const agnieszkaLes = person({
  firstName: "Agnieszka",
  lastName: "Trella",
  maidenName: "Leśniak",
  gender: "female",
  birthDate: "1980-07-02",
  parentIds: [annaLesniak.id, jozefLesniak.id],
});
const piotrTrella = person({
  firstName: "Piotr",
  lastName: "Trella",
  gender: "male",
  birthDate: "1979-05-18",
});
linkSpouses(agnieszkaLes.id, piotrTrella.id);
person({
  firstName: "Jakub",
  lastName: "Trella",
  gender: "male",
  birthDate: "2004-01-15",
  parentIds: [agnieszkaLes.id, piotrTrella.id],
});
person({
  firstName: "Maja",
  lastName: "Trella",
  gender: "female",
  parentIds: [agnieszkaLes.id, piotrTrella.id],
});

const malgorzataLes = person({
  firstName: "Małgorzata",
  lastName: "Kotarba",
  maidenName: "Leśniak",
  gender: "female",
  birthDate: "1981-08-13",
  parentIds: [annaLesniak.id, jozefLesniak.id],
});
const grzegorzKot = person({
  firstName: "Grzegorz",
  lastName: "Kotarba",
  gender: "male",
  birthDate: "1977-01-31",
});
linkSpouses(malgorzataLes.id, grzegorzKot.id);
person({
  firstName: "Aleksandra",
  lastName: "Kotarba",
  gender: "female",
  birthDate: "2007-10-28",
  parentIds: [malgorzataLes.id, grzegorzKot.id],
});
person({
  firstName: "Dariusz",
  lastName: "Leśniak",
  gender: "male",
  birthDate: "1986-05-11",
  parentIds: [annaLesniak.id, jozefLesniak.id],
});

const mariaSzcz = person({
  firstName: "Maria",
  lastName: "Szczuko",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1962-01-30",
  parentIds: [branchPage2.id],
});
const waldemarSzcz = person({
  firstName: "Waldemar",
  lastName: "Szczuko",
  gender: "male",
  birthDate: "1951-10-12",
});
linkSpouses(mariaSzcz.id, waldemarSzcz.id);
const magdaSzcz = person({
  firstName: "Magdalena",
  lastName: "Bieniek",
  maidenName: "Szczuko",
  gender: "female",
  birthDate: "1982-09-29",
  parentIds: [mariaSzcz.id, waldemarSzcz.id],
});
const arkadiuszBien = person({
  firstName: "Arkadiusz",
  lastName: "Bieniek",
  gender: "male",
  birthDate: "1982-09-04",
});
linkSpouses(magdaSzcz.id, arkadiuszBien.id);
person({
  firstName: "Gabriela",
  lastName: "Bieniek",
  gender: "female",
  birthDate: "2008-07-08",
  parentIds: [magdaSzcz.id, arkadiuszBien.id],
});
person({
  firstName: "Anna",
  lastName: "Szczuko",
  gender: "female",
  birthDate: "1984-12-09",
  parentIds: [mariaSzcz.id, waldemarSzcz.id],
});
person({
  firstName: "Beata",
  lastName: "Szczuko",
  gender: "female",
  birthDate: "1989-06-27",
  parentIds: [mariaSzcz.id, waldemarSzcz.id],
});
person({
  firstName: "Adam",
  lastName: "Szczuko",
  gender: "male",
  birthDate: "1997-05-15",
  parentIds: [mariaSzcz.id, waldemarSzcz.id],
});
person({
  firstName: "Joanna",
  lastName: "Szczuko",
  gender: "female",
  birthDate: "1999-08-09",
  parentIds: [mariaSzcz.id, waldemarSzcz.id],
});

const wincenty64 = person({
  firstName: "Wincenty",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1964-05-14",
  parentIds: [branchPage2.id],
});
const marzenaWicz = person({
  firstName: "Marzena",
  lastName: "Potrykus",
  maidenName: "Wiczling",
  gender: "female",
});
linkSpouses(wincenty64.id, marzenaWicz.id);
for (const [fn, g, bd] of [
  ["Szymon", "male", undefined],
  ["Monika", "female", undefined],
  ["Justyna", "female", undefined],
  ["Magdalena", "female", "1999-11-11"],
]) {
  person({
    firstName: fn,
    lastName: "Potrykus",
    gender: g,
    birthDate: bd,
    id: idOf(fn, "potrykus", "wincenty", bd || "x"),
    parentIds: [wincenty64.id, marzenaWicz.id],
  });
}

// ——— Page 9 branches (Xawery / Alfons / Jadwiga / Anna) ———
const xaweryBranch = person({
  id: "xawery-potrykus-branch",
  firstName: "Xawery",
  lastName: "Potrykus",
  gender: "male",
  notes: "Gałąź ze str. 9 — pełne dane do uzupełnienia",
  parentIds: [liniaGlowna.id],
});
const odona = person({
  firstName: "Odona",
  lastName: "Potrykus",
  maidenName: "Szymańska",
  gender: "female",
  birthDate: "1949-07-25",
});
linkSpouses(xaweryBranch.id, odona.id);

const ryszard71 = person({
  firstName: "Ryszard",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1971-06-18",
  parentIds: [xaweryBranch.id, odona.id],
});
const monika74 = person({
  firstName: "Monika",
  lastName: "Potrykus",
  gender: "female",
  birthDate: "1974-11-10",
  id: "monika-potrykus-1974",
});
linkSpouses(ryszard71.id, monika74.id);
person({
  firstName: "Agnieszka",
  lastName: "Potrykus",
  gender: "female",
  birthDate: "2002-09-28",
  id: "agnieszka-potrykus-2002",
  parentIds: [ryszard71.id, monika74.id],
});

const leszek = person({
  firstName: "Leszek",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1972-06-05",
  parentIds: [xaweryBranch.id, odona.id],
});
const barbaraBiel = person({
  firstName: "Barbara",
  lastName: "Potrykus",
  maidenName: "Bielawa",
  gender: "female",
  birthDate: "1974-06-23",
});
linkSpouses(leszek.id, barbaraBiel.id);
for (const [fn, bd, g] of [
  ["Łukasz", "1995-11-06", "male"],
  ["Katarzyna", "1997-05-12", "female"],
  ["Mariusz", "1999-01-22", "male"],
  ["Paulina", "2002-09-29", "female"],
]) {
  person({
    firstName: fn,
    lastName: "Potrykus",
    gender: g,
    birthDate: bd,
    id: idOf(fn, "potrykus", "leszek", bd),
    parentIds: [leszek.id, barbaraBiel.id],
  });
}

const aleksandraKolm = person({
  firstName: "Aleksandra",
  lastName: "Kolmetz",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1973-05-11",
  parentIds: [xaweryBranch.id, odona.id],
});
const tadeuszKolm = person({
  firstName: "Tadeusz",
  lastName: "Kolmetz",
  gender: "male",
  birthDate: "1963-12-03",
});
linkSpouses(aleksandraKolm.id, tadeuszKolm.id);
for (const [fn, bd, g] of [
  ["Anna", "1995-04-09", "female"],
  ["Krzysztof", "1996-10-27", "male"],
  ["Adam", "1999-11-04", "male"],
]) {
  person({
    firstName: fn,
    lastName: "Kolmetz",
    gender: g,
    birthDate: bd,
    parentIds: [aleksandraKolm.id, tadeuszKolm.id],
  });
}

const karol77 = person({
  firstName: "Karol",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1977-11-01",
  parentIds: [xaweryBranch.id, odona.id],
});
const violetta = person({
  firstName: "Violetta",
  lastName: "Potrykus",
  maidenName: "Lademann",
  gender: "female",
  birthDate: "1979-03-10",
});
linkSpouses(karol77.id, violetta.id);
person({
  firstName: "Piotr",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "2001-09-22",
  id: "piotr-potrykus-2001",
  parentIds: [karol77.id, violetta.id],
});
person({
  firstName: "Nikola",
  lastName: "Potrykus",
  gender: "female",
  birthDate: "2004-10-26",
  parentIds: [karol77.id, violetta.id],
});

const jan80 = person({
  firstName: "Jan",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1980-05-09",
  parentIds: [xaweryBranch.id, odona.id],
});
const justynaDrawc = person({
  firstName: "Justyna",
  lastName: "Potrykus",
  maidenName: "Drawc",
  gender: "female",
  birthDate: "1974-01-22",
});
linkSpouses(jan80.id, justynaDrawc.id);
person({
  firstName: "Tomasz",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "2008-01-20",
  id: "tomasz-potrykus-2008",
  parentIds: [jan80.id, justynaDrawc.id],
});
person({
  firstName: "Oliwia",
  lastName: "Potrykus",
  gender: "female",
  birthDate: "2011-09-03",
  parentIds: [jan80.id, justynaDrawc.id],
});

const alfons = person({
  firstName: "Alfons",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1949-07-06",
  deathDate: "2004-09-06",
  parentIds: [liniaGlowna.id],
});
const wladyslawaLad = person({
  firstName: "Władysława",
  lastName: "Potrykus",
  maidenName: "Lademann",
  gender: "female",
  birthDate: "1953-03-06",
});
linkSpouses(alfons.id, wladyslawaLad.id);
person({
  firstName: "Andrzej",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1972-05-07",
  deathDate: "1992-05-09",
  id: "andrzej-potrykus-1972",
  parentIds: [alfons.id, wladyslawaLad.id],
});
const marzenaRysz = person({
  firstName: "Marzena",
  lastName: "Ryszka",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1974-01-14",
  parentIds: [alfons.id, wladyslawaLad.id],
});
const aleksanderRysz = person({
  firstName: "Aleksander",
  lastName: "Ryszka",
  gender: "male",
  birthDate: "1966-01-20",
});
linkSpouses(marzenaRysz.id, aleksanderRysz.id);
person({
  firstName: "Andreas",
  lastName: "Ryszka",
  gender: "male",
  birthDate: "1995-10-11",
  parentIds: [marzenaRysz.id, aleksanderRysz.id],
});

const pawel80 = person({
  firstName: "Paweł",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1980-03-05",
  parentIds: [alfons.id, wladyslawaLad.id],
});
const adriannaKul = person({
  firstName: "Adrianna",
  lastName: "Potrykus",
  maidenName: "Kuliś",
  gender: "female",
  birthDate: "1975-08-22",
});
linkSpouses(pawel80.id, adriannaKul.id);
person({
  firstName: "Maciej",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "2002-03-17",
  id: "maciej-potrykus-2002",
  parentIds: [pawel80.id, adriannaKul.id],
});
person({
  firstName: "Filip",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "2008-02-16",
  parentIds: [pawel80.id, adriannaKul.id],
});

const slawomir81 = person({
  firstName: "Sławomir",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "1981-12-12",
  id: "slawomir-potrykus-1981",
  parentIds: [alfons.id, wladyslawaLad.id],
});
const martaMroz = person({
  firstName: "Marta",
  lastName: "Potrykus",
  maidenName: "Mrożek",
  gender: "female",
  birthDate: "1983-12-07",
});
linkSpouses(slawomir81.id, martaMroz.id);
person({
  firstName: "Kacper",
  lastName: "Potrykus",
  gender: "male",
  birthDate: "2004-02-08",
  id: "kacper-potrykus-2004",
  parentIds: [slawomir81.id, martaMroz.id],
});
person({
  firstName: "Zuzanna",
  lastName: "Potrykus",
  gender: "female",
  birthDate: "2010-12-14",
  parentIds: [slawomir81.id, martaMroz.id],
});

const jadwigaLew = person({
  firstName: "Jadwiga",
  lastName: "Lewandowski",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1952-12-05",
  parentIds: [liniaGlowna.id],
});
const jerzyLew = person({
  firstName: "Jerzy",
  lastName: "Lewandowski",
  gender: "male",
  birthDate: "1953-04-01",
});
linkSpouses(jadwigaLew.id, jerzyLew.id);
person({
  firstName: "Hanna",
  lastName: "Lewandowska",
  gender: "female",
  birthDate: "1979-04-10",
  parentIds: [jadwigaLew.id, jerzyLew.id],
});
const agnieszkaCiem = person({
  firstName: "Agnieszka",
  lastName: "Ciemny",
  maidenName: "Lewandowska",
  gender: "female",
  birthDate: "1981-06-28",
  parentIds: [jadwigaLew.id, jerzyLew.id],
});
const marekCiem = person({
  firstName: "Marek",
  lastName: "Ciemny",
  gender: "male",
  birthDate: "1980-09-17",
});
linkSpouses(agnieszkaCiem.id, marekCiem.id);
person({
  firstName: "Miłosz",
  lastName: "Ciemny",
  gender: "male",
  birthDate: "2004-04-02",
  parentIds: [agnieszkaCiem.id, marekCiem.id],
});
person({
  firstName: "Paulina",
  lastName: "Ciemny",
  gender: "female",
  birthDate: "2011-05-05",
  parentIds: [agnieszkaCiem.id, marekCiem.id],
});
const marekLew = person({
  firstName: "Marek",
  lastName: "Lewandowski",
  gender: "male",
  birthDate: "1984-05-17",
  parentIds: [jadwigaLew.id, jerzyLew.id],
});
const katarzynaLew = person({
  firstName: "Katarzyna",
  lastName: "Lewandowska",
  gender: "female",
  birthDate: "1982-05-15",
});
linkSpouses(marekLew.id, katarzynaLew.id);
person({
  firstName: "Martyna",
  lastName: "Lewandowska",
  gender: "female",
  birthDate: "2011-05-12",
  parentIds: [marekLew.id, katarzynaLew.id],
});

const annaSem = person({
  firstName: "Anna",
  lastName: "Semmerling",
  maidenName: "Potrykus",
  gender: "female",
  birthDate: "1956-09-14",
  parentIds: [liniaGlowna.id],
});
const wojciechSem = person({
  firstName: "Wojciech",
  lastName: "Semmerling",
  gender: "male",
  birthDate: "1957-03-05",
});
linkSpouses(annaSem.id, wojciechSem.id);
const witoldSem = person({
  firstName: "Witold",
  lastName: "Semmerling",
  gender: "male",
  birthDate: "1983-10-24",
  parentIds: [annaSem.id, wojciechSem.id],
});
const martaBrz = person({
  firstName: "Marta",
  lastName: "Semmerling",
  maidenName: "Brzozowska",
  gender: "female",
  birthDate: "1988-04-07",
});
linkSpouses(witoldSem.id, martaBrz.id);
const piotrSem = person({
  firstName: "Piotr",
  lastName: "Semmerling",
  gender: "male",
  birthDate: "1986-10-08",
  parentIds: [annaSem.id, wojciechSem.id],
});
const joannaMrz = person({
  firstName: "Joanna",
  lastName: "Semmerling",
  maidenName: "Mrzygłocka",
  gender: "female",
  birthDate: "1982-07-30",
});
linkSpouses(piotrSem.id, joannaMrz.id);
person({
  firstName: "Wiktor",
  lastName: "Semmerling",
  gender: "male",
  birthDate: "2009-11-17",
  parentIds: [piotrSem.id, joannaMrz.id],
});
person({
  firstName: "Aleksandra",
  lastName: "Semmerling",
  gender: "female",
  birthDate: "2011-10-12",
  parentIds: [piotrSem.id, joannaMrz.id],
});
person({
  firstName: "Radosław",
  lastName: "Semmerling",
  gender: "male",
  birthDate: "2011-02-08",
  parentIds: [piotrSem.id, joannaMrz.id],
});
const magdaSem = person({
  firstName: "Magdalena",
  lastName: "Szczechura",
  maidenName: "Semmerling",
  gender: "female",
  birthDate: "1988-02-28",
  parentIds: [annaSem.id, wojciechSem.id],
});
const piotrSzcz = person({
  firstName: "Piotr",
  lastName: "Szczechura",
  gender: "male",
  birthDate: "1981-07-30",
});
linkSpouses(magdaSem.id, piotrSzcz.id);
person({
  firstName: "Anita",
  lastName: "Szczechura",
  gender: "female",
  birthDate: "2010-04-02",
  parentIds: [magdaSem.id, piotrSzcz.id],
});

// Normalize partial dates to valid-ish ISO (YYYY or YYYY-MM)
for (const p of people) {
  if (p.birthDate && /^\d{4}$/.test(p.birthDate)) {
    // keep year-only
  }
  if (!p.photoUrl) delete p.photoUrl;
  if (!p.phone) delete p.phone;
  if (!p.notes) delete p.notes;
  if (!p.maidenName) delete p.maidenName;
  if (!p.deathDate) delete p.deathDate;
  if (!p.birthDate) delete p.birthDate;
}

const family = {
  meta: {
    title: "Drzewo rodziny Potrykus",
    rootPersonId: fx.id,
    creator: "Adam Lieske",
    updatedAt: new Date().toISOString(),
    description:
      "Potomkowie Franciszka Xawerego Potrykusa — dane z dokumentów rodzinnych. Numery telefonów i zdjęcia uzupełniaj lokalnie.",
  },
  people,
};

mkdirSync(join(root, "data"), { recursive: true });
writeFileSync(join(root, "data", "family.json"), JSON.stringify(family, null, 2));

const accessCode = "PotrykusRodzina";
const config = {
  accessCodeHash: bcrypt.hashSync(accessCode, 10),
  sessionSecret: randomBytes(32).toString("hex"),
  cookieName: "potrykus_family_session",
};
writeFileSync(join(root, "data", "config.json"), JSON.stringify(config, null, 2));

console.log(`Seeded ${people.length} people`);
console.log(`Default family access code: ${accessCode}`);
console.log(`Root: ${fx.id}`);
