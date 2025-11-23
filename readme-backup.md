# Backup D1 – instrukcje i komendy

## Cel

- Szybkie wykonywanie kopii zapasowych Cloudflare D1 (remote i local), przywracanie, oraz pełny cleanup (DROP → restore).
- Pliki backupów są śledzone przez git w `./backups`.

## Przegląd i filozofia

- Backupy są prostymi zrzutami SQL (`wrangler d1 export`), które można potem odtworzyć (`wrangler d1 execute`).
- Restore nie kasuje tabel automatycznie — dlatego dodaliśmy narzędzia do “clean-restore” (DROP → odtworzenie).
- Wszystkie komendy opierają się na skryptach w `package.json` i działają zarówno dla lokalnej bazy dev (Miniflare), jak i zdalnej (produkcyjnej/testowej) po fladze `--remote`.
- Nie wymuszamy wersji Node; `wrangler@latest` wymaga Node ≥ 20 — jeśli środowisko jest starsze, CLI zgłosi błąd.

## Format nazw plików

- `DD-MM-YYYY_HH-MM-<hash>` np. `17-11-2025_14-39-90da38b`
- `<hash>` to skrócony hash najnowszego commita repo.

## Wymagania

- `wrangler@latest` (CLI), `bun`, dostęp do konta Cloudflare.
- Konfiguracja D1 w `apps/server/wrangler.jsonc` (w tym `account_id`) – patrz `apps/server/wrangler.jsonc:6`.
- Eksport może chwilowo blokować bazę; eksport wirtualnych tabel (np. FTS5) nie jest wspierany.

## Konfiguracja D1 – szybki start

- Zaloguj się: `npx wrangler login`
- Utwórz bazę (jeśli potrzebna): `npx wrangler d1 create <nazwa>`
- Dodaj binding w `apps/server/wrangler.jsonc` w sekcji `d1_databases` oraz ustaw `account_id`.
- Sprawdź dostęp: `npx wrangler whoami` — upewnij się, że masz uprawnienia do D1.

## Zmienna środowiskowa

- `D1_DB` – nazwa lub ID bazy (np. `auth-litewkateam`).

## Backup

- Remote: `D1_DB=auth-litewkateam bun run db:backup:remote`
- Local: `D1_DB=auth-litewkateam bun run db:backup:local`
- Full (remote + local do folderu z timestampem): `D1_DB=auth-litewkateam bun run db:backup:full`

### Opcje eksportu (wrangler)

- `--no-data`: tylko schema
- `--no-schema`: tylko dane
- `--table=<nazwa>`: tylko wybrane tabele
- Uwaga: import z pliku `--file` ma limit ok. 5GiB (duże dumpy podziel na części).

## Restore

- Local (wskazany plik): `D1_DB=auth-litewkateam FILE=./backups/local-<STAMP>.sql bun run db:restore:local`
- Remote (wskazany plik): `D1_DB=auth-litewkateam FILE=./backups/remote-<STAMP>.sql bun run db:restore:remote`
- Local – najnowszy plik: `D1_DB=auth-litewkateam bun run db:restore:local:latest`
- Remote – najnowszy plik: `D1_DB=auth-litewkateam bun run db:restore:remote:latest`

### Semantyka restore

- `execute --file` wykona dokładnie komendy z dumpa (zwykle `CREATE TABLE` + `INSERT`).
- Jeśli dump nie zawiera `DROP TABLE`, stare tabele i dane pozostaną — dlatego dla pełnego resetu użyj “cleanup” lub dodaj `DROP` na początku dumpa.

## Cleanup (DROP TABLE) i Clean-Restore (opcja 3)

- Cleanup Remote (DROP wszystkich tabel zdalnie): `D1_DB=auth-litewkateam bun run db:cleanup:remote`
- Cleanup Local (DROP lokalnie): `D1_DB=auth-litewkateam bun run db:cleanup:local`
- Clean-Restore Remote (DROP → restore najnowszy z `./backups`): `D1_DB=auth-litewkateam bun run db:clean-restore:remote:latest`
- Clean-Restore Local (DROP → restore najnowszy): `D1_DB=auth-litewkateam bun run db:clean-restore:local:latest`
- Reset lokalnej bazy przez usunięcie plików: `bun run db:reset:local`

## Jak działa opcja 3 (prosto)

- Skrypt eksportuje sam schemat (`--no-data`) do tymczasowego pliku.
- Z niego generuje listę tabel, tworzy skrypt `DROP TABLE IF EXISTS ...` (pomija `_cf_KV`, wyłącza i potem włącza `foreign_keys`).
- Wysyła DROP do bazy, a w “clean-restore” po DROP automatycznie wykonuje restore z najnowszego dumpa.

### Dlaczego wyłączamy foreign keys

- Podczas masowego `DROP` zależności między tabelami mogłyby blokować operację.
- `PRAGMA foreign_keys=OFF` pozwala bezpiecznie usunąć wszystkie tabele; po zakończeniu przywracamy `ON`.

## Zdalne “totalne” przywracanie – inne opcje

- Time Travel (produkcyjny storage): cofa bazę do wybranego punktu w czasie. Idealne do szybkiego powrotu do znanego stanu.
- Legacy backup restore (alpha storage): snapshoty (co godzinę, 24h retencji) oraz ręczne backupy z pełnym nadpisaniem stanu.
- Opcja 3 (DROP → restore): pełna kontrola, przewidywalne odtworzenie. Ostrożnie na produkcji.

### Kiedy co wybrać

- Time Travel: gdy chcesz szybko cofnąć produkcję do stabilnego punktu w czasie.
- Legacy restore: gdy baza jest na alpha storage bez Time Travel.
- DROP → restore: gdy chcesz kompletnie przebudować strukturę/dane ze znanego dumpa.

