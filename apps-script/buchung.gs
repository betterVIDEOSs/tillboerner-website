/**
 * Terminbuchung für tillboerner.com
 *
 * Liefert der Website die freien Zeiten aus dem Google Kalender (GET)
 * und trägt gebuchte Kennenlerngespräche ein (POST).
 *
 * Einrichten (einmalig, etwa fünf Minuten):
 *   1. script.google.com → „Neues Projekt“, den Beispielcode durch diesen Code ersetzen.
 *   2. Links bei „Dienste“ auf + klicken, „Google Calendar API“ wählen, „Hinzufügen“
 *      (nötig für den Google-Meet-Link).
 *   3. „Bereitstellen“ → „Neue Bereitstellung“ → Typ „Web-App“,
 *      Ausführen als „Ich“, Zugriff „Jeder“. Die Berechtigungen bestätigen.
 *   4. Die Web-App-URL (endet auf /exec) kommt in index.html an den Knopf: data-buchen-api="…".
 * Die Erinnerungs-Mails schalten sich beim ersten Aufruf von selbst ein.
 * Prüfen: Web-App-URL mit ?pruefen=1 aufrufen – zeigt, ob Dienst und Erinnerungen bereit sind.
 */

const ZONE = 'Europe/Berlin';
const DAUER_MIN = 30;        // Länge eines Gesprächs
const VON_UHR = 11;          // erster Termin beginnt um 11:00
const BIS_UHR = 20;          // letzter Termin beginnt um 19:00 und endet vor 20 Uhr
const TAGE_VORAUS = 14;      // buchbar sind die nächsten zwei Wochen
const VORLAUF_STD = 12;      // frühestens in 12 Stunden
const PUFFER_MIN = 15;       // Abstand zu anderen Terminen
const MAX_PRO_TAG = 8;       // Schutz vor Missbrauch: höchstens so viele Buchungen pro Kalendertag

function doGet(e) {
  const erinnerungen = erinnerungenSichern();
  if (e && e.parameter && e.parameter.pruefen) {
    return antwort({ ok: true, meetDienst: typeof Calendar !== 'undefined', erinnerungen: erinnerungen, zone: ZONE });
  }
  return antwort({ tage: freieTage() });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return antwort({ ok: false, grund: 'eingabe' }); }
  if (d.website) return antwort({ ok: true }); // Falle für Bots: Feld ist für Menschen unsichtbar

  const name = text(d.name, 80), email = text(d.email, 120), telefon = text(d.telefon, 40), nachricht = text(d.nachricht, 1000);
  const gueltig = name.length >= 2
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && /^\d{4}-\d{2}-\d{2}$/.test(d.datum) && /^\d{2}:00$/.test(d.zeit);
  if (!gueltig) return antwort({ ok: false, grund: 'eingabe' });

  if (typeof Calendar === 'undefined') return antwort({ ok: false, grund: 'dienst' }); // Dienst „Google Calendar API“ fehlt

  const sperre = LockService.getScriptLock();
  sperre.waitLock(15000);
  try {
    const tage = freieTage(true); // frisch aus dem Kalender, nicht aus dem Zwischenspeicher
    const tag = tage.filter(function (t) { return t.datum === d.datum; })[0];
    if (!tag || tag.zeiten.indexOf(d.zeit) < 0) return antwort({ ok: false, grund: 'vergeben', tage: tage });

    const merker = PropertiesService.getScriptProperties();
    const heute = 'anzahl-' + Utilities.formatDate(new Date(), ZONE, 'yyyy-MM-dd');
    const anzahl = Number(merker.getProperty(heute) || 0);
    if (anzahl >= MAX_PRO_TAG) return antwort({ ok: false, grund: 'voll' });

    const start = zeitpunkt(d.datum, parseInt(d.zeit, 10));
    const ende = new Date(start.getTime() + DAUER_MIN * 60000);
    const beschreibung = 'Kennenlerngespräch per Google Meet. Der Link steht in diesem Termin.\n\n'
      + 'Name: ' + name + (telefon ? '\nTelefon: ' + telefon : '') + '\nE-Mail: ' + email
      + (nachricht ? '\n\nWorum geht es?\n' + nachricht : '')
      + '\n\nGebucht über tillboerner.com';
    // Über die Calendar API (Dienst „Calendar“), weil nur sie ein Google Meet anlegen kann.
    // Der Termin gilt als „Beschäftigt“ und sperrt die Zeit; der Gast bekommt die Einladung samt Meet-Link per E-Mail.
    const termin = Calendar.Events.insert({
      summary: 'Kennenlerngespräch mit Till Börner – ' + name,
      description: beschreibung,
      start: { dateTime: start.toISOString() },
      end: { dateTime: ende.toISOString() },
      attendees: [{ email: email, displayName: name }],
      transparency: 'opaque',
      // Merker für die Erinnerungs-Mails. Liegt der Termin schon morgen, entfällt die Erinnerung am Vortag.
      extendedProperties: { private: { buchung: '1', gast: email, name: name, vortag: start.getTime() - Date.now() < 26 * 3600000 ? 'entfaellt' : '', stunde: '' } },
      conferenceData: { createRequest: { requestId: Utilities.getUuid(), conferenceSolutionKey: { type: 'hangoutsMeet' } } },
      reminders: { useDefault: true }
    }, 'primary', { conferenceDataVersion: 1, sendUpdates: 'all' });
    const meet = termin.hangoutLink || '';
    CacheService.getScriptCache().remove('tage');
    merker.setProperty(heute, String(anzahl + 1));

    const wann = Utilities.formatDate(start, ZONE, "dd.MM.yyyy 'um' HH:mm 'Uhr'");
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Neues Kennenlerngespräch: ' + name + ', ' + wann,
      beschreibung + (meet ? '\n\nGoogle Meet: ' + meet : ''));
    return antwort({ ok: true, meet: meet });
  } finally {
    sperre.releaseLock();
  }
}

