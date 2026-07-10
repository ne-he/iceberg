// ===== ICEBERG — semua konten CV di satu file, edit di sini aja =====

export const HERO_CRYSTAL = {
  id: 'hero',
  model: '/models/iceberg_hero.glb', // versi high-detail khusus hero
  position: [0, 0, 0],
  scale: 1.28,
  spin: 0.04,
  yaw: 0.6,
  artifact: null,
  draggable: true, // bisa diputer pakai drag
}

export const CRYSTALS = [
  {
    id: 'journey',
    code: 'ICEBERG_SEC_01',
    name: 'JOURNEY',
    position: [-3.5, -8.5, -2],
    scale: 1.15,
    spin: 0.07,
    yaw: 2.1,
    artifact: 'octahedron',
    labelOffset: [1.6, 0.9, 0],
  },
  {
    id: 'projects',
    code: 'ICEBERG_SEC_02',
    name: 'PROJECTS',
    position: [4, -18, -3],
    scale: 1.3,
    spin: 0.055,
    yaw: 4.2,
    artifact: 'torusknot',
    labelOffset: [-2.4, 1.3, 0],
  },
  {
    id: 'skills',
    code: 'ICEBERG_SEC_03',
    name: 'SKILLS',
    position: [-3.2, -28, 0.5],
    scale: 1.05,
    spin: 0.08,
    yaw: 0.9,
    artifact: 'icosahedron',
    labelOffset: [1.5, 0.8, 0],
  },
]

export const SECTION_WORDS = [
  { word: 'JOURNEY', center: 0.25 },
  { word: 'PROJECTS', center: 0.5 },
  { word: 'SKILLS', center: 0.75 },
]

export const PANELS = {
  journey: {
    code: 'ICEBERG_SEC_01',
    title: 'JOURNEY',
    rows: [
      {
        h: '2024 / BINUS UNIVERSITY',
        p: 'Started the Data Science undergraduate program in Jakarta. First lines of Python, first real datasets.',
      },
      {
        h: '2025 / FOUNDATIONS',
        p: 'Statistics, data wrangling with pandas, exploratory data analysis, and classical machine learning with scikit-learn, all hands-on in Jupyter.',
      },
      {
        h: '2026 / SEMESTER 4',
        tag: 'NOW',
        p: 'Shipping end-to-end work: machine learning for cybersecurity, retrieval systems for LLMs, agentic AI workflows, and this 3D site.',
      },
    ],
    foot: 'TIMELINE / UPDATED 07.2026',
  },
  projects: {
    code: 'ICEBERG_SEC_02',
    title: 'PROJECTS',
    rows: [
      {
        h: 'PHISHGUARD',
        tag: 'ML · SECURITY',
        p: 'Phishing URL detector. Feature engineering on URL structure, trained and evaluated with scikit-learn in Python.',
      },
      {
        h: 'SECOND BRAIN CLI',
        tag: 'RETRIEVAL',
        p: 'Deterministic index-and-score retrieval over all my course materials: the LLM opens only the top-ranked section instead of grepping blindly. A/B tested: ~40% cheaper token usage.',
      },
      {
        h: 'RESUME RAG CHATBOT',
        tag: 'IN DEVELOPMENT',
        p: 'A portfolio you can talk to: Gemini embeddings (768-dim) + Supabase pgvector over a personal knowledge base. Will live inside this site.',
      },
      {
        h: 'ICEBERG',
        tag: 'THIS SITE',
        p: 'Live-rendered 3D scroll experience. Blender-modeled ice driven through an agentic pipeline, React Three Fiber, real-time refraction. No scrubbed video, every object here is real and clickable.',
      },
    ],
    foot: 'SELECTED WORK / MORE ON REQUEST',
  },
  skills: {
    code: 'ICEBERG_SEC_03',
    title: 'SKILLS',
    rows: [
      {
        h: 'DATA & ANALYSIS',
        p: 'Python, pandas, NumPy, Matplotlib, SQL, exploratory data analysis, Jupyter.',
      },
      {
        h: 'MACHINE LEARNING',
        p: 'scikit-learn, feature engineering, model evaluation, classical ML.',
      },
      {
        h: 'AI / LLM',
        p: 'Gemini API, retrieval-augmented generation, embeddings + vector search (pgvector), prompt engineering.',
      },
      {
        h: 'AGENTIC WORKFLOWS',
        p: 'Claude Code, MCP tool pipelines (Blender-to-web asset generation), automation-first development.',
      },
      {
        h: 'CREATIVE / WEB',
        p: 'Three.js, React Three Fiber, Blender, Vite.',
      },
    ],
    foot: 'STACK / SEMESTER 4 SNAPSHOT',
  },
}

export const CONTACT = {
  email: 'nehemiahwj@gmail.com',
  github: 'https://github.com/ne-he',
  // TODO(Nehemiah): isi link LinkedIn asli
  linkedin: '',
}
