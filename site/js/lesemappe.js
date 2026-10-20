// Lesemappe: alles, was sich auf den Seiten bewegt. Ohne JavaScript bleibt jede Seite lesbar.
// Fortschritt liegt nur im Browser (localStorage) und darf jederzeit fehlen.

const speicher = {
  lesen(schluessel) {
    try { return JSON.parse(localStorage.getItem(schluessel)) ?? {}; } catch { return {}; }
  },
  schreiben(schluessel, wert) {
    try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* privates Fenster */ }
  },
};

// ── Stimme: liest Wörter und Sätze vor (nie einzelne Buchstaben: die Stimme sagt „em“ statt „mmm“) ──
const stimme = (() => {
  const ss = "speechSynthesis" in window ? window.speechSynthesis : null;
  let deutsch = null;
  const waehlen = () => {
    const alle = ss ? ss.getVoices() : [];
    // Stimmen auf dem Gerät zuerst: Online-Stimmen (z. B. „Google Deutsch“) schicken den Text an den Hersteller
    const de = alle.filter((v) => v.lang?.startsWith("de"));
    deutsch = de.find((v) => v.localService && v.lang === "de-DE") || de.find((v) => v.localService) || de[0] || null;
    document.documentElement.classList.toggle("ohne-stimme", !deutsch);
  };
  if (ss) { waehlen(); ss.addEventListener?.("voiceschanged", waehlen); } else document.documentElement.classList.add("ohne-stimme");
  // Wörter, die die Stimme falsch liest: „Pommes“ französisch („Pomm“), „Mo.“ als Abkürzung für Montag
  const AUSSPRACHE = [[/\bPommes\b/g, "Pommess"], [/\bMo\b/g, "Moo"]];
  return (text) => {
    if (!ss || !deutsch || !text) return;
    ss.cancel();
    const u = new SpeechSynthesisUtterance(AUSSPRACHE.reduce((t, [muster, ersatz]) => t.replace(muster, ersatz), text));
    u.voice = deutsch; u.lang = deutsch.lang; u.rate = 0.8; u.pitch = 1.05;
    ss.speak(u);
  };
})();

// ── kleine Töne ──
let audio;
function ton(art) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const noten = { gut: [660, 880], fertig: [523, 659, 784, 1047], falsch: [220], tipp: [520] }[art];
    noten.forEach((f, i) => {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = art === "falsch" ? "triangle" : "sine";
      o.frequency.value = f;
      const t = audio.currentTime + i * 0.11;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (art === "fertig" ? 0.35 : 0.22));
      o.connect(g).connect(audio.destination);
      o.start(t); o.stop(t + 0.4);
    });
  } catch { /* kein Ton, auch gut */ }
}

const ruhig = matchMedia("(prefers-reduced-motion: reduce)").matches;
const pause = (ms) => new Promise((r) => setTimeout(r, ruhig ? Math.min(ms, 60) : ms));

function jubel(gross = true) {
  ton("fertig");
  const feld = document.createElement("div");
  feld.className = "jubel";
  feld.setAttribute("aria-hidden", "true");
  if (!ruhig) {
    for (let i = 0; i < 18; i++) {
      const s = document.createElement("img");
      s.src = `${window.LESEMAPPE_BASIS}img/${i % 3 ? "stern" : "herz"}.webp`;
      s.style.left = `${Math.random() * 96}%`;
      s.style.animationDelay = `${Math.random() * 0.5}s`;
      feld.append(s);
    }
  }
  if (gross) {
    const s = document.createElement("img");
    s.src = `${window.LESEMAPPE_BASIS}img/schrift-super.webp`;
    s.className = "super";
    feld.append(s);
  }
  document.body.append(feld);
  setTimeout(() => feld.remove(), 2300);
}