## Uwagi

- Restore z dumpa nie czyści tabel, jeśli dump nie zawiera `DROP TABLE`. Do pełnego resetu użyj “cleanup” lub Time Travel/Legacy restore.
- Backup może blokować zapytania; planuj poza szczytem.
- `wrangler@latest` wymaga Node ≥ 20. Skrypty nie wymuszają wersji – jeśli Node będzie za stary, CLI zgłosi błąd.

## Walidacja i testy

- Po backupie wykonaj sanity check (np. `grep -q "CREATE TABLE" ./backups/remote-*.sql`).
- Testuj restore na lokalnej instancji dev zanim zrobisz cleanup na produkcji.
- Po clean-restore wykonaj kilka kontrolnych `SELECT` (np. liczba rekordów w kluczowych tabelach).

## Typowe problemy i rozwiązania

- “Wrangler requires Node ≥ 20”: zaktualizuj Node lub uruchamiaj z CI, gdzie jest Node 20+.
- “Couldn't find a D1 DB in config”: upewnij się, że `apps/server/wrangler.jsonc` zawiera binding oraz poprawne `database_name`/`preview_database_id`.
- Interaktywne wybieranie konta: dodaj `account_id` do `wrangler.jsonc` (już ustawione), zaloguj się `wrangler login`.
- Duże dumpy: import ma limit ~5GiB — dziel plik na mniejsze części i importuj sekwencyjnie.
- Wirtualne tabele (FTS5): usuń je przed eksportem i odtwórz ręcznie po restore.

## Bezpieczeństwo i retencja

- Nie commituj sekretów/kluczy do repo; używaj `GitHub Secrets` i `wrangler secret`.
- Backupy w repo: OK operacyjnie, ale rozważ retencję i rozmiar repo; alternatywnie przechowuj w R2.
- Ustal politykę retencji (np. 30 dni) i cykliczne czyszczenie.

## Szybkie przykłady

- Zrób backup obu środowisk i commit: `D1_DB=auth-litewkateam bun run db:backup:full && git add backups && git commit -m "backup"`
- Pełny reset lokalny do najnowszego backupu: `bun run db:reset:local && D1_DB=auth-litewkateam bun run db:restore:local:latest`
- Zdalny clean-restore do najnowszego backupu: `D1_DB=auth-litewkateam bun run db:clean-restore:remote:latest`

## TODO

- Harmonogram backupów (cron lokalnie)
  - Przykład dziennego backupu o 02:00:
    - `0 2 * * * cd /Users/rafalfurmaga/aaaa/my-better-t-app && D1_DB=auth-litewkateam bun run db:backup:full >> logs/backup.log 2>&1`
  - Wskazówki:
    - Ustaw `TZ` jeśli potrzebujesz strefy czasowej
    - Dodaj rotację logów (np. `logrotate`) i monitoruj błędy
    - Dla clean-restore testowego możesz uruchamiać w osobnym środowisku dev

- GitHub Actions – cykliczny backup i artefakty
  - Minimalny workflow (cron co noc) zapisujący dump jako artefakt:
    - `.github/workflows/d1-backup.yml`
    - ```yaml
      name: D1 Backup
      on:
        schedule:
          - cron: '0 2 * * *'
        workflow_dispatch:
      jobs:
        backup:
          runs-on: ubuntu-latest
          steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                node-version: '20.x'
            - name: Remote backup
              env:
                D1_DB: auth-litewkateam
              run: |
                mkdir -p backups
                STAMP=$(date +"%d-%m-%Y_%H-%M")-$(git rev-parse --short HEAD || echo unknown)
                npx --yes wrangler@latest d1 export "$D1_DB" --remote --output "./backups/remote-$STAMP.sql"
            - name: Upload artifact
              uses: actions/upload-artifact@v4
              with:
                name: d1-remote-backup
                path: backups/*.sql
      ```
  - Wskazówki:
    - `wrangler@latest` wymaga Node ≥ 20; w Actions użyj `setup-node@v4`
    - Jeśli workflow ma działać na prywatnym repo z ograniczeniami, rozważ `permissions: contents: read`

- Upload dumpów do R2 (S3‑compatible)
  - Sekrety w GH Actions: `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT` (np. `https://<accountid>.r2.cloudflarestorage.com`)
  - ## Krok uploadu przez AWS CLI:
    ```yaml
    - name: Install AWS CLI
      run: sudo apt-get update && sudo apt-get install -y awscli
    - name: Upload to R2
      env:
        R2_BUCKET: ${{ secrets.R2_BUCKET }}
        R2_ACCESS_KEY_ID: ${{ secrets.R2_ACCESS_KEY_ID }}
        R2_SECRET_ACCESS_KEY: ${{ secrets.R2_SECRET_ACCESS_KEY }}
        R2_ENDPOINT: ${{ secrets.R2_ENDPOINT }}
      run: |
        export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID"
        export AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY"
        aws s3 cp backups/ s3://$R2_BUCKET/d1/ --recursive --endpoint-url "$R2_ENDPOINT"
    ```
  - Retencja:
    - Ustaw lifecycle w R2 (np. usuwanie plików starszych niż 30 dni)
    - Alternatywnie: w GH Actions zachowuj tylko ostatnie N artefaktów

- Walidacja i bezpieczeństwo
  - Po backupie wykonaj szybki sanity check (np. `grep -q "CREATE TABLE" ./backups/remote-*.sql`)
  - Testowy restore do środowiska dev przed czyszczeniem produkcji
  - Sekrety trzymaj w `GitHub Secrets`; nie commituj kluczy i tokenów do repo
