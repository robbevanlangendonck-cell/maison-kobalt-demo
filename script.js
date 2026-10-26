/* ==========================================================================
   BOEKING: het enige blok dat je aanpast.
   Online boeken staat aan via Salonized: reserveren.html laadt widgetUrl in
   een iframe in de sectie #boeking.
   - systeem: null zet online boeken uit (dan toont de pagina een bel- en
     mailboodschap).
   - fallbackUrl: adres dat in een nieuw tabblad opent als de agenda niet
     binnen 14 seconden laadt. Leeg = dezelfde widgetUrl.
   ========================================================================== */
const BOEKING = {
  systeem: "salonized",
  locaties: {
    mechelen: {
      naam: "Mechelen",
      widgetUrl: "https://proef-bedrijf.salonized.com/widget_bookings/new",
      fallbackUrl: "https://proef-bedrijf.salonized.com/widget_bookings/new",
      tel: "+32 15 00 00 00"
    }
  }
};

/* ==========================================================================
   Maison Kobalt Barbers · script.js
   ========================================================================== */
(() => {
  "use strict";

  const AGENDA_TIMEOUT_MS = 14000;
  // Alleen https-adressen op deze domeinen (of subdomeinen) komen in de iframe.
  const TOEGESTANE_HOSTS = ["salonized.com"];

  const html = document.documentElement;
  const heeftEigen = (obj, sleutel) => Object.prototype.hasOwnProperty.call(obj, sleutel);

  /* ------------------------------------------------------------------------
     Header: krijgt een achtergrond zodra je scrolt (startpagina)
     ------------------------------------------------------------------------ */
  const header = document.querySelector("[data-header]");
  if (header) {
    const updateHeader = () => header.classList.toggle("is-gescrold", window.scrollY > 24);
    window.addEventListener("scroll", updateHeader, { passive: true });
    updateHeader();
  }

  /* ------------------------------------------------------------------------
     Mobiel menu
     ------------------------------------------------------------------------ */
  const menuKnop = document.querySelector("[data-menuknop]");
  const nav = document.getElementById("hoofdmenu");
  if (menuKnop && nav) {
    const menuLabel = menuKnop.querySelector("[data-menulabel]");
    const achtergrond = document.querySelectorAll("main, footer");

    const zetMenu = (open) => {
      menuKnop.setAttribute("aria-expanded", String(open));
      html.classList.toggle("menu-open", open);
      achtergrond.forEach((el) => { el.inert = open; });
      if (menuLabel) menuLabel.textContent = open ? "Menu sluiten" : "Menu openen";
    };

    menuKnop.addEventListener("click", () => {
      const open = menuKnop.getAttribute("aria-expanded") !== "true";
      zetMenu(open);
      if (open) nav.querySelector("a")?.focus();
    });

    nav.addEventListener("click", (e) => {
      if (e.target.closest("a")) zetMenu(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && html.classList.contains("menu-open")) {
        zetMenu(false);
        menuKnop.focus();
      }
    });

    window.matchMedia("(min-width: 960px)").addEventListener("change", (e) => {
      if (e.matches) zetMenu(false);
    });
  }

  /* ------------------------------------------------------------------------
     Rustige fade-up bij scrollen
     ------------------------------------------------------------------------ */
  const teOnthullen = document.querySelectorAll(".onthul");
  const minderBeweging = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window && !minderBeweging) {
    const io = new IntersectionObserver((items) => {
      items.forEach((item) => {
        if (!item.isIntersecting) return;
        item.target.classList.add("is-zichtbaar");
        io.unobserve(item.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });
    teOnthullen.forEach((el) => io.observe(el));
  } else {
    teOnthullen.forEach((el) => el.classList.add("is-zichtbaar"));
  }

  /* ------------------------------------------------------------------------
     Jaartal in de footer
     ------------------------------------------------------------------------ */
  document.querySelectorAll("[data-jaar]").forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });

  /* ------------------------------------------------------------------------
     Openingsuren: dag van vandaag + "nu open" (tijd in Brussel)
     De uren zelf staan in de tabel (data-open / data-sluit).
     ------------------------------------------------------------------------ */
  const urenTabel = document.querySelector("[data-uren]");
  if (urenTabel) {
    const DAGEN = ["zondag", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag"];
    const naarMinuten = (t) => { const [u, m] = t.split(":").map(Number); return u * 60 + m; };
    const uurTekst = (t) => { const [u, m] = t.split(":").map(Number); return m ? `${u}u${String(m).padStart(2, "0")}` : `${u}u`; };

    const nuInBrussel = () => {
      try {
        const delen = new Intl.DateTimeFormat("en-GB", {
          timeZone: "Europe/Brussels", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
        }).formatToParts(new Date());
        const deel = (type) => delen.find((d) => d.type === type)?.value;
        const dag = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(deel("weekday"));
        if (dag < 0) throw new Error("onbekende dag");
        return { dag, min: Number(deel("hour")) * 60 + Number(deel("minute")) };
      } catch {
        const d = new Date();
        return { dag: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
      }
    };

    const rooster = {};
    urenTabel.querySelectorAll("tr[data-dag]").forEach((rij) => {
      rooster[rij.dataset.dag] = { rij, open: rij.dataset.open, sluit: rij.dataset.sluit };
    });

    const nu = nuInBrussel();
    const vandaag = rooster[nu.dag];
    if (vandaag) {
      vandaag.rij.classList.add("is-vandaag");
      const tag = document.createElement("span");
      tag.className = "vandaag-tag";
      tag.textContent = "vandaag";
      vandaag.rij.querySelector("th")?.append(tag);
    }

    const status = document.querySelector("[data-open-status]");
    if (status) {
      let tekst = "";
      let open = false;
      if (vandaag?.open && nu.min >= naarMinuten(vandaag.open) && nu.min < naarMinuten(vandaag.sluit)) {
        open = true;
        tekst = `Nu open, tot ${uurTekst(vandaag.sluit)}`;
      } else if (vandaag?.open && nu.min < naarMinuten(vandaag.open)) {
        tekst = `Nu gesloten, vandaag open vanaf ${uurTekst(vandaag.open)}`;
      } else {
        for (let i = 1; i <= 7; i++) {
          const dag = (nu.dag + i) % 7;
          if (rooster[dag]?.open) {
            tekst = `Nu gesloten, weer open ${i === 1 ? "morgen" : DAGEN[dag]} om ${uurTekst(rooster[dag].open)}`;
            break;
          }
        }
      }
      if (tekst) {
        status.textContent = tekst;
        status.classList.toggle("is-open", open);
        status.hidden = false;
      }
    }
  }

  /* ------------------------------------------------------------------------
     Reserveren: Salonized-agenda in een iframe (alleen op reserveren.html)
     ------------------------------------------------------------------------ */
  const widget = document.getElementById("boeking-widget");
  if (widget) {
    let agendaTimer = 0;
    let huidige = null;

    const telHref = (tel) => "tel:" + String(tel || "").replace(/[^\d+]/g, "");

    // Geeft een veilige https-URL terug, of null.
    const veiligeUrl = (waarde) => {
      if (typeof waarde !== "string" || !waarde.trim()) return null;
      try {
        const url = new URL(waarde.trim());
        const host = url.hostname.toLowerCase();
        const toegestaan = TOEGESTANE_HOSTS.some((h) => host === h || host.endsWith("." + h));
        return url.protocol === "https:" && toegestaan ? url.href : null;
      } catch {
        return null;
      }
    };

    const sjabloon = (id, loc, agendaUrl) => {
      const fragment = document.getElementById(id).content.cloneNode(true);
      if (loc?.tel) {
        fragment.querySelectorAll("[data-tel]").forEach((a) => {
          a.href = telHref(loc.tel);
          const tekst = a.querySelector("[data-tel-tekst]");
          if (tekst) tekst.textContent = `Bel ${loc.tel}`;
        });
      }
      const agendaLink = fragment.querySelector("[data-agenda-link]");
      if (agendaLink && agendaUrl) agendaLink.href = agendaUrl;
      return fragment;
    };

    const toon = (fragment) => {
      widget.classList.remove("is-laden");
      widget.replaceChildren(fragment);
    };

    const laadAgenda = (sleutel) => {
      const loc = BOEKING.locaties[sleutel];
      window.clearTimeout(agendaTimer);

      // Nog niet geconfigureerd: nette tijdelijke boodschap
      if (BOEKING.systeem !== "salonized" || !loc || !String(loc.widgetUrl || "").trim()) {
        toon(sjabloon("tpl-binnenkort", loc));
        return;
      }

      const widgetUrl = veiligeUrl(loc.widgetUrl);
      if (!widgetUrl) {
        console.warn(`[BOEKING] widgetUrl voor "${sleutel}" moet een https-adres op ${TOEGESTANE_HOSTS.join(", ")} zijn.`);
        toon(sjabloon("tpl-binnenkort", loc));
        return;
      }
      const reserveUrl = veiligeUrl(loc.fallbackUrl) || widgetUrl;

      const frame = document.createElement("iframe");
      frame.className = "boeking-frame";
      frame.title = `Online reserveren bij Maison Kobalt Barbers, vestiging ${loc.naam}`;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      frame.src = widgetUrl; // src vóór het invoegen, zodat 'load' maar één keer vuurt

      frame.addEventListener("load", () => {
        window.clearTimeout(agendaTimer);
        widget.classList.remove("is-laden");
        widget.querySelector(".boeking-laden")?.remove();
        frame.classList.add("is-zichtbaar");
      }, { once: true });

      agendaTimer = window.setTimeout(() => {
        toon(sjabloon("tpl-fout", loc, reserveUrl));
      }, AGENDA_TIMEOUT_MS);

      widget.classList.add("is-laden");
      widget.replaceChildren(sjabloon("tpl-laden", loc), frame);
    };

    const kaarten = document.querySelectorAll("[data-loc]");
    const kiesVestiging = (sleutel) => {
      if (sleutel === huidige) return;
      huidige = sleutel;
      kaarten.forEach((kaart) => {
        if (kaart.dataset.loc === sleutel) kaart.setAttribute("aria-current", "true");
        else kaart.removeAttribute("aria-current");
      });
      laadAgenda(sleutel);
    };

    kaarten.forEach((kaart) => {
      kaart.addEventListener("click", (e) => {
        const sleutel = kaart.dataset.loc;
        if (!heeftEigen(BOEKING.locaties, sleutel)) return;
        e.preventDefault();
        const url = new URL(window.location.href);
        url.searchParams.set("loc", sleutel);
        url.hash = "boeking";
        history.replaceState(null, "", url);
        kiesVestiging(sleutel);
      });
    });

    // ?loc=<sleutel> kiest de vestiging; onbekende waarden worden genegeerd.
    const gevraagd = new URLSearchParams(window.location.search).get("loc");
    const sleutels = Object.keys(BOEKING.locaties);
    kiesVestiging(gevraagd && heeftEigen(BOEKING.locaties, gevraagd) ? gevraagd : sleutels[0]);
  }
})();