// ── Startseite: Name und Sterne ──
function startseite() {
  const hallo = document.querySelector("[data-hallo]");
  if (hallo) {
    const feld = hallo.querySelector("input");
    const knopf = hallo.querySelector("button");
    const zeigen = () => {
      const name = speicher.lesen("lesemappe:kind").name;
      hallo.querySelector("[data-gruss]").textContent = name ? `Hallo ${name}!` : "Hallo!";
      knopf.textContent = name ? "Name ändern" : "Name eintragen";
    };
    knopf.addEventListener("click", () => {
      if (feld.hidden) { feld.hidden = false; feld.value = speicher.lesen("lesemappe:kind").name ?? ""; feld.focus(); knopf.textContent = "Fertig"; return; }
      speicher.schreiben("lesemappe:kind", { name: feld.value.trim().slice(0, 30) });
      feld.hidden = true;
      zeigen();
    });
    feld.addEventListener("keydown", (e) => { if (e.key === "Enter") knopf.click(); });
    zeigen();
  }
  document.querySelectorAll("[data-sterne]").forEach((el) => {
    const tage = speicher.lesen(`lesemappe:${el.dataset.sterne}`).tage ?? [];
    el.querySelectorAll("img").forEach((img, i) => {
      img.src = img.src.replace(/stern(-leer)?\.webp/, i < tage.length ? "stern.webp" : "stern-leer.webp");
    });
  });
}

