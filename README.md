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

- Widok drzewa z powiązaniami (inspiracja MyHeritage)
- Karty osób: imię, nazwisko, nazwisko rodowe, daty, zdjęcie
- Widok listy hierarchicznej (jak w dokumentach rodzinnych)
- Eksport PDF: lista powiązań + duży format A0
- Numery telefonów tylko po odblokowaniu kodem

## Dane

Seed: `npm run seed` (skrypt `scripts/generate-seed.mjs`)  
Edycja ręczna: `data/family.json`

## Docelowo (sklep)

Architektura gotowa pod Capacitorem / PWA — ten sam Next.js + lokalny plik / sync później.
