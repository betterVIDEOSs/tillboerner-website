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

  const jahr = document.querySelector('[data-jahr]');
  if (jahr) jahr.textContent = new Date().getFullYear();
})();
