/**
 * Terminbuchung für tillboerner.com
 *
 * Liefert der Website die freien Zeiten aus dem Google Kalender (GET)
 * und trägt gebuchte Kennenlerngespräche ein (POST).
 *
 * Einrichten: script.google.com → Neues Projekt → diesen Code einfügen →
 * Bereitstellen → Neue Bereitstellung → Typ „Web-App“,
 * Ausführen als „Ich“, Zugriff „Jeder“. Die Adresse der Web-App kommt in
 * index.html an den Knopf: data-buchen-api="…".
 */

const ZONE = 'Europe/Berlin';
const DAUER_MIN = 30;        // Länge eines Gesprächs
const VON_UHR = 11;          // erster Termin beginnt um 11:00
const BIS_UHR = 23;          // letzter Termin beginnt um 22:00
const TAGE_VORAUS = 7;       // buchbar ist die kommende Woche
const VORLAUF_STD = 12;      // frühestens in 12 Stunden
const PUFFER_MIN = 15;       // Abstand zu anderen Terminen
const MAX_PRO_TAG = 8;       // Schutz vor Missbrauch: höchstens so viele Buchungen pro Kalendertag

function doGet() {
  return antwort({ tage: freieTage() });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return antwort({ ok: false, grund: 'eingabe' }); }
  if (d.website) return antwort({ ok: true }); // Falle für Bots: Feld ist für Menschen unsichtbar

  const name = text(d.name, 80), email = text(d.email, 120), telefon = text(d.telefon, 40), nachricht = text(d.nachricht, 1000);
  const gueltig = name.length >= 2
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    && telefon.replace(/\D/g, '').length >= 6
    && /^\d{4}-\d{2}-\d{2}$/.test(d.datum) && /^\d{2}:00$/.test(d.zeit);
  if (!gueltig) return antwort({ ok: false, grund: 'eingabe' });

  const sperre = LockService.getScriptLock();
  sperre.waitLock(15000);
  try {
    const tage = freieTage();
    const tag = tage.filter(function (t) { return t.datum === d.datum; })[0];
    if (!tag || tag.zeiten.indexOf(d.zeit) < 0) return antwort({ ok: false, grund: 'vergeben', tage: tage });

    const merker = PropertiesService.getScriptProperties();
    const heute = 'anzahl-' + Utilities.formatDate(new Date(), ZONE, 'yyyy-MM-dd');
    const anzahl = Number(merker.getProperty(heute) || 0);
    if (anzahl >= MAX_PRO_TAG) return antwort({ ok: false, grund: 'voll' });

    const start = zeitpunkt(d.datum, parseInt(d.zeit, 10));
    const ende = new Date(start.getTime() + DAUER_MIN * 60000);
    const beschreibung = 'Kennenlerngespräch am Telefon. Till Börner ruft an.\n\n'
      + 'Name: ' + name + '\nTelefon: ' + telefon + '\nE-Mail: ' + email
      + (nachricht ? '\n\nWorum geht es?\n' + nachricht : '')
      + '\n\nGebucht über tillboerner.com';
    CalendarApp.getDefaultCalendar().createEvent('Kennenlerngespräch mit Till Börner – ' + name, start, ende, {
      description: beschreibung, guests: email, sendInvites: true
    });
    merker.setProperty(heute, String(anzahl + 1));

    const wann = Utilities.formatDate(start, ZONE, "dd.MM.yyyy 'um' HH:mm 'Uhr'");
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Neues Kennenlerngespräch: ' + name + ', ' + wann, beschreibung);
    return antwort({ ok: true });
  } finally {
    sperre.releaseLock();
  }
}

/** Die Werktage der nächsten Woche mit ihren freien Startzeiten, z. B. { datum: '2026-11-19', zeiten: ['11:00', '14:00'] } */
function freieTage() {
  const kalender = CalendarApp.getDefaultCalendar();
  const jetzt = new Date();
  const fruehestens = jetzt.getTime() + VORLAUF_STD * 3600000;
  const tage = [];
  for (let i = 0; i <= TAGE_VORAUS; i++) {
    const tag = new Date(jetzt.getTime() + i * 86400000);
    const datum = Utilities.formatDate(tag, ZONE, 'yyyy-MM-dd');
    if (Number(Utilities.formatDate(tag, ZONE, 'u')) > 5) continue; // 6 = Samstag, 7 = Sonntag
    const belegt = kalender.getEvents(zeitpunkt(datum, 0), zeitpunkt(datum, 24)).filter(blockiert).map(function (t) {
      return [t.getStartTime().getTime() - PUFFER_MIN * 60000, t.getEndTime().getTime() + PUFFER_MIN * 60000];
    });
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
  return tage;
}

/** Ein Kalendereintrag blockiert, wenn er als „Beschäftigt“ gilt und nicht abgesagt wurde. */
function blockiert(termin) {
  try { if (termin.getTransparency() === CalendarApp.EventTransparency.TRANSPARENT) return false; } catch (err) {}
  try { if (termin.getMyStatus() === CalendarApp.GuestStatus.NO) return false; } catch (err) {}
  return true;
}

function zeitpunkt(datum, stunde) {
  if (stunde >= 24) return new Date(zeitpunkt(datum, 0).getTime() + 86400000);
  return Utilities.parseDate(datum + ' ' + (stunde < 10 ? '0' : '') + stunde + ':00', ZONE, 'yyyy-MM-dd HH:mm');
}

function text(wert, laenge) {
  return String(wert == null ? '' : wert).replace(/[\u0000-\u0008\u000B-\u001F]/g, '').trim().slice(0, laenge);
}

function antwort(daten) {
  return ContentService.createTextOutput(JSON.stringify(daten)).setMimeType(ContentService.MimeType.JSON);
}
