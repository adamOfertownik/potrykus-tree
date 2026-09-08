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

Źródło prawdy drzewa: plik tekstowy `data/drzewo-potrykus.md` (osoby `P001`…, pola `rodzic:` / `małżonek:`).

Aplikacja **nie trzyma osób w Neonie**. Neon to zgłoszenia, RSVP i konta adminów. Lista osób jest w `data/family.json` i wjeżdża na produkcję razem z deployem.

### Wgranie nowej bazy z pliku

1. Podmień `data/drzewo-potrykus.md` na nową wersję w tym samym formacie (jedna osoba = jedna linia, ID, `m`/`k`/`?`).
2. W katalogu projektu: `npm run seed` — skrypt `scripts/import-tree.mjs` nadpisze **tylko** `data/family.json`.
3. Sprawdź w aplikacji (drzewo / lista / szukaj).
4. Commit `data/drzewo-potrykus.md` + `data/family.json` i deploy.

`npm run seed` **nie** zmienia `data/config.json` (kod rodzinny zostaje).

Korzeń widoku listy: **P015** Wincenty Potrykus (tytuł raportu PDF). Osoba z linii 3-3: **P060** Franciszek Potrykus. Adam Lieske: **P297**.

## Docelowo (sklep)

Architektura gotowa pod Capacitorem / PWA — ten sam Next.js + lokalny plik / sync później.
