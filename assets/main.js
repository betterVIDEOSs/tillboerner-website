// Till Börner – Filmproduktion
(() => {
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const breit = matchMedia('(min-width: 62rem)');

  /* ── Showreel im Hero: läuft stumm und in Schleife, sobald die Seite steht.
        Wer reduzierte Bewegung oder Datensparen eingestellt hat, sieht stattdessen das Foto. ── */
  const film = document.querySelector('[data-showreel]');
  const sparen = navigator.connection && navigator.connection.saveData;
  if (film && !ruhig && !sparen) {
    const id = film.dataset.showreel;
    const f = document.createElement('iframe');
    f.src = `https://player.vimeo.com/video/${id}?background=1&autoplay=1&muted=1&loop=1&autopause=0&playsinline=1&dnt=1`;
    f.title = 'Showreel, läuft ohne Ton';
    f.allow = 'autoplay';
    f.tabIndex = -1;
    f.setAttribute('aria-hidden', 'true');
    // Erst einblenden, wenn das Video wirklich läuft. Meldet der Player nichts (gesperrt, offline,
    // Fehlerseite), bleibt einfach das Foto stehen.
    const sag = (was) => f.contentWindow.postMessage(JSON.stringify(was), 'https://player.vimeo.com');
    addEventListener('message', (e) => {
      if (e.source !== f.contentWindow || e.origin !== 'https://player.vimeo.com') return;
      let m = e.data;
      try { if (typeof m === 'string') m = JSON.parse(m); } catch (_) { return; }
      if (m.event === 'ready') sag({ method: 'addEventListener', value: 'playProgress' });
      if (m.event === 'playProgress' && m.data && m.data.seconds > 0.2) f.classList.add('laeuft');
    });
    film.append(f);
  }

  /* ── Kundenlogos: Band verdoppeln, damit es nahtlos durchläuft ── */
  const logolauf = document.querySelector('.kunden__lauf');
  if (logolauf && !ruhig) {
    logolauf.querySelectorAll('[data-band]').forEach((band) => {
      const kopie = band.firstElementChild.cloneNode(true);
      kopie.setAttribute('aria-hidden', 'true');
      kopie.querySelectorAll('img').forEach((img) => { img.alt = ''; });
      band.append(kopie);
      band.classList.add('laeuft');
      if (band.dataset.band === 'gegen') band.classList.add('gegen');
    });
  }

  /* ── Vimeo: Die Vorschaubilder sind normale Links zu Vimeo. Mit JavaScript wird daraus
        ein Player an Ort und Stelle, der erst nach dem Klick lädt (Zwei-Klick-Lösung). ── */
  const eigenerKlick = (e) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button);

  function spieler(id, hash, titel, stumm) {
    const f = document.createElement('iframe');
    const p = new URLSearchParams({ autoplay: '1', dnt: '1', title: '0', byline: '0', portrait: '0' });
    if (hash) p.set('h', hash);
    if (stumm) p.set('muted', '1');
    f.src = `https://player.vimeo.com/video/${id}?${p}`;
    f.title = titel;
    f.allow = 'autoplay; fullscreen; picture-in-picture';
    f.allowFullscreen = true;
    f.tabIndex = 0;
    return f;
  }

  // Es läuft immer nur ein Film: Kachel, Bühne oder Saal.
  let kachel = null; // { platz, original }
  function stoppeKachel() {
    if (!kachel) return;
    kachel.platz.replaceWith(kachel.original);
    kachel = null;
  }

  // Kinosaal: auf großen Bildschirmen laufen Reels und Kundenstimmen in einem Dialog
  const saal = document.createElement('dialog');
  saal.className = 'saal';
  saal.innerHTML = '<form method="dialog"><button class="saal__zu">Schließen</button></form><div class="saal__bild"></div>';
  const saalBild = saal.querySelector('.saal__bild');
  let ausloeser = null;
  document.body.append(saal);
  saal.addEventListener('close', () => {
    saalBild.replaceChildren();
    if (ausloeser) ausloeser.focus({ preventScroll: true });
    ausloeser = null;
  });
  saal.addEventListener('click', (e) => { if (e.target === saal) saal.close(); });

  // Große Leinwand
  const buehne = document.getElementById('buehne');
  const programm = document.getElementById('programm');
  let buehnePoster = buehne ? buehne.innerHTML : '';

  function leereBuehne() {
    if (buehne && buehne.querySelector('iframe')) buehne.innerHTML = buehnePoster;
  }

  function starteAufBuehne(id, titel, stumm) {
    stoppeKachel();
    const f = spieler(id, null, titel, stumm);
    buehne.replaceChildren(f);
    if (!stumm) f.focus({ preventScroll: true });
  }

  if (buehne) {
    buehne.addEventListener('click', (e) => {
      const poster = e.target.closest('.poster');
      if (!poster || !eigenerKlick(e)) return;
      e.preventDefault();
      starteAufBuehne(poster.dataset.vimeo, poster.dataset.titel);
    });
  }

  if (buehne && programm) {
    programm.addEventListener('click', (e) => {
      const film = e.target.closest('.film');
      if (!film || !eigenerKlick(e)) return;
      e.preventDefault();
      programm.querySelectorAll('.film[aria-current]').forEach((f) => f.removeAttribute('aria-current'));
      film.setAttribute('aria-current', 'true');

      // Poster der Bühne auf den gewählten Film umstellen, dann abspielen
      const vorlage = document.createElement('div');
      vorlage.innerHTML = buehnePoster;
      const poster = vorlage.querySelector('.poster');
      poster.setAttribute('href', film.getAttribute('href'));
      poster.dataset.vimeo = film.dataset.vimeo;
      poster.dataset.titel = film.dataset.titel;
      poster.querySelector('img').setAttribute('src', film.dataset.poster);
      poster.querySelector('[data-buehne-titel]').textContent = film.dataset.titel;
      buehnePoster = vorlage.innerHTML;

      starteAufBuehne(film.dataset.vimeo, film.dataset.titel);
      const r = buehne.getBoundingClientRect();
      if (r.top < 0 || r.bottom > innerHeight) buehne.scrollIntoView({ behavior: ruhig ? 'auto' : 'smooth', block: 'center' });
    });

    // Kommt die Leinwand zum ersten Mal ins Bild, läuft der erste Film von selbst an – ohne Ton.
    if (!ruhig && !(navigator.connection && navigator.connection.saveData)) {
      const wache = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        wache.disconnect();
        const poster = buehne.querySelector('.poster');
        if (poster && !kachel && !saal.open) starteAufBuehne(poster.dataset.vimeo, poster.dataset.titel, true);
      }, { threshold: 0.6 });
      wache.observe(buehne);
    }

    // Überblick: die Projekte als Raster, ein Tipp startet den gewählten Film auf der Leinwand.
    // Solange der Dialog offen ist, steht die Seite dahinter still (html:has(dialog[open]) im CSS).
    const rasterKnopf = document.querySelector('[data-raster]');
    if (rasterKnopf && typeof HTMLDialogElement === 'function') {
      const raster = document.createElement('dialog');
      raster.className = 'raster';
      raster.setAttribute('aria-label', 'Projekte im Überblick');
      raster.innerHTML = '<div class="raster__kopf"><h2>Projekte im Überblick</h2><form method="dialog"><button class="raster__zu">Schließen</button></form></div><ul class="raster__liste"></ul>';
      const liste = raster.querySelector('.raster__liste');
      programm.querySelectorAll('.film').forEach((film, i) => {
        const li = document.createElement('li');
        li.style.setProperty('--i', i);
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'raster__film';
        const bild = document.createElement('img');
        bild.src = film.dataset.poster; bild.alt = ''; bild.loading = 'lazy'; bild.width = 1280; bild.height = 720;
        const rahmen = document.createElement('span'); rahmen.append(bild);
        const name = document.createElement('b'); name.textContent = film.dataset.titel;
        b.append(rahmen, name);
        b.addEventListener('click', () => { raster.close(); film.click(); });
        li.append(b); liste.append(li);
      });
      document.body.append(raster);
      raster.addEventListener('click', (e) => { if (e.target === raster) raster.close(); });
      rasterKnopf.hidden = false;
      rasterKnopf.addEventListener('click', () => raster.showModal());
    }

    // Der Verlauf am unteren Rand zeigt: hier geht es weiter. Am Listenende verschwindet er.
    const rolle = programm.querySelector('.programm__rolle');
    if (rolle) {
      const pruefe = () => rolle.toggleAttribute('data-ende', rolle.scrollTop + rolle.clientHeight >= rolle.scrollHeight - 8);
      rolle.addEventListener('scroll', pruefe, { passive: true });
      addEventListener('resize', pruefe);
      pruefe();
    }
  }

  // Kacheln (Reels, Kundenstimmen)
  document.querySelectorAll('.clip[data-vimeo]').forEach((clip) => {
    clip.addEventListener('click', (e) => {
      if (!eigenerKlick(e)) return;
      e.preventDefault();
      stoppeKachel();
      leereBuehne();
      const hoch = clip.classList.contains('clip--hoch');
      const f = spieler(clip.dataset.vimeo, clip.dataset.h, clip.dataset.titel);

      if (breit.matches && typeof saal.showModal === 'function') {
        saalBild.className = `saal__bild saal__bild--${hoch ? 'hoch' : 'quer'}`;
        saal.setAttribute('aria-label', clip.dataset.titel);
        saalBild.replaceChildren(f);
        ausloeser = clip;
        saal.showModal();
      } else {
        const platz = document.createElement('div');
        platz.className = clip.className;
        platz.append(f);
        clip.replaceWith(platz);
        kachel = { platz, original: clip };
        f.focus({ preventScroll: true });
      }
    });
  });

  /* ── Google-Bewertungen: Das Elfsight-Skript lädt erst, wenn der Abschnitt in die Nähe kommt ── */
  // „Alle Google-Bewertungen ansehen“ öffnet die Gesamtansicht des Widgets (dieselbe wie hinter „Mehr lesen“).
  // Ist das Widget nicht geladen, bleibt es beim Link zum Google-Eintrag.
  const alleBewertungen = document.querySelector('[data-alle-bewertungen]');
  if (alleBewertungen) {
    alleBewertungen.addEventListener('click', (e) => {
      const oeffner = document.querySelector('[data-bewertungen] .es-text-shortener-control');
      if (!oeffner) return;
      e.preventDefault();
      oeffner.click();
    });
  }

  const bewertungen = document.querySelector('[data-bewertungen]');
  if (bewertungen) {
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const skript = document.createElement('script');
      skript.src = 'https://elfsightcdn.com/platform.js';
      skript.async = true;
      document.head.append(skript);
    }, { rootMargin: '800px 0px' }).observe(bewertungen);

    // Karten ohne Lücken stapeln: Jede Bewertung bekommt so viele Rasterzeilen (je 4 px), wie sie hoch ist,
    // plus 20 px Abstand. Neue Karten kommen, die höchste zuerst, in die jeweils kürzeste Spalte –
    // so enden die Spalten etwa auf gleicher Höhe. Spaltenzahl und Breiten bleiben die des Widgets („mauer“ im CSS).
    if ('ResizeObserver' in window) {
      let geplant = false;
      const ordne = () => {
        geplant = false;
        const gitter = bewertungen.querySelector('.es-grid-layout');
        if (!gitter) return;
        bewertungen.classList.add('mauer');
        const karten = [...gitter.children];
        const spalten = getComputedStyle(gitter).gridTemplateColumns.split(' ').length;
        if (gitter.dataset.spalten !== String(spalten)) {
          gitter.dataset.spalten = spalten;
          karten.forEach((k) => delete k.dataset.spalte);
        }
        const zeilen = new Map(karten.map((k) => [k, Math.ceil((k.getBoundingClientRect().height + 20) / 4)]));
        const summe = new Array(spalten).fill(0);
        karten.forEach((k) => { if (k.dataset.spalte) summe[k.dataset.spalte] += zeilen.get(k); });
        karten.filter((k) => !k.dataset.spalte).sort((a, b) => zeilen.get(b) - zeilen.get(a)).forEach((k) => {
          const s = summe.indexOf(Math.min(...summe));
          k.dataset.spalte = s;
          summe[s] += zeilen.get(k);
        });
        const frei = new Array(spalten).fill(1);
        karten.forEach((k) => {
          const s = Number(k.dataset.spalte);
          k.style.gridColumn = s + 1;
          k.style.gridRow = `${frei[s]} / span ${zeilen.get(k)}`;
          frei[s] += zeilen.get(k);
          if (!k.dataset.gemessen) { k.dataset.gemessen = '1'; groesse.observe(k); }
        });
      };
      const plane = () => { if (!geplant) { geplant = true; requestAnimationFrame(ordne); } };
      const groesse = new ResizeObserver(plane);
      new MutationObserver(plane).observe(bewertungen, { childList: true, subtree: true });
      addEventListener('resize', plane);
    }
  }

  /* ── Einflug der Kundenstimmen: abwechselnd von links und rechts ── */
  if (!ruhig) {
    const flieger = [...document.querySelectorAll('.mosaik > li')];
    const io = new IntersectionObserver((eintraege) => {
      eintraege.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('da'); io.unobserve(e.target); } });
    }, { threshold: 0.15 });
    flieger.forEach((li, i) => {
      li.classList.add('flug');
      li.style.setProperty('--von', i % 2 ? '2.5rem' : '-2.5rem');
      li.style.setProperty('--i', i % 4);
      io.observe(li);
    });
  }

  /* ── Garantie-Stempel: wird aufgedrückt, sobald er beim ersten Herunterscrollen gut zu sehen ist ── */
  const stempel = document.querySelector('.stempel');
  if (stempel && !ruhig) {
    stempel.classList.add('wartet');
    new IntersectionObserver(([e], io) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      stempel.classList.replace('wartet', 'drauf');
    }, { threshold: 0.7 }).observe(stempel);
  }

  /* ── Navigation: aktiven Abschnitt markieren ── */
  const links = [...document.querySelectorAll('.nav a[href^="#"]')];
  const gehoertZu = { hochformat: 'filme' }; // Abschnitte ohne eigenen Menüpunkt
  const abschnitte = [...document.querySelectorAll('main > section')];
  if (links.length && abschnitte.length) {
    const io = new IntersectionObserver((eintraege) => {
      eintraege.forEach((e) => {
        if (!e.isIntersecting) return;
        const id = gehoertZu[e.target.id] || e.target.id;
        links.forEach((a) => {
          if (a.getAttribute('href') === `#${id}`) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    abschnitte.forEach((a) => io.observe(a));
  }

  /* ── Menü auf schmalen Bildschirmen ── */
  const kopf = document.querySelector('.kopf');
  const menue = document.querySelector('.menue');
  if (kopf && menue) {
    const setze = (offen) => {
      kopf.toggleAttribute('data-offen', offen);
      menue.setAttribute('aria-expanded', String(offen));
    };
    menue.addEventListener('click', () => setze(!kopf.hasAttribute('data-offen')));
    kopf.querySelectorAll('.nav a').forEach((a) => a.addEventListener('click', () => setze(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && kopf.hasAttribute('data-offen')) { setze(false); menue.focus(); }
    });
    document.addEventListener('click', (e) => { if (!kopf.contains(e.target)) setze(false); });
  }

  /* ── Weiches Scrollen erst nach dem ersten Aufbau: Deep-Links springen sofort ans Ziel ── */
  if (!ruhig) {
    const weich = () => setTimeout(() => document.documentElement.classList.add('weich'), 400);
    if (document.readyState === 'complete') weich();
    else addEventListener('load', weich, { once: true });
  }

  /* ── Telefonnummer: kopieren und Kontaktkarte am Anrufen-Knopf ── */
  const NUMMER = '+49 176 80506850';
  const kopiere = async (knopf) => {
    try {
      await navigator.clipboard.writeText(NUMMER);
    } catch {
      // ohne Zwischenablage-Schnittstelle: über ein verstecktes Textfeld
      const feld = document.createElement('textarea');
      feld.value = NUMMER; feld.setAttribute('readonly', ''); feld.style.cssText = 'position:fixed;opacity:0';
      knopf.after(feld); feld.select();
      try { document.execCommand('copy'); } finally { feld.remove(); }
    }
    const vorher = knopf.dataset.text || (knopf.dataset.text = knopf.textContent);
    knopf.textContent = 'Nummer kopiert';
    clearTimeout(knopf.zurueck);
    knopf.zurueck = setTimeout(() => { knopf.textContent = vorher; }, 2200);
  };
  document.querySelectorAll('[data-kopiere]').forEach((k) => { k.hidden = false; });
  document.addEventListener('click', (e) => {
    const knopf = e.target.closest('[data-kopiere]');
    if (knopf) kopiere(knopf);
  });

  // Mit der Maus öffnet „Anrufen“ eine kleine Karte: Nummer, kopieren, WhatsApp, E-Mail.
  // Auf Geräten mit Fingerbedienung bleibt es beim direkten Anruf.
  const ruf = document.querySelector('.kopf__ruf');
  if (ruf && 'showPopover' in HTMLElement.prototype && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const karte = document.createElement('div');
    karte.className = 'rufkarte';
    karte.popover = 'auto';
    karte.setAttribute('aria-label', 'Kontakt aufnehmen');
    karte.innerHTML = '<p class="rufkarte__zeile">Rufen Sie mich einfach an</p>'
      + '<a class="rufkarte__nummer" href="tel:+4917680506850">0176 805 068 50</a>'
      + '<button class="btn btn--kompakt" type="button" data-kopiere>Nummer kopieren</button>'
      + '<p class="rufkarte__wege"><a href="https://wa.me/4917680506850">WhatsApp schreiben</a>'
      + '<a href="mailto:mail@bettervideos.de?subject=Anfrage%20Filmproduktion">E-Mail schreiben</a></p>';
    document.body.append(karte);
    ruf.setAttribute('aria-haspopup', 'dialog');
    // Ein Klick außerhalb schließt die Karte von selbst. Damit der Knopf sie dann nicht sofort wieder öffnet,
    // merkt sich pointerdown, ob sie offen war.
    let warOffen = false;
    ruf.addEventListener('pointerdown', () => { warOffen = karte.matches(':popover-open'); });
    ruf.addEventListener('click', (e) => {
      e.preventDefault();
      if (warOffen) { warOffen = false; if (karte.matches(':popover-open')) karte.hidePopover(); return; }
      const r = ruf.getBoundingClientRect();
      karte.style.top = `${r.bottom + 10}px`;
      karte.style.right = `${Math.max(16, document.documentElement.clientWidth - r.right)}px`;
      karte.showPopover();
    });
  }

  // „Kennenlerngespräch buchen“: Erst der Klick öffnet den Dialog – vorher geht nichts an Google.
  // Mit data-buchen-api (Adresse des Apps-Script, siehe apps-script/buchung.gs) läuft die Buchung
  // in drei Schritten im eigenen Design: Tag, Uhrzeit, Angaben. Ohne die Adresse zeigt der Dialog
  // die Buchungsseite von Google im Rahmen. Ohne <dialog> bleibt es beim Link in einem neuen Tab.
  const buchen = document.querySelector('[data-buchen]');
  if (buchen && typeof HTMLDialogElement === 'function') {
    let buchung = null;
    buchen.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      if (!buchung) {
        const api = buchen.dataset.buchenApi;
        buchung = api ? baueTermin(api) : baueRahmen(buchen.href);
        document.body.append(buchung);
        buchung.addEventListener('click', (ev) => { if (ev.target === buchung) buchung.close(); });
      }
      buchung.showModal();
      if (buchung.los) buchung.los();
    });
  }

  function baueRahmen(adresse) {
    const d = document.createElement('dialog');
    d.className = 'raster buchung';
    d.setAttribute('aria-label', 'Kennenlerngespräch buchen');
    d.innerHTML = '<div class="raster__kopf"><h2>Kennenlerngespräch buchen</h2><form method="dialog"><button class="raster__zu">Schließen</button></form></div>';
    const rahmen = document.createElement('iframe');
    rahmen.className = 'buchung__rahmen';
    rahmen.title = 'Terminbuchung über Google Kalender';
    rahmen.src = adresse + '?gv=true';
    d.append(rahmen);
    return d;
  }

  function baueTermin(api) {
    const d = document.createElement('dialog');
    d.className = 'raster buchung termin';
    d.setAttribute('aria-label', 'Kennenlerngespräch buchen');
    d.innerHTML = '<div class="raster__kopf"><p class="termin__schritt" aria-live="polite"></p><form method="dialog"><button class="raster__zu">Schließen</button></form></div><div class="termin__inhalt"></div>';
    const schritt = d.querySelector('.termin__schritt');
    const inhalt = d.querySelector('.termin__inhalt');
    const stand = { tage: null, tag: null, zeit: null, gebucht: false, angaben: {} };

    const el = (art, klasse, text) => {
      const e = document.createElement(art);
      if (klasse) e.className = klasse;
      if (text != null) e.textContent = text;
      return e;
    };
    const datum = (iso) => { const [j, m, t] = iso.split('-').map(Number); return new Date(j, m - 1, t); };
    const wochentag = (iso) => datum(iso).toLocaleDateString('de-DE', { weekday: 'long' });
    const lang = (iso) => datum(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
    const kurz = (iso) => datum(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'short' }).replace(/\.$/, '');

    function zeige(nr, titel, teile) {
      schritt.innerHTML = '';
      if (nr) {
        for (let i = 1; i <= 3; i++) schritt.append(el('i', i <= nr ? 'an' : ''));
        schritt.append(el('span', '', `Schritt ${nr} von 3`));
      }
      const h = el('h2', 'termin__titel', titel);
      h.tabIndex = -1;
      inhalt.replaceChildren(h, ...teile);
      inhalt.scrollTop = 0;
      h.focus({ preventScroll: true });
    }

    function wahl(text, zurueck) {
      const p = el('p', 'termin__wahl');
      p.append(el('span', '', text));
      const b = el('button', '', 'ändern');
      b.type = 'button';
      b.addEventListener('click', zurueck);
      p.append(b);
      return p;
    }

    function hinweis(text) {
      const p = el('p', 'termin__hinweis', text + ' Sie erreichen mich auch direkt: ');
      const a = el('a', '', '0176 805 068 50');
      a.href = 'tel:+4917680506850';
      p.append(a, '.');
      return p;
    }

    async function lade() {
      zeige(0, 'Einen Moment …', [el('p', 'termin__text', 'Ich schaue in meinen Kalender.')]);
      try {
        const r = await fetch(api, { redirect: 'follow' });
        const j = await r.json();
        stand.tage = (j.tage || []).filter((t) => t.zeiten && t.zeiten.length).slice(0, 5);
        tagWahl();
      } catch (err) {
        zeige(0, 'Das hat leider nicht geklappt.', [hinweis('Der Kalender ist gerade nicht erreichbar.')]);
      }
    }

    function tagWahl(meldung) {
      if (!stand.tage.length) {
        zeige(0, 'In den nächsten Tagen ist alles belegt.', [hinweis('Rufen Sie mich einfach an, dann finden wir einen Termin.')]);
        return;
      }
      const liste = el('div', 'termin__tage');
      stand.tage.forEach((t) => {
        const b = el('button', 'termin__tag');
        b.type = 'button';
        b.append(el('span', '', wochentag(t.datum)), el('b', '', kurz(t.datum)));
        if (stand.tag === t) b.setAttribute('aria-pressed', 'true');
        b.addEventListener('click', () => { stand.tag = t; stand.zeit = null; zeitWahl(); });
        liste.append(b);
      });
      const teile = [el('p', 'termin__text', 'Ein erstes Gespräch am Telefon, unverbindlich, etwa 30 Minuten.'), liste];
      if (meldung) teile.unshift(el('p', 'termin__meldung', meldung));
      zeige(1, 'Welcher Tag passt Ihnen?', teile);
    }

    function zeitWahl() {
      const gruppen = [['Mittags', 0, 15], ['Nachmittags', 15, 19], ['Abends', 19, 24]];
      const raster = el('div', 'termin__zeiten');
      gruppen.forEach(([name, von, bis]) => {
        const zeiten = stand.tag.zeiten.filter((z) => { const h = parseInt(z, 10); return h >= von && h < bis; });
        if (!zeiten.length) return;
        raster.append(el('p', 'termin__gruppe', name));
        const reihe = el('div', 'termin__reihe');
        zeiten.forEach((z) => {
          const b = el('button', 'termin__zeit', z);
          b.type = 'button';
          b.setAttribute('aria-label', z + ' Uhr');
          if (stand.zeit === z) b.setAttribute('aria-pressed', 'true');
          b.addEventListener('click', () => { stand.zeit = z; angaben(); });
          reihe.append(b);
        });
        raster.append(reihe);
      });
      zeige(2, 'Um wie viel Uhr passt es Ihnen?', [wahl(lang(stand.tag.datum), () => tagWahl()), raster]);
    }

    function angaben(meldung) {
      const f = el('form', 'termin__form');
      f.noValidate = false;
      const feld = (name, text, art, pflicht, auto) => {
        const l = el('label', 'termin__feld');
        l.append(el('span', '', text + (pflicht ? '' : ' (wenn Sie mögen)')));
        const i = art === 'textarea' ? el('textarea') : el('input');
        if (art !== 'textarea') i.type = art; else i.rows = 3;
        i.name = name; i.required = pflicht; if (auto) i.autocomplete = auto;
        i.value = stand.angaben[name] || '';
        i.addEventListener('input', () => { stand.angaben[name] = i.value; });
        l.append(i);
        return l;
      };
      const falle = el('input', 'termin__falle'); falle.name = 'website'; falle.tabIndex = -1; falle.autocomplete = 'off'; falle.setAttribute('aria-hidden', 'true');
      const recht = el('p', 'termin__recht', 'Ihre Angaben nutze ich nur für diesen Termin. Mehr dazu in der ');
      const ds = el('a', '', 'Datenschutzerklärung'); ds.href = 'datenschutz.html'; ds.target = '_blank'; ds.rel = 'noopener';
      recht.append(ds, '.');
      const ab = el('button', 'btn', 'Termin buchen'); ab.type = 'submit';
      f.append(
        feld('name', 'Ihr Name', 'text', true, 'name'),
        feld('telefon', 'Telefonnummer, unter der ich Sie anrufe', 'tel', true, 'tel'),
        feld('email', 'E-Mail für die Terminbestätigung', 'email', true, 'email'),
        feld('nachricht', 'Worum geht es?', 'textarea', false),
        falle, recht, ab);
      f.addEventListener('submit', async (e) => {
        e.preventDefault();
        ab.disabled = true; ab.textContent = 'Wird gebucht …';
        const daten = Object.fromEntries(new FormData(f));
        daten.datum = stand.tag.datum; daten.zeit = stand.zeit;
        try {
          const r = await fetch(api, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(daten) });
          const j = await r.json();
          if (j.ok) { stand.gebucht = true; fertig(daten.email); return; }
          if (j.grund === 'vergeben' && j.tage) {
            stand.tage = j.tage.filter((t) => t.zeiten && t.zeiten.length).slice(0, 5);
            stand.tag = null; stand.zeit = null;
            tagWahl('Dieser Termin wurde gerade vergeben. Bitte wählen Sie einen anderen.');
            return;
          }
          angaben(j.grund === 'eingabe' ? 'Bitte prüfen Sie Ihre Angaben.' : 'Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal oder rufen Sie mich an: 0176 805 068 50.');
        } catch (err) {
          angaben('Das hat leider nicht geklappt. Bitte versuchen Sie es noch einmal oder rufen Sie mich an: 0176 805 068 50.');
        }
      });
      const teile = [wahl(`${lang(stand.tag.datum)}, ${stand.zeit} Uhr`, zeitWahl), f];
      if (meldung) teile.unshift(el('p', 'termin__meldung', meldung));
      zeige(3, 'Wie erreiche ich Sie?', teile);
    }

    function fertig(email) {
      const zu = el('button', 'btn btn--linie', 'Schließen'); zu.type = 'button';
      zu.addEventListener('click', () => d.close());
      zeige(0, 'Der Termin steht.', [
        el('p', 'termin__gross', `${lang(stand.tag.datum)}, ${stand.zeit} Uhr`),
        el('p', 'termin__text', `Ich rufe Sie an. Die Bestätigung mit Kalendereintrag geht an ${email}.`),
        el('p', 'termin__text termin__gruss', 'Ich freue mich auf das Gespräch!'),
        zu]);
    }

    // Beim Öffnen: frisch laden, außer man steckt mitten in der Auswahl.
    d.los = () => {
      if (stand.gebucht) { stand.gebucht = false; stand.tag = null; stand.zeit = null; stand.tage = null; }
      if (!stand.tage) lade();
    };
    return d;
  }

  const jahr = document.querySelector('[data-jahr]');
  if (jahr) jahr.textContent = new Date().getFullYear();
})();
