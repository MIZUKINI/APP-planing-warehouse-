# APP Planning Warehouse

MVP aplikacji magazynowej do monitorowania tygodniowych planów działania i kompletacji materiałów/części pod cartrouting/BOM zbiornika.

## Zatwierdzony zakres MVP

- Jedno zlecenie = `index zbiornika + tydzień + rok + ilość przypisana w danym tygodniu`.
- Źródłem planu jest Excel `.xls`, `.xlsx` lub `.xlsm`.
- Wymagane jest mapowanie Excela: arkusz, wiersz dat, kolumna indeksu zbiornika i pierwszy wiersz danych.
- Jeden tydzień w Excelu to 5 kolumn roboczych z datami w formacie dzień-miesiąc oraz jedna pusta kolumna separatora.
- Puste komórki oznaczają brak wysyłki, więc taki zbiornik nie trafia na listę zleceń.
- Aplikacja czyta wyniki formuł, nie treść formuł.
- Numer referencyjny ma format `T{tydzień}/{lp}/{rok}`, np. `T23/1/2026`.
- Numeracja resetuje się co tydzień, a anulowane numery nie są używane ponownie.
- Jeden plik cartroutingu dotyczy jednego zbiornika i jest wyszukiwany po indeksie zbiornika.
- Elementów cartroutingu nie tłumaczymy; opisy części pozostają po angielsku.
- Braki znikają przez uzupełnienie ilości pobranej, nie przez ręczne kasowanie braku.
- Wydanie zlecenia z brakami wymaga zatwierdzenia Kierownika.
- Cofnięcie wydania z produkcji wymaga zalogowanego Kierownika.
- PDF-y MVP są w formacie A4 pionowo, bez QR i bez kodów kreskowych.

## Stack

- Next.js
- TypeScript
- Prisma
- SQLite
- ExcelJS
- Vitest

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

Aplikacja startuje domyślnie pod adresem:

```text
http://localhost:3000
```


## Jak podejrzeć aplikację

Po sklonowaniu repozytorium uruchom lokalnie:

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run dev
```

Następnie otwórz w przeglądarce:

```text
http://localhost:3000
```

Na ekranie startowym powinieneś zobaczyć demonstracyjny dashboard MVP z:

- podsumowaniem tygodnia,
- sekcją mapowania Excela,
- listą zleceń,
- brakami,
- przykładowym snapshotem cartroutingu z angielskimi nazwami części.

## Czy aplikacja działa teraz?

Kod aplikacji i reguły domenowe są przygotowane, ale pełne uruchomienie wymaga zainstalowania zależności npm. W tym środowisku instalacja może zostać zablokowana przez proxy/registry błędem:

```text
403 Forbidden - GET https://registry.npmjs.org/@prisma%2fclient
```

Jeśli widzisz taki błąd lokalnie, sprawdź konfigurację sieci/proxy lub registry npm. Po poprawnym `npm install` uruchom:

```bash
npm test
npm run build
npm run dev
```

Dopiero przejście `npm test` i `npm run build` potwierdza, że aplikacja jest gotowa do normalnego podglądu developerskiego.

## Testy

```bash
npm test
```

## Model domenowy

Najważniejsze encje znajdują się w `prisma/schema.prisma`:

- `User`
- `ImportBatch`
- `ImportedShippingRow`
- `WeeklyOrder`
- `OrderCartroutingSnapshot`
- `OrderCartroutingItem`
- `ShortageApproval`
- `ReferenceNumberSequence`
- `AuditLog`
- `PrintJob`

## Reguły biznesowe w kodzie

Podstawowe reguły MVP są zaimplementowane w `lib/domain.ts`:

- agregacja 5 dni roboczych tygodnia,
- pomijanie zbiorników bez wysyłki,
- walidacja liczb całkowitych,
- generowanie numerów referencyjnych,
- przeliczanie pozycji cartroutingu,
- wyliczanie braków,
- grupowanie braków po części,
- blokada wydania z brakami bez aktywnego zatwierdzenia Kierownika.
