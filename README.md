# Drzewo Potrykus

Prywatne drzewo genealogiczne rodziny **Potrykus**.  
Twórca: **Adam Lieske**

> **Repozytorium:** to repo zastąpiło przypadkowy projekt CarForce.  
> Zmień nazwę w GitHub → **Settings → General → Repository name** → `potrykus-family-tree`,  
> potem: `git remote set-url origin https://github.com/adamOfertownik/potrykus-family-tree.git`

## Stack

- Next.js 16 (App Router)
- TanStack Query
- Drzewo w `data/family.json`
- Konta i role w **Neon Postgres** (`app_users`)
- Zapisy zgłoszeń i RSVP też w Neon (z fallbackiem do `data/*.json` lokalnie)

## Uruchomienie

```bash
npm install
# SESSION_SECRET (min. 16 znaków) w środowisku. Neon na Vercel często
# wstawia `potrykus_DATABASE_URL` zamiast `DATABASE_URL` — aplikacja czyta oba.
npm run db:migrate
npm run db:create-admin -- twoj@email.pl haslo-min-8-znakow
npm run dev
```

Otwórz [http://localhost:3000](http://localhost:3000) i zaloguj się e-mailem oraz hasłem.

## Role

| Rola | Co może |
|------|---------|
| **Rodzina** (`member`) | Drzewo, lista, urodziny, spotkanie, zgłoszenia poprawek |
| **Admin** (`admin`) | To samo + edycja grafu, zatwierdzanie zgłoszeń, zakładanie kont |

Konta dodajesz w panelu `/admin` albo skryptem:

```bash
npm run db:create-user -- osoba@email.pl haslo-min-8-znakow member
```

Hasła i sekrety sesji **nie leżą w git**. `SESSION_SECRET` ustaw w Vercel / środowisku i nie commituj.

## Funkcje

- Widok drzewa na bibliotece [family-chart](https://github.com/donatso/family-chart) (zoom, pan, fokus)
- Wyszukiwanie osób (drzewo + lista)
- Lista hierarchiczna z graficznymi powiązaniami
- Karty osób: imię, nazwisko, nazwisko rodowe, daty, zdjęcie
- Eksport PDF: lista A4 + duży format A0 (czcionki DejaVu, polskie znaki)
- Numery telefonów tylko po zalogowaniu

## Dane

Seed drzewa: `npm run seed` (skrypt `scripts/generate-seed.mjs`)  
Edycja ręczna: `data/family.json`  
Sprawdzenie Neona: `npm run db:check`

## Docelowo (sklep)

Architektura gotowa pod Capacitorem / PWA — ten sam Next.js + lokalny plik / sync później.
