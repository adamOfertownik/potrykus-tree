# Drzewo Potrykus

Prywatne drzewo genealogiczne rodziny **Potrykus**.  
Twórca: **Adam Lieske**

> **Repozytorium:** to repo zastąpiło przypadkowy projekt CarForce.  
> Zmień nazwę w GitHub → **Settings → General → Repository name** → `potrykus-family-tree`,  
> potem: `git remote set-url origin https://github.com/adamOfertownik/potrykus-family-tree.git`

## Stack

- Next.js 16 (App Router)
- TanStack Query
- Drzewo w Neon (`family_tree`); lokalny plik `data/family.json` to ziarno / fallback
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

**Baza startowa to 418 osób z `data/drzewo-potrykus.md`.** Nie wgrywasz tego ręcznie w przeglądarce przy pierwszym starcie.

- Plik `data/family.json` jest ziarnem w repozytorium (deploy).
- Gdy jest `DATABASE_URL`, aplikacja trzyma **aktualne drzewo w Neonie** (tabela `family_tree`). Edycje grafu zapisują się tam, nie giną na Vercel.
- Pusta tabela przy pierwszym odczycie kopiuje ziarno (418 osób) do Neona. Kolejne deploje **nie** nadpisują już zapisanych zmian.
- Neon trzyma też zgłoszenia, RSVP i adminów.

### Co zrobić, żeby pracować na dobrej bazie

1. Merge / deploy tej wersji aplikacji (`DATABASE_URL` musi być w projekcie Vercel).
2. Przy każdym deployu Vercel sam odpalą migracje (to jest część `npm run build`) — **nie ma SSH i nie wpisujesz `npm run db:migrate` w panelu Vercel**.
3. Otwórz drzewo. Jeśli Neon był pusty, 418 osób wjeżdża samo.

Jednorazowo z laptopa (ten sam Neon co produkcja), bez kopiowania sekretów do pliku:

```bash
npx vercel env run -e production -- npm run db:migrate
```

Wymaga zalogowanego Vercel CLI w tym projekcie. `-e production` wstrzykuje zmienne z produkcji (w tym połączenie z Neonem) do skryptu, bez zapisywania ich na dysk.

Żeby **świadomie** nadpisać Neon ziarnem z repo (np. nowy import PDF): panel admina → „Wgraj 418 osób z pliku” albo lokalnie `npm run db:seed-family`.

### Nowy plik źródłowy (kolejna transkrypcja)

1. Podmień `data/drzewo-potrykus.md`.
2. `npm run seed` — odświeża `family.json`; przy ustawionym `DATABASE_URL` od razu upsert do Neona.
3. Commit i deploy. Jeśli Neon już miał drzewo, po deployu użyj przycisku admina albo `db:seed-family`.

`npm run seed` **nie** zmienia `data/config.json`.

Korzeń listy: **P015** Wincenty Potrykus. Linia 3-3: **P060**. Adam Lieske: **P297**.

## Docelowo (sklep)

Architektura gotowa pod Capacitorem / PWA — ten sam Next.js + lokalny plik / sync później.
