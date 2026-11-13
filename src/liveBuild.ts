import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Scroll-driven live build, element by element.
 *
 * Every real element on the page (headings, paragraphs, cards, chips) is its own blueprint:
 *  - a ghost pointer drag-selects the element's area (a marquee with a live size readout),
 *  - then the content appears inside the selection: text is typed out slowly, cards fill in
 *  - small chips just pop in
 * Progress is a pure function of scroll position (never a timer), only moves forward, and finishes
 * before an element reaches mid-screen, so whatever you are reading is always fully built.
 */

const FRONT = 0.88; // build front, fraction of viewport height
const SEL = {
  text: ".section-head h2, .about-lead, #about p:not([class]), .contact-title, .contact-lede, .toolbox-section-lede",
  card: ".photo-card, .exp-card, .research-main, .metric-box, .proj-card, .toolbox-card, .timeline-card, .contact-action-card",
  chip: ".section-tag, .tab-buttons > *, .research-actions > *",
};

type Kind = "text" | "card" | "chip";
type Item = {
  kind: Kind;
  el: HTMLElement;
  p: number;
  dy: number; // current vertical offset we applied (so the natural top can be recovered)
  band: number;
  delay: number;
  started: boolean;
  done: boolean;
  nodes?: { n: Text; full: string }[];
  total?: number;
  kids?: HTMLElement[];
  lbl?: HTMLElement;
  marq?: HTMLElement;
  typeEls?: { el: HTMLElement; nodes: { n: Text; full: string }[]; total: number }[];
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pascal = (s: string) => s.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase());

const SELECT_END = 0.38; // fraction of an element's progress spent drag-selecting its area
const TYPE_SEL = "h3, h4, p"; // text inside cards that gets typed in once the card is selected