/** Schaltet die Erinnerungen beim ersten Aufruf der Web-App ein; danach merkt sich das Skript, dass sie laufen. */
function erinnerungenSichern() {
  try {
    const merker = PropertiesService.getScriptProperties();
    if (merker.getProperty('erinnerungen') === 'an') return true;
    einrichten();
    merker.setProperty('erinnerungen', 'an');
    return true;
  } catch (err) {
    return false;
  }
}

/** Legt den Zeitplan an: alle 15 Minuten prüfen, ob Erinnerungen fällig sind. Läuft von selbst, kann aber auch von Hand gestartet werden. */
function einrichten() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'erinnern') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('erinnern').timeBased().everyMinutes(15).create();
}

/** Schickt dem Gast je eine Erinnerung am Tag vorher (24 Stunden vor dem Termin) und eine Stunde vorher. */
function erinnern() {
  const jetzt = Date.now();
  const liste = Calendar.Events.list('primary', {
    timeMin: new Date(jetzt).toISOString(), timeMax: new Date(jetzt + 25 * 3600000).toISOString(),
    singleEvents: true, privateExtendedProperty: 'buchung=1'
  });
  (liste.items || []).forEach(function (t) {
    if (t.status === 'cancelled' || !t.start || !t.start.dateTime) return;
    const merker = (t.extendedProperties && t.extendedProperties.private) || {};
    const abgesagt = (t.attendees || []).some(function (g) { return g.email === merker.gast && g.responseStatus === 'declined'; });
    if (!merker.gast || abgesagt) return;
    const start = new Date(t.start.dateTime);
    const bis = start.getTime() - jetzt;
    let art = '';
    if (bis > 0 && bis <= 3600000 && !merker.stunde) art = 'stunde';
    else if (bis > 3600000 && bis <= 24 * 3600000 && !merker.vortag) art = 'vortag';
    if (!art) return;

    const tag = Utilities.formatDate(start, ZONE, 'dd.MM.yyyy');
    const uhr = Utilities.formatDate(start, ZONE, 'HH:mm');
    const betreff = art === 'stunde'
      ? 'In einer Stunde: unser Gespräch um ' + uhr + ' Uhr'
      : 'Morgen um ' + uhr + ' Uhr: unser Kennenlerngespräch';
    const zeilen = [
      'Guten Tag ' + (merker.name || '') + ',',
      '',
      art === 'stunde'
        ? 'in einer Stunde, um ' + uhr + ' Uhr, sprechen wir miteinander.'
        : 'eine kurze Erinnerung: Morgen, am ' + tag + ' um ' + uhr + ' Uhr, sprechen wir miteinander.',
      '',
      'Hier geht es zum Google Meet:',
      t.hangoutLink || '(Der Link steht in Ihrer Kalendereinladung.)',
      '',
      'Falls Ihnen etwas dazwischenkommt, antworten Sie einfach auf diese E-Mail oder rufen Sie mich an: 0176 805 068 50.',
      '',
      'Ich freue mich auf das Gespräch!',
      'Till Börner'
    ];
    MailApp.sendEmail(merker.gast, betreff, zeilen.join('\n'), { name: 'Till Börner' });
    merker[art] = 'gesendet';
    Calendar.Events.patch({ extendedProperties: { private: merker } }, 'primary', t.id);
  });
}

