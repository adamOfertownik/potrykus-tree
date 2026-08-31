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
- Logowanie: konto Supabase albo kod rodzinny
- Role: **podgląd** (zwykły użytkownik) i **admin** (dodawanie osób / edycja drzewa)

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

### Logowanie Supabase + role

1. Ustaw `NEXT_PUBLIC_SUPABASE_URL` i `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
2. Zwykły użytkownik: konto e-mail/hasło albo kod rodzinny — **tylko podgląd**.
3. Admin (edycja drzewa, panel zgłoszeń) — jedno z:
   - `ADMIN_EMAILS=twoj@email.pl` (Vercel / env)
   - w Supabase: User → **App metadata** `{ "role": "admin" }`
   - kod `ADMIN_CODE` wpisany w polu kodu rodzinnego (sesja JWT z rolą admin)

## Funkcje

- Widok drzewa na bibliotece [family-chart](https://github.com/donatso/family-chart) (zoom, pan, fokus)
- Wyszukiwanie osób (drzewo + lista)
- Lista hierarchiczna z graficznymi powiązaniami
- Karty osób: imię, nazwisko, nazwisko rodowe, daty, zdjęcie
- Eksport PDF: lista A4 + duży format A0 (czcionki DejaVu, polskie znaki)
- Numery telefonów tylko po odblokowaniu kodem

## Dane

Seed: `npm run seed` (skrypt `scripts/generate-seed.mjs`)  
Edycja ręczna: `data/family.json`

## Docelowo (sklep)

Architektura gotowa pod Capacitorem / PWA — ten sam Next.js + lokalny plik / sync później.
