export const GITHUB = "https://github.com/Ali-prog-spec";
export const LINKEDIN = "https://www.linkedin.com/in/muhammad-ali-7453b8324/";
export const EMAIL = "m.alenauman@gmail.com";
export const PHONE = "+92 311 7732344";

const repo = (n: string) => `${GITHUB}/${n}`;

export type Cat = "AI" | "Web" | "Mobile" | "Systems" | "Security";

export type Project = {
  title: string;
  kind: string;
  cat: Cat[];
  year: string;
  blurb: string;
  points: string[];
  stack: string[];
  repo: string;
  live?: string;
  liveLabel?: string;
  featured?: boolean;
  team?: string;
};

// Source of truth: github.com/Ali-prog-spec (repo READMEs and code), fetched Nov 2026.
export const projects: Project[] = [
  {
    title: "TrialMatch-KV",
    kind: "LLM Systems Research",
    cat: ["AI", "Systems"],
    year: "2026",
    blurb:
      "Evidence-grounded clinical-trial eligibility matching with a LoRA-fine-tuned Qwen2.5-1.5B, plus hand-written KV-cache decoding, tiled online-softmax attention and speculative decoding, wrapped in a browser app.",
    points: [
      "Own decoding loops: no-cache reference, KV-cache greedy, and greedy speculative decoding with cache rollback",
      "Tiled online-softmax attention validated against reference SDPA",
      "Criterion-level and evidence-level metrics on patient-grouped splits (TrialGPT annotations)",
      "Trained and benchmarked on a 6 GB RTX 2060; FastAPI app and IEEE-style paper included",
    ],
    stack: ["PyTorch", "LoRA", "Qwen2.5", "FastAPI", "Speculative Decoding"],
    repo: repo("TrialMatch-KV"),
    featured: true,
  },
  {
    title: "Restoration & Sketch Studio",
    kind: "Generative AI",
    cat: ["AI", "Web"],
    year: "2026",
    blurb:
      "Four generative systems trained, evaluated and deployed as one browser app: universal denoising autoencoder, hard-routed specialists, soft mixture-of-experts and a pix2pix face-to-sketch generator.",
    points: [
      "Optuna tuning for every task, every run tracked in MLflow",
      "Models exported to ONNX and checked against PyTorch",
      "FastAPI + React/Tailwind app in Docker Compose",
    ],
    stack: ["PyTorch", "pix2pix", "ONNX", "Optuna", "MLflow", "React", "Docker"],
    repo: repo("Restoration-Sketch-studio"),
    live: "https://youtu.be/f5fjrYPDRv8",
    liveLabel: "Demo video",
  },
  {
    title: "VoiceForm AI",
    kind: "Voice-first Forms",
    cat: ["AI", "Web"],
    year: "2026",
    blurb:
      "Speak your answer; it's transcribed, extracted by an AI that knows the question, auto-filled, then confirmed, edited or retried.",
    points: [
      "Groq Whisper speech-to-text and strict, zod-validated answer extraction",
      "Supabase Auth with RLS for creators; locked-down server-side respondent endpoints",
      "Audio capped at 10 MB and never stored",
    ],
    stack: ["Next.js", "TypeScript", "Supabase", "Groq", "Zod"],
    repo: repo("Voice-Form-AI"),
  },
  {
    title: "AI Mesh Studio",
    kind: "Image-to-3D Platform",
    cat: ["AI", "Web"],
    year: "2026",
    blurb:
      "A product layer around Stability AI's Stable Fast 3D: image-to-3D and text-to-3D, model history, exports and auth.",
    points: [
      "FastAPI backend, SQLite metadata and JWT auth",
      "React + Three.js dashboard with GLB/OBJ output management",
      "Prompt and mesh optimisation pipeline wrappers",
    ],
    stack: ["Python", "FastAPI", "React", "Three.js", "Stable Fast 3D"],
    repo: repo("stable-mesh-3d-enhanced"),
  },
  {
    title: "SmartLock: Break It, Then Build It",
    kind: "Security Engagement",
    cat: ["Security", "Systems"],
    year: "2026",
    blurb:
      "Attacked a toy smart-lock protocol stage by stage with working exploits, then designed and built a hardened v2.",
    points: [
      "Five exploits: downgrade, MITM, baby-step giant-step on a weak DH prime, two-time pad, replay",
      "v2: signed ephemeral 2048-bit DH, HKDF-SHA256, unique nonces, sequence-bound AEAD",
    ],
    stack: ["C++", "Cryptography", "TCP", "AEAD"],
    repo: repo("smartlock"),
  },
  {
    title: "PsycoSupport Cryptanalysis",
    kind: "Cryptanalysis",
    cat: ["Security"],
    year: "2026",
    blurb:
      "Broke the affine-cipher wrapper of a client/server chat app from captured traffic using Al-Kindi frequency analysis.",
    points: [
      "Recovered the key (C = 11P + 10 mod 26) and decrypted all five captured sessions",
      "Captured with tcpdump in an isolated container against a local Ollama backend",
    ],
    stack: ["Python", "tcpdump", "Frequency Analysis"],
    repo: repo("psycosupport-affine-cryptanalysis-"),
  },
  {
    title: "Astra Hypercar Inspection",
    kind: "Interactive 3D",
    cat: ["Web"],
    year: "2026",
    blurb:
      "Explore a Jesko-inspired hypercar and its mechanical systems in 3D, with a guided inspection flow and an animated engine.",
    points: [
      "Component tree, timeline and camera controls; crankshaft and cylinder animation",
      "Zustand state with a tested interaction engine; responsive for mobile",
    ],
    stack: ["Next.js", "React Three Fiber", "Three.js", "Zustand", "TypeScript"],
    repo: repo("Astra"),
  },
  {
    title: "Awazly (AudioMind)",
    kind: "Urdu Speech to Topics",
    cat: ["AI"],
    year: "2026",
    blurb:
      "Upload Urdu audio, get Roman Urdu topic suggestions. Runs fully offline.",
    points: [
      "Whisper (medium) transcription, keyword extraction, then a keyword-grounded Ollama prompt",
      "Grounding stops the LLM from inventing topics that weren't said",
    ],
    stack: ["Python", "Whisper", "Ollama", "Llama 3"],
    repo: repo("Awazly"),
  },
  {
    title: "Quiz Generation System",
    kind: "NLP / ML",
    cat: ["AI"],
    year: "2026",
    blurb:
      "Reading-comprehension quiz generator on RACE: question generation, SVM/NB answer verification, distractor ranking and graduated hints.",
    points: [
      "Strict generation from article and answer only; BLEU/ROUGE against references",
      "Streamlit app with a developer dashboard (F1, confusion matrix, latency)",
    ],
    stack: ["Python", "scikit-learn", "TF-IDF", "Streamlit"],
    repo: repo("Quiz-Generation-System"),
  },
  {
    title: "Centipede Arcade",
    kind: "Full-Stack Game",
    cat: ["Web"],
    year: "2026",
    blurb:
      "HTML5 Canvas Centipede with a token economy, unlockable skins, global leaderboards and an admin dashboard.",
    points: [
      "Secure auth, role-based access, built without a frontend framework",
      "Node.js backend with MongoDB, deployed on Vercel",
    ],
    stack: ["JavaScript", "Canvas", "Node.js", "MongoDB", "Vercel"],
    repo: repo("centipede"),
    live: "https://centipede-amber.vercel.app",
    liveLabel: "Play it",
  },
  {
    title: "Property Dealers Platform",
    kind: "Business Web App",
    cat: ["Web"],
    year: "2026",
    blurb:
      "Next.js app for property dealers with authentication, a dashboard and lead/activity tracking.",
    points: [],
    stack: ["Next.js", "TypeScript"],
    repo: repo("property-dealers-website"),
  },
  {
    title: "Construction Management System",
    kind: "Desktop App",
    cat: ["Systems"],
    year: "2026",
    blurb:
      "JavaFX app for construction projects covering inventory, material requests, invoices and finance dashboards.",
    points: ["MVC with DAO and factory patterns, role-based dashboards"],
    stack: ["Java", "JavaFX", "DAO", "Design Patterns"],
    repo: repo("Construction-Management-system"),
    team: "Team project",
  },
  {
    title: "AutoCare Hub",
    kind: "Android App · Collaborator",
    cat: ["Mobile"],
    year: "2025",
    blurb:
      "Bike-service booking app connecting customers with workshops: compare services and spare parts, book appointments, rate and review. Built with a team of three.",
    points: [
      "My contributions: workshop ratings, in-app navigation and booking retrieval",
      "Offline-first with Room (SQLite) syncing to Firebase Firestore; FCM reminders; Kotlin + PHP API",
    ],
    stack: ["Kotlin", "Android", "PHP", "Firebase", "Room"],
    repo: "https://github.com/emaadi-source/Auto-Care-MobileApp",
    team: "Collaborator · 3 devs",
  },
  {
    title: "smd-socially",
    kind: "Android App",
    cat: ["Mobile"],
    year: "2025",
    blurb:
      "Instagram-style social app: feed, DMs, stories and highlights, search, profile editing and a call screen.",
    points: [],
    stack: ["Kotlin", "Android", "XML", "Firebase"],
    repo: repo("smd-socially"),
    team: "Team project",
  },
  {
    title: "Airline Control System",
    kind: "Operating Systems",
    cat: ["Systems"],
    year: "2025",
    blurb:
      "Flight scheduling and synchronisation by priority and schedule time, built to learn mutexes and locks.",
    points: [],
    stack: ["C", "Mutexes", "Locks", "Scheduling"],
    repo: repo("Airline-control-system"),
  },
  {
    title: "Cricket 2D",
    kind: "Browser Game",
    cat: ["Web"],
    year: "2026",
    blurb: "2D cricket game in React with a power bar, probability-driven shots, audio and scoreboard.",
    points: [],
    stack: ["React", "Vite", "JavaScript"],
    repo: repo("Cricket-game-2D-website"),
  },
  {
    title: "Photo Editor",
    kind: "Web Tool",
    cat: ["Web"],
    year: "2026",
    blurb: "A browser photo editor in plain HTML, CSS and JavaScript.",
    points: [],
    stack: ["JavaScript", "HTML", "CSS"],
    repo: repo("Photo-editor-website"),
  },
  {
    title: "Compiler Construction",
    kind: "Compilers",
    cat: ["Systems"],
    year: "2026",
    blurb: "Lexer design, parsing and compiler pipeline assignments.",
    points: [],
    stack: ["Lexing", "Parsing", "Grammars"],
    repo: repo("Compiler-Construction"),
  },
];