/**
 * Die Werktage der nächsten zwei Wochen mit ihren freien Startzeiten, z. B. { datum: '2026-11-19', zeiten: ['11:00', '14:00'] }.
 * Eine einzige Abfrage an den Kalender liefert alle belegten Zeiträume. Einträge, die als „frei“ markiert oder abgesagt sind,
 * zählen dabei nicht als belegt. Das Ergebnis wird eine Minute zwischengespeichert, damit die Website schnell antwortet.
 */
function freieTage(frisch) {
  const speicher = CacheService.getScriptCache();
  if (!frisch) {
    const gemerkt = speicher.get('tage');
    if (gemerkt) return JSON.parse(gemerkt);
  }
  const jetzt = new Date();
  const fruehestens = jetzt.getTime() + VORLAUF_STD * 3600000;
  const bis = new Date(jetzt.getTime() + (TAGE_VORAUS + 1) * 86400000);
  const abfrage = Calendar.Freebusy.query({ timeMin: jetzt.toISOString(), timeMax: bis.toISOString(), items: [{ id: 'primary' }] });
  const belegt = (((abfrage.calendars || {}).primary || {}).busy || []).map(function (b) {
    return [new Date(b.start).getTime() - PUFFER_MIN * 60000, new Date(b.end).getTime() + PUFFER_MIN * 60000];
  });
  const tage = [];
  for (let i = 0; i <= TAGE_VORAUS; i++) {
    const tag = new Date(jetzt.getTime() + i * 86400000);
    const datum = Utilities.formatDate(tag, ZONE, 'yyyy-MM-dd');
    if (Number(Utilities.formatDate(tag, ZONE, 'u')) > 5) continue; // 6 = Samstag, 7 = Sonntag
    const zeiten = [];
    for (let h = VON_UHR; h < BIS_UHR; h++) {
      const start = zeitpunkt(datum, h).getTime();
      const ende = start + DAUER_MIN * 60000;
      if (start < fruehestens) continue;
      if (belegt.some(function (b) { return start < b[1] && ende > b[0]; })) continue;
      zeiten.push((h < 10 ? '0' : '') + h + ':00');
    }
    tage.push({ datum: datum, zeiten: zeiten });
  }
  speicher.put('tage', JSON.stringify(tage), 60);
  return tage;
}

function zeitpunkt(datum, stunde) {
  return Utilities.parseDate(datum + ' ' + (stunde < 10 ? '0' : '') + stunde + ':00', ZONE, 'yyyy-MM-dd HH:mm');
}

function text(wert, laenge) {
  return String(wert == null ? '' : wert).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, laenge);
}

function antwort(daten) {
  return ContentService.createTextOutput(JSON.stringify(daten)).setMimeType(ContentService.MimeType.JSON);
}
