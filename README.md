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

Na ekranie startowym powinieneś zobaczyć interaktywne demo MVP z:

- logowaniem demo jako Magazynier, Planista albo Kierownik,
- podsumowaniem tygodnia,
- sekcją mapowania Excela i działającym zatwierdzeniem importu dla Planisty/Kierownika,
- zakładką **Plan produkcyjny** z tabelą tygodnia: LP, index zbiornika, numer ref., ilość, braki i checkbox wydania,
- edycją ilości pobranych w cartroutingu i automatycznym przeliczaniem braków,
- blokadą wydania zlecenia z brakami do czasu zatwierdzenia przez Kierownika,
- zakładką **Lista braków** z tabelą: index braku, indeks zbiornika, numer referencyjny, ilość, data dodania i checkbox „czy dojechało”,
- wejściem w indeks braku, które pokazuje wszystkie zlecenia i numery referencyjne dla tego samego elementu,
- zakładką **Logi kierownika**, widoczną tylko po zalogowaniu jako Kierownik,
- zakładką **Baza JSON** pokazującą ostatnie dane z planu wysyłek, bazowe cartroutingi i unikatowe elementy z cartroutingów.

## Demo ról i akcji

W obecnym MVP przyciski działają lokalnie na danych demonstracyjnych w pamięci przeglądarki:

- **Magazynier** może podejrzeć plan produkcyjny, zmieniać ilości pobrane, oznaczać braki jako dojechane i wydać zlecenie bez braków.
- **Planista** może zatwierdzić import demo oraz pracować na planie produkcyjnym.
- **Kierownik** może zatwierdzić wydanie mimo braków, cofnąć wydanie z produkcji i widzi dodatkową zakładkę logów.

Dane nie zapisują się jeszcze w bazie po odświeżeniu strony — to etap interaktywnego frontendu MVP przed podpięciem prawdziwych endpointów i Excela.

## Zakładki MVP

- **Dashboard** — ogólne podsumowanie startowe oraz mapowanie importu.
- **Plan produkcyjny** — tygodniowa lista wózków do zebrania, w formie tabeli podobnej do dokumentu z odnośnikami tygodni.
- **Lista braków** — lista wszystkich brakujących elementów z filtrem ukrywania pozycji oznaczonych jako „dojechało”.
- **Logi kierownika** — podgląd zmian, poprzedniej wersji, nowej wersji, użytkownika oraz daty i godziny; widoczne tylko dla Kierownika.
- **Baza JSON** — techniczny podgląd ostatnio pobranych danych z planu wysyłek, bazowych cartroutingów i unikatowych elementów.

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