export const skills: { group: string; items: string[] }[] = [
  { group: "Languages", items: ["Python", "TypeScript", "JavaScript", "C++", "C", "Java", "Kotlin"] },
  { group: "AI / ML", items: ["PyTorch", "LoRA fine-tuning", "KV-cache & attention", "Whisper", "Ollama / LLaMA", "scikit-learn", "ONNX", "Optuna", "MLflow"] },
  { group: "Web", items: ["React", "Next.js", "Node.js", "FastAPI", "Tailwind", "Three.js / R3F", "Supabase", "MongoDB", "SQLite"] },
  { group: "Security", items: ["Applied cryptography", "Protocol attacks", "MITM / replay", "Frequency analysis", "AEAD / HKDF"] },
  { group: "Mobile & Desktop", items: ["Android (Kotlin)", "Firebase", "JavaFX"] },
  { group: "Tools", items: ["Git & GitHub", "Docker", "Vercel", "Streamlit", "tcpdump"] },
];

export const timeline = [
  {
    when: "Nov 2026 – Present",
    title: "Full-Stack Engineer (part-time)",
    org: "K2 Studio",
    points: [
      "Joined as an intern for 3 months, then converted to a part-time engineering role",
    ],
  },
  {
    when: "2023 – Present",
    title: "BS Computer Science, final year",
    org: "FAST-NUCES, Islamabad",
    points: [
      "Recent coursework: Information Security, Generative AI, Compiler Construction, Mobile Development, Operating Systems",
      "Coursework projects are shipped as full apps: model training, benchmarks, deployment and written reports",
    ],
  },
  {
    when: "Jan – Mar 2024",
    title: "Software Engineering Intern (completed)",
    org: "Ishraq Labs, Islamabad",
    points: [
      "Built the Ayat (verse) sharing feature end-to-end for the Zaad-ul-Quran mobile app",
      "Frontend design, UX improvements and backend API support",
      "Explored AI-driven content recommendation",
    ],
  },
  {
    when: "2021 – 2023",
    title: "Intermediate (ICS)",
    org: "Punjab College",
    points: ["Physics, Mathematics, Computer Science"],
  },
];
