# Website Till Börner – Filmproduktion

Statische Website ohne Build-Schritt. Live unter https://tillboerner.com.

## Aufbau

- `index.html` – Startseite (Showreel, Kundenlogos, Manifest, Filme, Hochformat, Ablauf, Garantie, Kundenstimmen, Fragen, Kontakt)
- `impressum.html`, `datenschutz.html`, `links.html`
- `assets/styles.css`, `assets/main.js` – ein Stylesheet, ein Skript, keine Abhängigkeiten
- `assets/img/`, `assets/filme/` (Vorschaubilder), `assets/logos/` (Kundenlogos), `assets/fonts/` (Gloock, Albert Sans, lokal eingebunden)
- `CNAME`, `.nojekyll` – für GitHub Pages, nicht löschen

Lokale Vorschau: `python3 -m http.server 4173` im Projektordner, dann http://localhost:4173.

## Veröffentlichung

- GitHub Pages aus dem Zweig `main`, Wurzelverzeichnis. **Jeder Push auf `main` ist nach etwa einer Minute live.**
- Änderungen deshalb erst in der Vorschau zeigen und nur nach ausdrücklicher Freigabe auf `main` pushen. Für größere Umbauten einen eigenen Zweig und einen Pull Request nutzen.
- Domain und DNS liegen bei Hostinger: vier `A`-Einträge `@` → `185.199.108.153` bis `185.199.111.153`, `CNAME www` → `bettervideoss.github.io`. Die Einträge für E-Mail (`MX`, SPF, DKIM, DMARC) gehören zu Google Workspace und bleiben unangetastet.
- An Domain, DNS und Pages-Einstellungen nichts ohne ausdrückliche Freigabe ändern.
- Die Custom Domain steht in der Datei `CNAME` und in den Pages-Einstellungen. Wird sie über die GitHub-Oberfläche oder API geändert, legt GitHub eigene Commits an – vor dem nächsten Push `git pull --ff-only`.

## Gestaltung (verbindlich)

- Farben aus dem Corporate Design von betterVIDEOS: Pink `#f95758`, Dunkelblau `#0c253d`, Hellblau `#90c4de`, Orange `#fd8c04`, Grün `#93c47d`, Grau `#b1b4b8`; blasse Töne `#fac9c9 #c6ddf5 #cde7f4 #f9cb9c #c3e1b6 #f0f1f1`.
- Schriften: Gloock (Überschriften), Albert Sans (Text, Schnitte 400–700).
- Flächen und Bilder sind gerundet (`--rund`), keine eckigen Kästen. Keine kursive oder dünne Schrift in Fließtexten.
- Keine Kamera-Spielereien (Sucher-Rahmen, REC, Timecode).
- Dezente Bewegung beim Scrollen ist erwünscht; `prefers-reduced-motion` wird überall beachtet.
- Hero: Das Showreel (Vimeo `1179386478`) läuft stumm und automatisch, ohne Knopf für Ton. Im Titel „Telling your Story.“ stehen T, y und S optisch auf einer Achse (Randausgleich per `margin-left` in `em`).
- Logo-Band: läuft ohne Pause, Logos farbig, beim Überfahren größer.
- Manifest: Tills Foto mit der Mission als Zitat darunter. Der Satz „Wie das geht, steht direkt hier drunter.“ kommt nicht wieder.
- Filme: Der Knopf heißt „Projekte im Überblick“ – nicht „Alle Filme“ und keine Anzahl nennen, es gibt mehr Projekte als gezeigt. Solange der Dialog offen ist, scrollt die Seite nicht.
- Hochformat: keine eingekreisten Wörter.
- Garantie: Der Stempel wird beim ersten Herunterscrollen „aufgedrückt“ (Klassen `wartet` / `drauf`, Keyframes `stempeln`). „Garantie“ steht nicht in der Navigation.
- Kontakt: dezent, keine plakatgroße Telefonnummer; die Nummer bleibt gut sichtbar und hat „Nummer kopieren“. Der Knopf „Anrufen“ im Kopf öffnet am Desktop eine Kontaktkarte und wählt auf Touch-Geräten direkt.

## Inhalte

- Anschrift und E-Mail überall gleich (Startseite, Impressum, Datenschutz, `links.html`): Till Börner, Mosczinskystraße 10, 01069 Dresden, mail@bettervideos.de.
- Kundenstimmen kommen aus dem Google-Bewertungs-Widget von Elfsight; darüber der Knopf „Alle Google-Bewertungen ansehen“.

## Technische Hinweise

- Stylesheet und Skript sind mit einer Versionsmarke eingebunden (`assets/styles.css?v=6`, `assets/main.js?v=6`). Bei jeder Änderung an einer der beiden Dateien die Zahl in allen vier HTML-Dateien hochzählen, sonst zeigen Browser bis zu zehn Minuten lang die alte Fassung.
- Terminbuchung: Der Knopf mit `data-buchen` öffnet den Dialog, Knöpfe mit `data-buchen-auf` öffnen denselben. Mit `data-buchen-api` (Adresse des Apps-Script aus `apps-script/buchung.gs`) läuft die eigene Buchung; ohne zeigt der Dialog rechts die Buchungsseite von Google.

- Elfsight-Widget: `main.js` misst die Karten und setzt `grid-row`, damit sie lückenlos stapeln. Das Raster des Widgets muss `display: grid` bleiben, sonst lädt es nur drei statt sechs Karten.
- Kundenlogos: WebP mit Transparenz, 360 × 200 px, freigestellt in Originalfarben. Die Originaldateien und das Aufbereitungsskript liegen nicht im Repository.
- Filmtitel enthalten weiche Trennstellen (`&shy;`), damit lange Namen nicht in die Laufzeit ragen.
- Bilder liegen als AVIF mit JPG-Rückfall vor; beim Ersetzen beide Dateien tauschen.
