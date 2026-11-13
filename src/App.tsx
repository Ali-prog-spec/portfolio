import { Suspense, lazy, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { EMAIL, GITHUB, LINKEDIN, PHONE, projects, skills, timeline, type Cat } from "./data";

import HeroModel from "./components/HeroModel";
import { useLiveBuild } from "./liveBuild";
import Loader from "./components/Loader";
import WaveBackground from "./components/WaveBackground";

export type ThemeMode = "gold" | "silver" | "violet";

function useTypewriter(words: string[], speed = 75, pause = 1600) {
  const [index, setIndex] = useState(0);
  const [subIndex, setSubIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (subIndex === words[index].length + 1 && !isDeleting) {
      const timeout = setTimeout(() => setIsDeleting(true), pause);
      return () => clearTimeout(timeout);
    }

    if (subIndex === 0 && isDeleting) {
      setIsDeleting(false);
      setIndex((prev) => (prev + 1) % words.length);
      return;
    }

    const timeout = setTimeout(() => {
      setSubIndex((prev) => prev + (isDeleting ? -1 : 1));
    }, isDeleting ? speed / 2 : speed);

    return () => clearTimeout(timeout);
  }, [subIndex, index, isDeleting, words, speed, pause]);

  return words[index].substring(0, subIndex);
}

const NAV = [
  { id: "top", label: "Home" },
  { id: "about", label: "About" },
  { id: "research", label: "Research" },
  { id: "projects", label: "Projects" },
  { id: "toolbox", label: "Toolbox" },
  { id: "journey", label: "Journey" },
  { id: "contact", label: "Contact" },
];

function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function CustomCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dot = dotRef.current;
    const ring = ringRef.current;
    if (!dot || !ring) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
    };

    let rafId: number;
    const loop = () => {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      rafId = requestAnimationFrame(loop);
    };

    window.addEventListener("mousemove", onMove);
    loop();

    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div className="custom-cursor-container" aria-hidden="true">
      <div ref={dotRef} className="cursor-dot" />
      <div ref={ringRef} className="cursor-ring" />
    </div>
  );
}

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obj = { v: 0 };
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      gsap.to(obj, {
        v: to,
        duration: 1.8,
        ease: "power3.out",
        onUpdate: () => {
          if (el) el.textContent = Math.round(obj.v) + suffix;
        },
      });
      io.disconnect();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [to, suffix]);
  return <span ref={ref}>0{suffix}</span>;
}

function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`nav ${scrolled ? "scrolled" : ""}`}>
      <div className="nav-inner">
        <a href="#top" className="logo">
          <span className="logo-badge">MA</span>
          <span className="logo-name">
            Muhammad Ali<span className="dot">.</span>
          </span>
        </a>

        <nav className={`nav-menu ${open ? "open" : ""}`}>
          {NAV.map((n) => (
            <a key={n.id} href={`#${n.id}`} onClick={() => setOpen(false)}>
              {n.label}
            </a>
          ))}
          <a
            href="#contact"
            className="nav-cta-btn"
            onClick={() => setOpen(false)}
          >
            Let's Talk
          </a>
        </nav>

        <button
          className="burger"
          aria-label="Toggle navigation"
          onClick={() => setOpen(!open)}
        >
          <span className={`bar ${open ? "bar-1-open" : ""}`} />
          <span className={`bar ${open ? "bar-2-open" : ""}`} />
        </button>
      </div>
    </header>
  );
}