export function useLiveBuild() {
  const cleanup = useRef<() => void>();
  const readyRef = useRef(false); // set once the splash loader is done
  const kickRef = useRef<(() => void) | null>(null);

  const start = useCallback(() => {
    cleanup.current?.();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cleanup.current = undefined;
      return;
    }

    const root = document.querySelector("main");
    if (!root) return;
    const scope = (sel: string) => Array.from(root.querySelectorAll<HTMLElement>(sel)).filter((e) => !e.closest(".hero"));
    const inCard = (e: Element) => !!e.closest(SEL.card);

    const items: Item[] = [];
    const seen = new Set<HTMLElement>();
    const add = (el: HTMLElement, kind: Kind, extra: Partial<Item> = {}) => {
      if (seen.has(el)) return;
      seen.add(el);
      items.push({ kind, el, p: 0, dy: 0, band: 160, delay: 0, started: false, done: false, ...extra });
    };

    scope(SEL.card).forEach((el) => {
      const sibs = el.parentElement ? Array.from(el.parentElement.children) : [el];
      const idx = sibs.indexOf(el);
      add(el, "card", { band: clamp(el.offsetHeight * 0.9, 340, 520), delay: (idx % 3) * 150 });
    });
    scope(SEL.text).forEach((el) => !inCard(el) && add(el, "text", { band: 260 }));
    scope(SEL.chip).forEach((el) => !inCard(el) && add(el, "chip", { band: 120 }));

    // document order, so the HUD can always show the "latest" element
    items.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

    // ── initial blueprint state ────────────────────────────────
    items.forEach((it) => {
      it.el.removeAttribute("data-reveal");
      it.el.querySelectorAll("[data-reveal]").forEach((n) => n.removeAttribute("data-reveal"));
      if (it.kind === "text") {
        const w = document.createTreeWalker(it.el, NodeFilter.SHOW_TEXT);
        const nodes: { n: Text; full: string }[] = [];
        let n: Node | null;
        while ((n = w.nextNode())) nodes.push({ n: n as Text, full: (n as Text).nodeValue ?? "" });
        it.nodes = nodes;
        it.total = nodes.reduce((s, x) => s + x.full.length, 0);
        it.el.classList.add("lb-ghost-text");
      } else if (it.kind === "card") {
        it.kids = Array.from(it.el.children) as HTMLElement[];
        // text inside the card is typed in later; lock each block's height so the layout never shifts
        it.typeEls = Array.from(it.el.querySelectorAll<HTMLElement>(TYPE_SEL))
          .filter((t) => !t.classList.contains("lb-lbl"))
          .map((t) => {
            const w = document.createTreeWalker(t, NodeFilter.SHOW_TEXT);
            const nodes: { n: Text; full: string }[] = [];
            let n: Node | null;
            while ((n = w.nextNode())) nodes.push({ n: n as Text, full: (n as Text).nodeValue ?? "" });
            t.style.minHeight = `${t.offsetHeight}px`;
            return { el: t, nodes, total: nodes.reduce((acc, x) => acc + x.full.length, 0) };
          });
        it.kids.forEach((k) => (k.style.opacity = "0"));
        const lbl = document.createElement("span");
        lbl.className = "lb-lbl";
        const cls = (it.el.className.split(/\s+/).find((c) => /card|box|main|sidebar/.test(c)) || "card").trim();
        lbl.textContent = `<${pascal(cls)} />`;
        it.el.appendChild(lbl);
        it.lbl = lbl;
        it.el.classList.add("lb-wire");
        it.el.style.transition = "none";
      } else {
        it.el.style.transition = "none";
        it.el.style.opacity = "0";
        it.el.style.transform = "scale(0.7)";
      }
    });

    // ── cursor + HUD ───────────────────────────────────────────
    const cursor = document.createElement("div");
    cursor.className = "lb-cursor";
    cursor.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 3L11.5 21L14.5 13.5L22 10.5L4 3Z" fill="#f59e0b" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg><span>select</span>`;
    cursor.style.opacity = "0";
    const hud = document.createElement("div");
    hud.className = "lb-hud";
    hud.innerHTML = `
      <div class="top"><span class="dot"></span><span class="sec">assembling portfolio…</span><span class="cnt">0/${items.length}</span><button type="button" class="skip">skip ›</button></div>
      <div class="line"></div>
      <div class="bar"><div></div></div>`;
    document.body.append(cursor, hud);
    const secEl = hud.querySelector<HTMLElement>(".sec")!;
    const cntEl = hud.querySelector<HTMLElement>(".cnt")!;
    const lineEl = hud.querySelector<HTMLElement>(".line")!;
    const barEl = hud.querySelector<HTMLElement>(".bar div")!;
    const skipBtn = hud.querySelector<HTMLElement>(".skip")!;

    // ── finishing an element: put the DOM back exactly as React rendered it ──
    const restore = (it: Item) => {
      const el = it.el;
      if (it.kind === "text") {
        it.nodes?.forEach((x) => (x.n.nodeValue = x.full));
        el.classList.remove("lb-ghost-text", "lb-typing");
        el.style.minHeight = "";
      } else if (it.kind === "card") {
        it.kids?.forEach((k) => {
          k.style.opacity = "";
          k.style.transform = "";
        });
        it.lbl?.remove();
        it.typeEls?.forEach((t) => {
          t.nodes.forEach((x) => (x.n.nodeValue = x.full));
          t.el.style.minHeight = "";
        });
        el.classList.remove("lb-wire", "lb-held");
        el.style.transition = "";
        el.style.transform = "";
        el.style.opacity = "";
      } else {
        el.style.transition = "";
        el.style.opacity = "";
        el.style.transform = "";
      }
      it.marq?.remove();
      it.marq = undefined;
      el.classList.remove("lb-sel");
      it.dy = 0;
    };

    // ── per-frame update ──────────────────────────────────────
    let raf = 0;
    let dirty = true;
    let done = 0;
    let lastHud = "";
    let finished = false;
    let force = false; // finish every remaining element at once
    let bandScale = 1; // >1 while on autopilot: each element builds over a longer stretch so it can be seen
    let outTimer: number | undefined;
    const mark = () => (dirty = true);
    window.addEventListener("scroll", mark, { passive: true });
    window.addEventListener("resize", mark);
    const poke = window.setInterval(mark, 350); // layout can shift as fonts/images load
    document.fonts?.ready.then(mark);

    const typeInto = (nodes: { n: Text; full: string }[], total: number, q: number) => {
      let remaining = Math.floor(clamp(q, 0, 1) * total);
      nodes.forEach((x) => {
        const take = Math.min(remaining, x.full.length);
        x.n.nodeValue = x.full.slice(0, take);
        remaining -= take;
      });
    };

    const apply = (it: Item, p: number) => {
      const el = it.el;
      if (it.kind === "text") {
        if (p < SELECT_END) return; // still being selected: the shimmering placeholder stays
        if (!it.started) {
          it.started = true;
          el.style.minHeight = `${el.offsetHeight}px`; // measured while the full text is still in place
          el.classList.remove("lb-ghost-text");
          el.classList.add("lb-typing");
        }
        typeInto(it.nodes!, it.total ?? 0, (p - SELECT_END) / (1 - SELECT_END));
      } else if (it.kind === "card") {
        if (p < 0.5) return; // wireframe stays while the pointer selects the area
        if (el.classList.contains("lb-wire")) {
          el.classList.remove("lb-wire", "lb-held");
          it.lbl?.remove();
          el.style.transition = "background-color .5s, border-color .5s, box-shadow .5s";
        }
        const f = (p - 0.5) / 0.5;
        const kids = it.kids!;
        kids.forEach((k, i) => {
          k.style.opacity = String(clamp(f * 5 - i * 0.35, 0, 1));
        });
        it.typeEls!.forEach((t) => typeInto(t.nodes, t.total, (f - 0.15) / 0.8));
      } else {
        const t = easeOut(p);
        el.style.opacity = String(t);
        el.style.transform = `scale(${0.7 + 0.3 * t})`;
      }
    };

    // the drag-selection marquee that "draws" an element's area before its content appears
    const marquee = (it: Item, r: DOMRect, p: number) => {
      if (it.kind === "chip") return;
      if (p >= 0.58) {
        if (it.marq) {
          it.marq.remove();
          it.marq = undefined;
          it.el.classList.remove("lb-sel");
        }
        return;
      }
      if (!it.marq) {
        const m = document.createElement("div");
        m.className = "lb-marq";
        m.innerHTML = '<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><span class="tg"></span><span class="dm"></span>';
        document.body.appendChild(m);
        it.marq = m;
        it.el.classList.add("lb-sel"); // the marquee tag replaces the in-card label
        const tag = it.kind === "card" ? it.lbl?.textContent : `<${it.el.tagName.toLowerCase()}>`;
        m.querySelector<HTMLElement>(".tg")!.textContent = tag ?? "";
      }
      const sel = easeInOut(clamp(p / SELECT_END, 0, 1));
      const w = r.width * sel;
      const h = r.height * sel;
      const m = it.marq;
      m.style.transform = `translate3d(${r.left}px, ${r.top}px, 0)`;
      m.style.width = `${w}px`;
      m.style.height = `${h}px`;
      m.style.opacity = String(p < 0.46 ? 1 : 1 - (p - 0.46) / 0.12);
      m.classList.toggle("set", p >= SELECT_END);
      m.querySelector<HTMLElement>(".dm")!.textContent = `${Math.round(w)} × ${Math.round(h)}`;
    };

    const describe = (it: Item) => {
      const tag = it.el.tagName.toLowerCase();
      if (it.kind === "text") {
        const s = (it.el.textContent ?? "").slice(-34);
        return `<span class="lb-t">&lt;${tag}&gt;</span>${esc(s)}<span class="lb-caret"></span>`;
      }
      if (it.kind === "card") {
        const cls = it.el.className.split(/\s+/).find((c) => /card|box|main|sidebar/.test(c) && !c.startsWith("lb-")) || "card";
        const title = it.kids?.map((k) => k.querySelector("h3,h4,.proj-title,.exp-role") ?? (/^H\d$/.test(k.tagName) ? k : null)).find(Boolean)?.textContent?.slice(0, 26);
        return `<span class="lb-m">&lt;${pascal(cls)}</span>${title ? ` <span class="lb-k">title</span>=<span class="lb-s">"${esc(title)}"</span>` : ""} <span class="lb-m">/&gt;</span>`;
      }
      return `<span class="lb-m">&lt;Chip</span> <span class="lb-m">/&gt;</span>`;
    };

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!dirty || finished) return;
      dirty = false;
      const vh = window.innerHeight;
      const front = vh * FRONT;

      // read phase
      const pending = items.filter((i) => !i.done);
      const rects = pending.map((i) => i.el.getBoundingClientRect());

      // write phase
      let current: Item | null = null;
      let drag: { it: Item; r: DOMRect; sel: number } | null = null;
      pending.forEach((it, k) => {
        const r = rects[k];
        const natural = r.top;
        // skip anything far below the front that has not started
        if (!force && natural > front + 120 && it.p === 0) return;
        // on phones the page is much taller, so cap how long one element stays mid-build
        const eff = window.innerWidth < 768 ? Math.min(it.band * bandScale, vh * 0.85) : it.band * bandScale;
        const p = force ? 1 : clamp((front - natural - it.delay) / eff, 0, 1);
        if (p > it.p) it.p = p;
        if (it.p >= 1) {
          restore(it);
          it.done = true;
          done += 1;
          return;
        }
        if (it.p > 0) {
          apply(it, it.p);
          marquee(it, r, it.p);
          current = it;
          if (it.kind !== "chip" && it.p < SELECT_END + 0.06 && (!drag || it.p > drag.it.p)) drag = { it, r, sel: easeInOut(clamp(it.p / SELECT_END, 0, 1)) };
        }
      });

      // ghost cursor rides the card currently being dragged
      if (drag) {
        const { r, sel } = drag as { it: Item; r: DOMRect; sel: number };
        // the pointer sits on the marquee's moving bottom-right corner
        const cx = clamp(r.left + r.width * sel, 12, window.innerWidth - 60);
        const cy = clamp(r.top + r.height * sel, 76, window.innerHeight - 40);
        cursor.style.opacity = "1";
        cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      } else cursor.style.opacity = "0";

      // HUD
      const cur = current as Item | null;
      if (cur) {
        const sec = cur.el.closest("section")?.id ?? "";
        const name = sec ? pascal(sec === "top" ? "hero" : sec) : "Page";
        const html = describe(cur);
        const key = `${name}|${done}|${html}`;
        if (key !== lastHud) {
          lastHud = key;
          secEl.textContent = `<${name} />`;
          cntEl.textContent = `${done}/${items.length}`;
          lineEl.innerHTML = html;
          barEl.style.width = `${(done / items.length) * 100}%`;
          hud.classList.remove("idle", "out");
        }
      }
      if (done >= items.length && !finished) {
        finished = true;
        cursor.style.opacity = "0";
        secEl.textContent = "✔ build complete";
        lineEl.innerHTML = `<span class="lb-c">// ${items.length} nodes built. over to you.</span>`;
        cntEl.textContent = `${items.length}/${items.length}`;
        barEl.style.width = "100%";
        hud.classList.add("ok");
        outTimer = window.setTimeout(() => hud.classList.add("out"), 2400);
      }
    };
    raf = requestAnimationFrame(tick);
    lineEl.innerHTML = `<span class="lb-c">// the page builds itself, then it's yours</span>`;
    hud.classList.add("idle");

    // ── autopilot: the page builds itself first, then hands control to the visitor ──
    let auto = false;
    let autoRaf = 0;
    let backRaf = 0;
    let lastY = 0;
    const INPUTS = ["wheel", "touchstart", "keydown", "pointerdown"] as const;
    const onInput = () => stopAuto(false);
    const stopAuto = (goTop: boolean) => {
      if (!auto) return;
      auto = false;
      cancelAnimationFrame(autoRaf);
      INPUTS.forEach((e) => window.removeEventListener(e, onInput));
      bandScale = 1;
      force = true;
      dirty = true;
      skipBtn.style.display = "none";
      if (goTop) {
        const from = window.scrollY;
        const t0 = performance.now();
        const stopBack = () => cancelAnimationFrame(backRaf);
        window.addEventListener("wheel", stopBack, { once: true, passive: true });
        window.addEventListener("touchstart", stopBack, { once: true, passive: true });
        const step = (now: number) => {
          const k = clamp((now - t0) / 1500, 0, 1);
          const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
          window.scrollTo({ top: from * (1 - e), behavior: "instant" as ScrollBehavior });
          if (k < 1) backRaf = requestAnimationFrame(step);
        };
        backRaf = requestAnimationFrame(step);
      }
    };
    skipBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      stopAuto(false);
    });
    let startTimer: number | undefined;
    const runAuto = () => {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
      auto = true;
      bandScale = 2.6;
      INPUTS.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
      // slow enough to watch each selection and the typing; faster on tall (phone) pages so the whole
      // build still takes roughly 18 seconds
      const VMAX = clamp((document.documentElement.scrollHeight - window.innerHeight) / 18, 520, 1100);
      const RAMP = 0.7; // seconds to speed up / slow down
      const t0 = performance.now();
      lastY = window.scrollY;
      const frame = (now: number) => {
        if (!auto) return;
        const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const T = maxY / VMAX + RAMP;
        const t = (now - t0) / 1000;
        let y: number;
        if (t < RAMP) y = (VMAX * t * t) / (2 * RAMP);
        else if (t < T - RAMP) y = (VMAX * RAMP) / 2 + VMAX * (t - RAMP);
        else y = maxY - (VMAX * Math.pow(Math.max(0, T - t), 2)) / (2 * RAMP);
        if (Math.abs(window.scrollY - lastY) > 40) return stopAuto(false); // visitor grabbed the scrollbar
        window.scrollTo({ top: Math.min(y, maxY), behavior: "instant" as ScrollBehavior });
        lastY = window.scrollY;
        dirty = true;
        if (t >= T) return stopAuto(true);
        autoRaf = requestAnimationFrame(frame);
      };
      autoRaf = requestAnimationFrame(frame);
    };
    const kick = () => (startTimer = window.setTimeout(runAuto, 500));
    if (readyRef.current) kick();
    else kickRef.current = kick; // wait for the splash loader to finish

    cleanup.current = () => {
      cancelAnimationFrame(raf);
      window.clearInterval(poke);
      window.clearTimeout(outTimer);
      window.clearTimeout(startTimer);
      kickRef.current = null;
      cancelAnimationFrame(autoRaf);
      cancelAnimationFrame(backRaf);
      INPUTS.forEach((e) => window.removeEventListener(e, onInput));
      window.removeEventListener("scroll", mark);
      window.removeEventListener("resize", mark);
      items.forEach((it) => !it.done && restore(it));
      cursor.remove();
      hud.remove();
    };
  }, []);

  useLayoutEffect(() => {
    start();
    return () => cleanup.current?.();
  }, [start]);

  const replay = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
    start();
  }, [start]);

  // called by the splash loader when it has faded out: let the autopilot start
  const begin = useCallback(() => {
    readyRef.current = true;
    kickRef.current?.();
    kickRef.current = null;
  }, []);

  return { replay, begin };
}