// ── Lektion ──
function lektion(seite) {
  const schluessel = `lesemappe:${seite.dataset.lektion}`;
  const stand = speicher.lesen(schluessel);
  const sichern = () => speicher.schreiben(schluessel, stand);
  const fertig = (teil, gross = true) => {
    if (!stand.fertig?.includes(teil)) {
      stand.fertig = [...(stand.fertig ?? []), teil];
      sichern();
      jubel(gross);
    }
    reiterMarkieren();
  };
  const reiterMarkieren = () => {
    document.querySelectorAll(".reiter a").forEach((a) => a.classList.toggle("fertig", !!stand.fertig?.includes(a.hash.slice(1))));
  };
  reiterMarkieren();

  // Reiter: der sichtbare Abschnitt ist hervorgehoben
  const beobachter = new IntersectionObserver((eintraege) => {
    for (const e of eintraege) {
      if (!e.isIntersecting) continue;
      document.querySelectorAll(".reiter a").forEach((a) => {
        const aktiv = a.hash === `#${e.target.id}`;
        a.classList.toggle("aktiv", aktiv);
        if (aktiv) a.scrollIntoView({ block: "nearest", inline: "nearest" });
      });
    }
  }, { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll(".abschnitt").forEach((a) => beobachter.observe(a));

  document.querySelectorAll("[data-sprich]").forEach((b) => b.addEventListener("click", () => stimme(b.dataset.sprich)));

  // Rutschen: die Kugel rutscht, jeder Laut leuchtet auf, solange man ihn dehnt
  document.querySelectorAll(".rutsche").forEach((r) => {
    const punkte = r.dataset.bahn.split(";").map((p) => p.split(",").map(Number));
    const kugel = r.querySelector(".kugel");
    const laute = [...r.querySelectorAll(".laut")];
    const ergebnis = r.querySelector(".ergebnis");
    const knopf = r.querySelector("button");
    let laeuft = false;
    knopf.addEventListener("click", async () => {
      if (laeuft) return;
      laeuft = true;
      ergebnis.style.visibility = "hidden";
      laute.forEach((l) => l.classList.remove("an"));
      kugel.style.opacity = 1;
      const dauer = 900 * laute.length;
      const start = performance.now();
      await new Promise((fertigGerutscht) => {
        const schritt = (jetzt) => {
          const t = Math.min(1, (jetzt - start) / (ruhig ? 1 : dauer));
          const f = t * (punkte.length - 1), i = Math.min(Math.floor(f), punkte.length - 2), u = f - i;
          kugel.style.left = `${punkte[i][0] + (punkte[i + 1][0] - punkte[i][0]) * u}%`;
          kugel.style.top = `${punkte[i][1] + (punkte[i + 1][1] - punkte[i][1]) * u}%`;
          laute.forEach((l) => l.classList.toggle("an", t >= Number(l.dataset.t) && t < Number(l.dataset.bis)));
          if (t < 1) requestAnimationFrame(schritt); else fertigGerutscht();
        };
        requestAnimationFrame(schritt);
      });
      laute.forEach((l) => l.classList.remove("an"));
      kugel.style.opacity = 0;
      ergebnis.style.visibility = "visible";
      ton("gut");
      stimme(r.dataset.wort);
      stand.rutschen = [...new Set([...(stand.rutschen ?? []), r.dataset.wort])];
      sichern();
      knopf.textContent = "Nochmal rutschen";
      laeuft = false;
      if (stand.rutschen.length >= document.querySelectorAll(".rutsche").length) fertig("rutschen", false);
    });
    ergebnis.style.visibility = stand.rutschen?.includes(r.dataset.wort) ? "visible" : "hidden";
  });

  // Herzsätze: Herz anmalen, wenn gelesen; Bild antippen = Satz hören
  const herzen = [...document.querySelectorAll(".herzsatz")];
  stand.herzen ??= [];
  herzen.forEach((h, i) => {
    const knopf = h.querySelector("[data-herz]");
    const malen = () => {
      const an = stand.herzen.includes(i);
      h.classList.toggle("gelesen", an);
      knopf.querySelector("img").src = `${window.LESEMAPPE_BASIS}img/${an ? "herz" : "herz-leer"}.webp`;
      knopf.setAttribute("aria-pressed", an);
    };
    knopf.addEventListener("click", () => {
      stand.herzen = stand.herzen.includes(i) ? stand.herzen.filter((x) => x !== i) : [...stand.herzen, i];
      sichern(); malen();
      if (stand.herzen.includes(i)) ton("gut");
      if (stand.herzen.length === herzen.length) fertig("herzen");
    });
    malen();
  });

  // Monsterreihen: abhaken
  const reihen = [...document.querySelectorAll(".monster-reihe")];
  stand.monster ??= [];
  reihen.forEach((r, i) => {
    const malen = () => { const an = stand.monster.includes(i); r.classList.toggle("gelesen", an); r.setAttribute("aria-pressed", an); r.querySelector(".haken").textContent = an ? "✓" : ""; };
    r.addEventListener("click", () => {
      stand.monster = stand.monster.includes(i) ? stand.monster.filter((x) => x !== i) : [...stand.monster, i];
      sichern(); malen();
      if (stand.monster.includes(i)) ton("gut");
      if (stand.monster.length === reihen.length) fertig("monster");
    });
    malen();
  });

  // Silbenflug: das Flugzeug landet auf einer Silbe, das Kind liest sie, dann der nächste Flug
  const flug = document.querySelector("[data-flug]");
  if (flug) {
    const ziel = Number(flug.dataset.flug);
    const felder = [...flug.querySelectorAll(".teppich button")];
    const flieger = flug.querySelector(".flieger");
    const rahmen = flug.querySelector(".teppich-rahmen");
    const zaehler = flug.querySelector(".flug-zaehler");
    const leiste = flug.querySelector(".flug-leiste span");
    const los = flug.querySelector("[data-los]");
    let n = 0, jetzt = -1, unterwegs = false;
    const anzeigen = () => { zaehler.textContent = `${n} von ${ziel} Flügen`; leiste.style.width = `${Math.min(100, (n / ziel) * 100)}%`; };
    const fliegen = async () => {
      if (unterwegs) return;
      unterwegs = true;
      if (jetzt >= 0) { felder[jetzt].classList.remove("ziel"); felder[jetzt].classList.add("war"); n++; anzeigen(); ton("tipp"); }
      if (n >= ziel) {
        flieger.style.transform = `translate(${rahmen.clientWidth}px, -80px)`;
        los.textContent = "Nochmal fliegen";
        jetzt = -1; unterwegs = false;
        stand.fluege = (stand.fluege ?? 0) + 1; sichern();
        fertig("flug");
        n = 0;
        return;
      }
      let neu;
      do { neu = Math.floor(Math.random() * felder.length); } while (neu === jetzt);
      jetzt = neu;
      const f = felder[neu];
      const x = f.offsetLeft + f.offsetWidth / 2 - 34, y = f.offsetTop - 50;
      flieger.style.transform = `translate(${x}px, ${y}px)`;
      const links = f.offsetLeft - rahmen.clientWidth / 2;
      rahmen.scrollTo({ left: links, behavior: ruhig ? "auto" : "smooth" });
      await pause(900);
      f.classList.add("ziel");
      los.textContent = "Gelesen! Weiter";
      unterwegs = false;
    };
    los.addEventListener("click", () => { if (n === 0 && jetzt < 0) felder.forEach((f) => f.classList.remove("war")); fliegen(); });
    felder.forEach((f, i) => f.addEventListener("click", () => { if (i === jetzt) fliegen(); }));
    anzeigen();
  }

  // Fragen zur Geschichte
  stand.fragen ??= [];
  const fragen = [...document.querySelectorAll(".frage")];
  fragen.forEach((fr, i) => {
    const buttons = [...fr.querySelectorAll(".antworten button")];
    const loesen = () => buttons.forEach((b) => b.classList.toggle("richtig", b.dataset.richtig === "ja"));
    if (stand.fragen.includes(i)) loesen();
    buttons.forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.richtig === "ja") {
        loesen(); ton("gut");
        if (!stand.fragen.includes(i)) { stand.fragen.push(i); sichern(); }
        if (stand.fragen.length === fragen.length) fertig("geschichte");
      } else {
        ton("falsch");
        b.classList.remove("falsch"); void b.offsetWidth; b.classList.add("falsch");
      }
    }));
  });

  // Wörter bauen: Steine in der richtigen Reihenfolge antippen
  const bau = document.querySelector("[data-bauen]");
  if (bau) {
    const woerter = JSON.parse(bau.dataset.bauen);
    const bild = bau.querySelector(".bild img");
    const plaetze = bau.querySelector(".plaetze");
    const steine = bau.querySelector(".steine");
    const weiterKnopf = bau.querySelector("[data-naechstes]");
    const zaehler = bau.querySelector(".bauen-zaehler");
    let w = 0;
    const mischen = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const zeigen = () => {
      const { wort, bild: b, extra } = woerter[w];
      bild.src = `${window.LESEMAPPE_BASIS}img/${b}.webp`;
      bild.alt = "";
      zaehler.textContent = `Wort ${w + 1} von ${woerter.length}`;
      weiterKnopf.hidden = true;
      plaetze.replaceChildren(...[...wort].map(() => document.createElement("span")));
      plaetze.setAttribute("aria-label", `${wort.length} Buchstaben`);
      let pos = 0;
      steine.replaceChildren(...mischen([...wort, extra]).map((ch) => {
        const s = document.createElement("button");
        s.type = "button";
        s.textContent = ch;
        s.addEventListener("click", () => {
          if (ch !== wort[pos]) { ton("falsch"); s.classList.remove("falsch"); void s.offsetWidth; s.classList.add("falsch"); return; }
          const platz = plaetze.children[pos];
          platz.textContent = ch; platz.classList.add("voll");
          s.classList.add("weg");
          pos++;
          ton("tipp");
          if (pos === wort.length) {
            ton("gut");
            stimme(wort);
            if (w < woerter.length - 1) weiterKnopf.hidden = false;
            else fertig("bauen");
          }
        });
        return s;
      }));
    };
    weiterKnopf.addEventListener("click", () => { w = (w + 1) % woerter.length; zeigen(); });
    zeigen();
  }

  // Lesetage: jeden Tag einen Stern (statt Unterschrift im Tagesfeld)
  stand.tage ??= [];
  const tage = [...document.querySelectorAll(".tage button")];
  tage.forEach((t, i) => {
    const malen = () => {
      const an = stand.tage.includes(i);
      t.classList.toggle("an", an);
      t.setAttribute("aria-pressed", an);
      t.querySelector("img").src = `${window.LESEMAPPE_BASIS}img/${an ? "stern" : "stern-leer"}.webp`;
    };
    t.addEventListener("click", () => {
      stand.tage = stand.tage.includes(i) ? stand.tage.filter((x) => x !== i) : [...stand.tage, i];
      sichern(); malen();
      if (stand.tage.includes(i)) jubel(stand.tage.length === tage.length);
    });
    malen();
  });
}

// Zurücksetzen (für Eltern): erst nachfragen, dann löschen und neu laden
document.querySelectorAll("[data-zuruecksetzen]").forEach((box) => {
  box.hidden = false;
  const frage = box.querySelector("[data-frage]"), sicher = box.querySelector("[data-sicher]");
  const zeigen = (fragen) => { frage.hidden = fragen; sicher.hidden = !fragen; };
  frage.addEventListener("click", () => { zeigen(true); box.querySelector("[data-nein]").focus(); });
  box.querySelector("[data-nein]").addEventListener("click", () => { zeigen(false); frage.focus(); });
  box.querySelector("[data-ja]").addEventListener("click", () => {
    try {
      const was = box.dataset.zuruecksetzen;
      const weg = Object.keys(localStorage).filter((k) => (was === "alles" ? k.startsWith("lesemappe:") : k === `lesemappe:${was}`));
      weg.forEach((k) => localStorage.removeItem(k));
    } catch { /* kein Speicher, nichts zu löschen */ }
    location.reload();
  });
});

const seite = document.querySelector("[data-lektion]");
if (seite) lektion(seite); else startseite();
