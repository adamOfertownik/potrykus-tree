# Drzewo Potrykus

Prywatne drzewo genealogiczne rodziny **Potrykus**.  
Twórca: **Adam Lieske**

> **Repozytorium:** to repo zastąpiło przypadkowy projekt CarForce.  
> Zmień nazwę w GitHub → **Settings → General → Repository name** → `potrykus-family-tree`,  
> potem: `git remote set-url origin https://github.com/adamOfertownik/potrykus-family-tree.git`

## Stack

- Next.js 16 (App Router)
- TanStack Query
- Lokalna baza w pliku `data/family.json`
- Dostęp kodem rodzinnym (bez konta użytkownika)

## Uruchomienie

```bash
npm install
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000)

### Kod rodzinny (domyślny)

```
PotrykusRodzina
```

Zmiana kodu: wygeneruj hash (`bcrypt`) i wpisz w `data/config.json` → `accessCodeHash`.

## Funkcje

- Widok drzewa na bibliotece [family-chart](https://github.com/donatso/family-chart) (zoom, pan, fokus)
- Wyszukiwanie osób (drzewo + lista)
- Lista hierarchiczna z graficznymi powiązaniami
- Karty osób: imię, nazwisko, nazwisko rodowe, daty, zdjęcie
- Eksport PDF: lista A4 + duży format A0 (czcionki DejaVu, polskie znaki)
- Numery telefonów tylko po odblokowaniu kodem

## Dane

Seed (stary, twardo zakodowany): `npm run seed`  
Snapshot Markdown: `data/snapshots/drzewo-potrykus.md` (kopia: `drzewo_potrykus_ID.md`)  
Import z terminala:

```bash
node scripts/import-md.mjs data/snapshots/drzewo_potrykus_ID.md --out data/family.json --merge
```

Albo `npm run import-md` (domyślnie ten sam snapshot + merge).  
Wgranie z UI: panel **Konsola** → wybierz plik `.md` → Podgląd → Wgraj.  
Edycja ręczna: `data/family.json`

## Docelowo (sklep)

Architektura gotowa pod Capacitorem / PWA — ten sam Next.js + lokalny plik / sync później.
