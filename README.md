# Lesemappe

Die Leseblätter aus der Schule zum Mitmachen: https://lesemappe.janemmel.de (noindex).
Kinder schauen, Eltern öffnen die Seite. Jedes Leseblatt hat eine Seite mit Rutschen, Herzsätzen,
Monsterreihen, Silbenflug, Mini-Geschichte mit Fragen, Wörter bauen und Lesetagen, dazu ein PDF
(Seite 1 wie das Schulblatt, Seite 2 Geschichte, Fragen und Buchstabenkarten zum Ausschneiden).
Hintergrund für Eltern: `seiten/eltern.html` (→ /eltern/).

```powershell
npm install
npm run bilder        # Wachsmalbilder neu zeichnen (Python: numpy, pillow), dauert ~2 Minuten
npm start             # bauen und lokal zeigen: http://localhost:8097
./deploy.ps1 -DryRun  # bauen und prüfen
./deploy.ps1          # bauen und zu Cloudflare Pages hochladen
```

## Neue Lektion

`lektionen/<nr>.json` nach dem Muster von `1.json` anlegen, fertig: Startseite, Lektionsseite und PDF
entstehen beim Bauen. Wörter in `geschichte.zeilen` werden automatisch in Silben gefärbt (`Lo-la` erzwingt
die Trennung), `♥` ist das Herz („mag“), kleingeschriebene Bildnamen (`kirsche`) sind Bilder. Fehlt ein Bild,
in `tools/bilder.py` zeichnen (`BILDER`) und in `tools/build.mjs` bei `NAMEN` den Alternativtext eintragen.

Für die Geschichte nur Buchstaben verwenden, die das Kind schon kennt; alles andere als Bild.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `lektionen/*.json` | Inhalt der Leseblätter |
| `seiten/eltern.html` | Elternseite (Empfehlungen) |
| `site/` | CSS, JavaScript, Schrift (Andika, gekürzt), Bilder als WebP – wird nach `_site/` kopiert |
| `tools/build.mjs` | baut `_site/`, prüft alle lokalen Links und Bilder |
| `tools/pdf.mjs` | PDF je Lektion (pdf-lib, Andika aus `tools/fonts/`) |
| `tools/geometrie.mjs` | Lage der Laute auf der Rutsche, Silbentrennung (Website und PDF) |
| `tools/kreide.py`, `tools/bilder.py` | Wachsmalbilder, übernommen aus `../kitaweb/tools/generate_drawings.py`, feste Seeds |
| `generated/` | Bilder groß (`*.png`), für PDFs (`klein/`), Kontaktbogen `_uebersicht.png` |
| `deploy.ps1`, `tools/domain.mjs` | Upload; legt beim ersten Mal Pages-Projekt `lesemappe-janemmel-de`, Domain und CNAME an |

Fortschritt (Herzen, Haken, Sterne, Name) speichert nur der Browser (localStorage). Die Stimme ist die
Sprachausgabe des Geräts und liest nur Wörter und Sätze, nie einzelne Buchstaben („em“ statt „mmm“).

Schrift: Andika, SIL Open Font License (`tools/fonts/OFL.txt`).
