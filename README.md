# Drzewo Potrykus

Prywatne drzewo genealogiczne rodziny **Potrykus**.  
Twórca: **Adam Lieske**

> **Repozytorium:** to repo zastąpiło przypadkowy projekt CarForce.  
> Zmień nazwę w GitHub → **Settings → General → Repository name** → `potrykus-family-tree`,  
> potem: `git remote set-url origin https://github.com/adamOfertownik/potrykus-family-tree.git`

## Stack

- Next.js 16 (App Router)
- TanStack Query
- Drzewo w **Neon** (`family_graph`); źródło importu to Markdown, nie git
- Konta i role w **Neon Postgres** (`app_users`)
- Zapisy zgłoszeń i RSVP też w Neon (z fallbackiem do `data/*.json` lokalnie)

## Uruchomienie

```bash
npm install
# SESSION_SECRET (min. 16 znaków) w środowisku. Neon na Vercel często
# wstawia `potrykus_DATABASE_URL` zamiast `DATABASE_URL` — aplikacja czyta oba.
npm run dev
# Pierwsze konto: otwórz /login — gdy baza pusta, sam utworzysz admina.
```

Otwórz [http://localhost:3000](http://localhost:3000) i zaloguj się e-mailem oraz hasłem.

## Role

| Rola | Konto? | Co może |
|------|--------|---------|
| **Gość** (`guest`) | Nie — hasło / link `/wejscie` | Drzewo, lista, urodziny, zjazd |
| **Rodzina** (`member`) | Tak — link `/register?k=` | To samo + zgłoszenia z konta |
| **Admin** (`admin`) | Tak — pierwsze konto na `/login` albo link `/register?k=&rola=admin` | Edycja grafu, zaproszenia, zatwierdzanie |

Na MVP **wystarczy, że konta mają admini**. Reszta rodziny wchodzi hasłem do drzewa. Clerk (darmowy) nie jest potrzebny — dodałby osobny serwis, a sesja i Neon już są.

W `/admin` są **trzy** wejścia (w bazie tylko hash; skopiuj link od razu albo ustaw własne hasło):

1. hasło / link do drzewa bez konta (`/wejscie?k=…`)
2. zaproszenie kolejnego admina
3. zaproszenie na konto standardowe (jak dotychczas)

```bash
npm run db:create-user -- osoba@email.pl haslo-min-8-znakow member
npm run db:set-invite -- member "klucz-min-8-znakow"
```

Hasła i sekrety sesji **nie leżą w git**. `SESSION_SECRET` ustaw w Vercel / środowisku i nie commituj.

## Porządek na Vercel (checklist)

`POSTGRES_URL` / `PGHOST` / `POSTGRES_PRISMA_URL` to **nie Supabase**. Integracja Neon na Marketplace wstawia stary zestaw nazw z czasów Vercel Postgres — to ta sama baza co `potrykus_DATABASE_URL`. Nie kasuj całego pakietu Neon.

| Zostaw (Neon, nie ruszaj) | Szum (można zignorować) | Musisz **dodać** |
|---|---|---|
| `potrykus_DATABASE_URL` | `potrykus_POSTGRES_*`, `potrykus_PG*` | `SESSION_SECRET` |
| `potrykus_DATABASE_URL_UNPOOLED` | `potrykus_POSTGRES_PRISMA_URL` | |
| `potrykus_NEON_PROJECT_ID` | `potrykus_VITE_NEON_AUTH_URL`, `potrykus_NEON_AUTH_BASE_URL` | `BLOB_READ_WRITE_TOKEN` tylko jeśli chcesz upload zdjęć |

`SESSION_SECRET` **nie przychodzi z Neona**. Generujesz go sam (nie wklejaj go na czat / do gita):

```bash
openssl rand -hex 32
```

Vercel → Project → Settings → Environment Variables → dodaj `SESSION_SECRET` (Sensitive) dla Production, Preview i Development → Redeploy.

Potem:

1. Zmerguj ten PR (albo wejdź na **Preview** z GitHuba).
2. Otwórz `/login`. Gdy baza jest pusta, zobaczysz **„Pierwsze konto admina”** — wpisz swój e-mail i hasło (min. 8 znaków). Aplikacja sama założy tabele w Neon. **Nie ma kodu administratora / kodu rodzinnego.**
3. W `/admin` ustaw **hasło do drzewa** (dla rodziny bez kont) oraz **dwa linki kont**: admin i standard.
4. Zdjęcia (opcjonalnie): Vercel Storage → Blob.

## Funkcje

- Widok drzewa na bibliotece [family-chart](https://github.com/donatso/family-chart) (zoom, pan, fokus)
- Wyszukiwanie osób (drzewo + lista)
- Lista hierarchiczna z graficznymi powiązaniami
- Karty osób: imię, nazwisko, nazwisko rodowe, daty, zdjęcie
- Eksport PDF: lista A4 + duży format A0 (czcionki DejaVu, polskie znaki)
- Numery telefonów tylko po zalogowaniu

## Dane

Seed drzewa: w `/admin` „Zapisz drzewo z Markdownu do Neona” albo wgraj plik `.md`. Dopóki nie ma wiersza w `family_graph`, aplikacja czyta załączony raport.  
`data/family.json` jest pusty — nie trzymaj tam żywych danych.  
Sprawdzenie Neona: `npm run db:check`

## Docelowo (sklep)

Architektura gotowa pod Capacitorem / PWA — ten sam Next.js + lokalny plik / sync później.