function Hero() {
  const root = useRef<HTMLDivElement>(null);
  const roles = [
    "Full-Stack Developer",
    "AI Systems Researcher",
    "KV-Cache & Attention Kernels",
    "Security Protocol Tinkerer",
  ];
  const typedRole = useTypewriter(roles, 70, 1800);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".hero-line", {
        yPercent: 120,
        opacity: 0,
        stagger: 0.15,
        duration: 1.1,
        ease: "power4.out",
        delay: 0.1,
      });
      gsap.from(".hero-fade", {
        y: 25,
        opacity: 0,
        stagger: 0.12,
        duration: 0.9,
        ease: "power3.out",
        delay: 0.5,
      });
      gsap.from(".hero-3d-card", {
        scale: 0.94,
        opacity: 0,
        duration: 1.3,
        ease: "power3.out",
        delay: 0.25,
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="top" className="hero" ref={root}>
      <div className="hero-copy">
        <h1 className="hero-title">
          <span className="mask">
            <span className="hero-line">Hi, I'm</span>
          </span>
          <span className="mask">
            <span className="hero-line grad">Muhammad Ali</span>
          </span>
        </h1>

        <div className="role-ticker hero-fade">
          <span className="role-prefix">const role = </span>
          <span className="role-typing-word">"{typedRole}"</span>
          <span className="typing-cursor">|</span>
        </div>

        <p className="lede hero-fade">
          I build full-stack products, deep learning systems, and low-level architectures from
          scratch: <b>KV-cache greedy decoding</b>, speculative attention kernels on 6&nbsp;GB
          GPUs, and the exploits that stress-test cryptographic protocols.
        </p>

        <div className="hero-stats hero-fade">
          <div className="hstat-item">
            <strong><Counter to={18} suffix="+" /></strong>
            <span>Public Repos</span>
          </div>
          <div className="hstat-divider" />
          <div className="hstat-item">
            <strong><Counter to={1.5} suffix="B" /></strong>
            <span>LoRA Qwen Served</span>
          </div>
          <div className="hstat-divider" />
          <div className="hstat-item">
            <strong><Counter to={5} /></strong>
            <span>Protocol Exploits</span>
          </div>
          <div className="hstat-divider" />
          <div className="hstat-item">
            <strong><Counter to={4} /></strong>
            <span>GenAI Models in 1 App</span>
          </div>
        </div>

        <div className="cta hero-fade">
          <a className="btn primary glow" href="#projects">
            <span>Explore My Work</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </a>
          <a className="btn glass" href="#contact">
            <span>Get In Touch</span>
          </a>
          <a
            className="btn icon-only"
            href={GITHUB}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub Profile"
            title="GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
            </svg>
          </a>
          <a
            className="btn icon-only"
            href={LINKEDIN}
            target="_blank"
            rel="noreferrer"
            aria-label="LinkedIn Profile"
            title="LinkedIn"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
            </svg>
          </a>
        </div>
      </div>

      <div className="hero-3d-card">
        <div className="hero-3d-header">
          <div className="window-dots">
            <span className="dot-red" />
            <span className="dot-yellow" />
            <span className="dot-green" />
          </div>
          <span className="window-title">Muhammad Ali · Live Portrait</span>
          <span className="window-tag">Eyes follow you</span>
        </div>

        <div className="hero-3d-stage">
          <HeroModel />
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section id="about" className="section">
      <div className="section-head" data-reveal>
        <div className="section-tag">
          <span>01</span>
          <i>/</i>
          <span>IDENTITY &amp; FOUNDATION</span>
        </div>
        <h2>Engineering at the Edge of Systems &amp; AI</h2>
      </div>

      <div className="about-grid">
        <div className="photo-card" data-reveal>
          <div className="photo-inner">
            <img src="/ali_cutout.png" alt="Muhammad Ali" className="photo-img" />
            <div className="photo-badge">
              <span className="verified-check">✓</span>
              <span>Muhammad Ali</span>
            </div>
            <div className="photo-meta">
              <p className="photo-title">Full-Stack Engineer &amp; Researcher</p>
              <p className="photo-loc">Islamabad, Pakistan · FAST-NUCES</p>
            </div>
          </div>
        </div>

        <div className="about-content" data-reveal>
          <h3 className="about-lead">
            Final-year Computer Science student at <b>FAST-NUCES Islamabad</b> who loves
            building systems from first principles.
          </h3>

          <p>
            Whether it's designing and benchmarking clinical-trial eligibility matching systems with
            LoRA-tuned <b>Qwen2.5</b> on a strict 6&nbsp;GB GPU budget, engineering voice-first apps with
            Groq Whisper, or dissecting a toy smart-lock protocol step-by-step with five custom exploits,
            I thrive in the intersection of systems efficiency, intelligent architectures, and elegant interfaces.
          </p>

          <p>
            Alongside my studies, I work as a <b>Full-Stack Engineer at K2 Studio</b>, where I started
            as an intern and moved into a part-time engineering role. Before that, I completed an ML, app and agentic
            internship at <b>Ishraq Labs</b>.
          </p>

          <div className="highlight-chips">
            <span className="chip">✦ KV-Cache &amp; Speculative Decoding</span>
            <span className="chip">✦ Full-Stack Web (React / Next.js)</span>
            <span className="chip">✦ PyTorch &amp; Mixture-of-Experts</span>
            <span className="chip">✦ Protocol Cryptography &amp; Hardening</span>
            <span className="chip">✦ 3D Graphics &amp; Three.js</span>
          </div>

          <div className="experience-cards">
            <div className="exp-card">
              <span className="exp-role">Full-Stack Engineer</span>
              <span className="exp-company">K2 Studio</span>
              <span className="exp-time">Nov 2026 – Present</span>
            </div>
            <div className="exp-card">
              <span className="exp-role">Software Intern</span>
              <span className="exp-company">K2 Studio</span>
              <span className="exp-time">Aug 2026 – Oct 2026</span>
            </div>
            <div className="exp-card">
              <span className="exp-role">ML / App / Agentic Intern</span>
              <span className="exp-company">Ishraq Labs</span>
              <span className="exp-time">Feb 2026 – Apr 2026</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Research() {
  const p = projects[0];
  const [activeTab, setActiveTab] = useState<"overview" | "kernel">("overview");

  return (
    <section id="research" className="section research-section">
      <div className="section-head" data-reveal>
        <div className="section-tag">
          <span>02</span>
          <i>/</i>
          <span>FEATURED RESEARCH</span>
        </div>
        <h2>TrialMatch-KV: Low-Resource Clinical LLM Systems</h2>
      </div>

      <div className="research-grid" data-reveal>
        <div className="research-main">
          <div className="research-badges">
            <span className="tag-featured">Spotlight Research</span>
            <span className="tag-year">2026 · Systems + AI</span>
          </div>

          <h3>{p.title}</h3>
          <p className="research-blurb">{p.blurb}</p>

          <div className="tab-buttons">
            <button
              className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => setActiveTab("overview")}
            >
              System Innovations
            </button>
            <button
              className={`tab-btn ${activeTab === "kernel" ? "active" : ""}`}
              onClick={() => setActiveTab("kernel")}
            >
              Decoding Kernel Peek
            </button>
          </div>

          {activeTab === "overview" ? (
            <ul className="points-list">
              {p.points.map((pt) => (
                <li key={pt}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="code-terminal">
              <div className="code-head">
                <span className="terminal-dot red" />
                <span className="terminal-dot yellow" />
                <span className="terminal-dot green" />
                <span className="terminal-title">speculative_decode_kv.py (Greedy Rollback)</span>
              </div>
              <pre className="code-body">
{`# Greedy Speculative Decoding with Hand-Written KV Cache Rollback
# Benchmarked on 6 GB RTX 2060 by Muhammad Ali

def speculative_step(target_model, draft_model, kv_cache, prompt_tokens, K=3):
    # 1. Draft K speculative tokens using lightweight draft model
    draft_tokens, draft_kvs = draft_model.generate_draft(prompt_tokens, K)
    
    # 2. Run target model verification in a single forward pass
    target_logits = target_model.verify(draft_tokens, kv_cache)
    
    # 3. Accept/reject tokens; rollback KV-cache state on rejection
    accepted = []
    for k in range(K):
        if target_logits[k].argmax() == draft_tokens[k]:
            accepted.append(draft_tokens[k])
        else:
            # Rejection: rollback target KV-cache to verified prefix length
            kv_cache.rollback(len(prompt_tokens) + len(accepted))
            accepted.append(target_logits[k].argmax())
            break
    return accepted`}
              </pre>
            </div>
          )}

          <div className="tags-row">
            {p.stack.map((s) => (
              <span key={s} className="tag-pill">{s}</span>
            ))}
          </div>

          <div className="research-actions">
            <a href={p.repo} target="_blank" rel="noreferrer" className="btn primary glow">
              <span>Inspect Code on GitHub</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 17L17 7M17 7H7M17 7V17" />
              </svg>
            </a>
          </div>
        </div>

        <div className="research-metrics-sidebar">
          <div className="metric-box">
            <span className="metric-num">1.5B</span>
            <span className="metric-label">Qwen2.5 Base Architecture</span>
            <p className="metric-desc">LoRA fine-tuned on patient-grouped TrialGPT criteria</p>
          </div>

          <div className="metric-box">
            <span className="metric-num">6 GB</span>
            <span className="metric-label">RTX 2060 Hardware Budget</span>
            <p className="metric-desc">Zero external inference cloud needed; pure local execution</p>
          </div>

          <div className="metric-box">
            <span className="metric-num">3x</span>
            <span className="metric-label">Decoding Loops Hand-Written</span>
            <p className="metric-desc">No-cache baseline, KV-cache greedy, and speculative decoding</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Projects() {
  const [filter, setFilter] = useState<"All" | Cat>("All");
  const kinds: ("All" | Cat)[] = ["All", "AI", "Web", "Security", "Systems"];

  const list = projects.filter((p) => filter === "All" || p.cat.includes(filter));

  return (
    <section id="projects" className="section">
      <div className="section-head" data-reveal>
        <div className="section-tag">
          <span>03</span>
          <i>/</i>
          <span>PROJECT PORTFOLIO</span>
        </div>
        <h2>Engineered Systems, AI Applications &amp; Security</h2>
      </div>

      <div className="filters-bar" data-reveal>
        {kinds.map((k) => (
          <button
            key={k}
            className={`filter-btn ${k === filter ? "active" : ""}`}
            onClick={() => setFilter(k)}
          >
            {k}
          </button>
        ))}
      </div>

      <div className="projects-grid">
        {list.map((p) => (
          <article key={p.title} className="proj-card" data-reveal>
            <div className="proj-header">
              <span className="proj-kind">{p.kind}</span>
              <span className="proj-year">{p.team ?? p.year}</span>
            </div>

            <h3 className="proj-title">{p.title}</h3>
            <p className="proj-blurb">{p.blurb}</p>

            {p.points.length > 0 && (
              <ul className="proj-points">
                {p.points.slice(0, 2).map((pt) => (
                  <li key={pt}>✦ {pt}</li>
                ))}
              </ul>
            )}

            <div className="proj-stack">
              {p.stack.map((s) => (
                <span key={s} className="stack-pill">{s}</span>
              ))}
            </div>

            <div className="proj-footer">
              <a href={p.repo} target="_blank" rel="noreferrer" className="proj-link github">
                <span>GitHub Repository</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17L17 7M17 7H7M17 7V17" />
                </svg>
              </a>
              {p.live && (
                <a href={p.live} target="_blank" rel="noreferrer" className="proj-link live">
                  <span>{p.liveLabel ?? "Live Demo"}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M7 17L17 7M17 7H7M17 7V17" />
                  </svg>
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Toolbox() {
  return (
    <section id="toolbox" className="section">
      <div className="section-head" data-reveal>
        <div className="section-tag">
          <span>04</span>
          <i>/</i>
          <span>TECHNICAL ARSENAL</span>
        </div>
        <h2>Languages, Frameworks &amp; Deep Systems</h2>
      </div>

      <div className="skill-marquee" aria-hidden="true">
        {[0, 1].map((row) => {
          const all = skills.flatMap((g) => g.items);
          const list = row ? [...all].reverse() : all;
          return (
            <div key={row} className={`skill-track ${row ? "rev" : ""}`}>
              {[...list, ...list].map((s, i) => (
                <span key={i} className="skill-tick">
                  <i />
                  {s}
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div className="toolbox-grid">
        {skills.map((group, gi) => (
          <div
            key={group.group}
            className={`toolbox-card tb-${gi}`}
            data-reveal
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
              e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
            }}
          >
            <div className="tb-head">
              <span className="tb-idx">{String(gi + 1).padStart(2, "0")}</span>
              <h4 className="group-title">{group.group}</h4>
              <span className="tb-count">{group.items.length}</span>
            </div>
            <div className="skills-pill-grid">
              {group.items.map((item, ii) => (
                <div key={item} className="skill-chip" style={{ animationDelay: `${ii * 0.35}s` }}>
                  <span className="skill-dot" />
                  <span className="skill-name">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Journey() {
  return (
    <section id="journey" className="section">
      <div className="section-head" data-reveal>
        <div className="section-tag">
          <span>05</span>
          <i>/</i>
          <span>TIMELINE</span>
        </div>
        <h2>Experience &amp; Academic Milestones</h2>
      </div>

      <div className="timeline-container">
        {timeline.map((t) => (
          <div key={t.title} className="timeline-item" data-reveal>
            <div className="timeline-marker">
              <span className="marker-ring" />
              <span className="marker-dot" />
            </div>
            <div className="timeline-card">
              <span className="timeline-date">{t.when}</span>
              <h3 className="timeline-title">{t.title}</h3>
              <span className="timeline-org">{t.org}</span>
              {t.points.length > 0 && (
                <ul className="timeline-points">
                  {t.points.map((pt) => (
                    <li key={pt}>{pt}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Contact() {
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  const copyEmail = () => {
    navigator.clipboard.writeText(EMAIL);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2400);
  };

  const copyPhone = () => {
    navigator.clipboard.writeText(PHONE.replace(/\s/g, ""));
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2400);
  };

  return (
    <section id="contact" className="section contact-section">
      <div className="contact-box" data-reveal>
        <div className="section-tag centered">
          <span>06</span>
          <i>/</i>
          <span>GET IN TOUCH</span>
        </div>

        <h2 className="contact-title">Let's Build Something Impactful</h2>
        <p className="contact-lede">
          I'm actively open to full-stack engineering roles, AI/ML research collaborations,
          and high-performance system builds. Reach out directly:
        </p>

        <div className="contact-cards-row">
          <div className="contact-action-card" onClick={copyEmail} role="button" tabIndex={0}>
            <div className="c-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M22 6L12 13L2 6" />
              </svg>
            </div>
            <div className="c-info">
              <span className="c-label">Direct Email</span>
              <strong className="c-val">{EMAIL}</strong>
            </div>
            <span className="c-badge">{copiedEmail ? "Copied!" : "Click to Copy"}</span>
          </div>

          <div className="contact-action-card" onClick={copyPhone} role="button" tabIndex={0}>
            <div className="c-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </div>
            <div className="c-info">
              <span className="c-label">Direct Phone / WhatsApp</span>
              <strong className="c-val">{PHONE}</strong>
            </div>
            <span className="c-badge">{copiedPhone ? "Copied!" : "Click to Copy"}</span>
          </div>
        </div>

        <div className="contact-socials-row">
          <a href={GITHUB} target="_blank" rel="noreferrer" className="btn glass">
            <span>github.com/Ali-prog-spec</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </a>
          <a href={LINKEDIN} target="_blank" rel="noreferrer" className="btn glass">
            <span>linkedin.com/in/muhammad-ali</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

export default function App() {
  useReveal();
  const build = useLiveBuild();
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="portfolio-app theme-gold">
      {!loaded && (
        <Loader
          onDone={() => {
            (window as unknown as { __splashDone?: boolean }).__splashDone = true;
            window.dispatchEvent(new Event("splash-done"));
            setLoaded(true);
            build.begin();
          }}
        />
      )}
      <CustomCursor />
      <div className="bg-canvas" aria-hidden="true" />
      <WaveBackground />
      <Nav />
      <main>
        <Hero />
        <About />
        <Research />
        <Projects />
        <Toolbox />
        <Journey />
        <Contact />
      </main>
      <footer className="footer">
        <div className="footer-inner">
          <p>© {new Date().getFullYear()} Muhammad Ali. All rights reserved.</p>
          <button
            type="button"
            className="replay-build-btn"
            onClick={build.replay}
            title="Replay Live Building Animation"
          >
            <span>▶ Replay Live Build</span>
          </button>
          <p className="footer-sub">
            Engineered with React 18, Three.js, React Three Fiber &amp; GSAP.
          </p>
        </div>
      </footer>
    </div>
  );
}
