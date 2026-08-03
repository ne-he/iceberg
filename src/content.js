// ===== ICEBERG: semua konten CV di satu file, edit di sini aja =====

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
    id: 'about',
    code: 'ICEBERG_SEC_01',
    tag: '01 / 04',
    name: 'ABOUT',
    position: [3.4, -7, -2],
    scale: 1.1,
    spin: 0.06,
    yaw: 1.4,
    artifact: 'tetrahedron',
    labelOffset: [-2.1, 1.0, 0],
    draggable: true,
  },
  {
    id: 'journey',
    code: 'ICEBERG_SEC_02',
    tag: '02 / 04',
    name: 'JOURNEY',
    position: [-3.5, -14.5, -2],
    scale: 1.15,
    spin: 0.07,
    yaw: 2.1,
    artifact: 'octahedron',
    labelOffset: [1.6, 0.9, 0],
    draggable: true,
  },
  {
    id: 'projects',
    code: 'ICEBERG_SEC_03',
    tag: '03 / 04',
    name: 'PROJECTS',
    position: [4, -22, -3],
    scale: 1.3,
    spin: 0.055,
    yaw: 4.2,
    artifact: 'torusknot',
    labelOffset: [-2.4, 1.3, 0],
    draggable: true,
  },
  {
    id: 'skills',
    code: 'ICEBERG_SEC_04',
    tag: '04 / 04',
    name: 'SKILLS',
    position: [-3.2, -29, 0.5],
    scale: 1.05,
    spin: 0.08,
    yaw: 0.9,
    artifact: 'icosahedron',
    labelOffset: [1.5, 0.8, 0],
    draggable: true,
  },
]

export const SECTION_WORDS = [
  { word: 'ABOUT', center: 0.2 },
  { word: 'JOURNEY', center: 0.4 },
  { word: 'PROJECTS', center: 0.6 },
  { word: 'SKILLS', center: 0.8 },
]

export const PANELS = {
  about: {
    code: 'ICEBERG_SEC_01',
    kicker: 'a little about me',
    title: 'ABOUT',
    rows: [
      {
        h: 'NEHEMIAH WILHELMUS JUNAIDI',
        p: 'Data Science undergraduate at Binus University, Jakarta. Semester 4, building at the intersection of machine learning and the web.',
      },
      {
        h: 'WHAT I DO',
        p: 'End-to-end work: from raw data and model training to the interface people actually touch. This site included.',
      },
      {
        h: 'HOW I WORK',
        tag: 'AI-NATIVE',
        p: 'Agentic workflows by default. LLM pipelines, automation-first tooling, ship fast and iterate.',
      },
      {
        h: 'BELOW THE SURFACE',
        p: 'This rock is just the tip. Keep descending for the journey, the projects, and the stack underneath.',
      },
    ],
    foot: 'PROFILE / JAKARTA 2026',
  },
  journey: {
    code: 'ICEBERG_SEC_02',
    kicker: 'how i got here',
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
        h: 'EARLY 2026 / OUT OF THE NOTEBOOK',
        p: 'Churn modelling, credit scoring and academic end-to-end cases stopped ending at the last notebook cell. Each one got pushed into a FastAPI service and a real deployed endpoint.',
      },
      {
        h: 'MID 2026 / PRODUCTION HABITS',
        p: 'The Feature Store, the CatBoost flagship rebuild and the CNN benchmark. The shift was from "the model works" to tests, CI, Docker, model cards, and writing down the failure modes honestly instead of hiding them.',
      },
      {
        h: '2026 / SEMESTER 4',
        tag: 'NOW',
        p: 'Retrieval systems and agentic workflows: a 10-K RAG engine with a hallucination gate, a resume chatbot that is live, and this 3D site. Building at the intersection of machine learning and the web.',
      },
    ],
    foot: 'TIMELINE / UPDATED 08.2026',
  },
  projects: {
    code: 'ICEBERG_SEC_03',
    kicker: "things i've built",
    title: 'PROJECTS',
    rows: [
      {
        h: 'PHONE ADDICTION PREDICTOR V2',
        tag: 'FLAGSHIP',
        p: 'A CatBoost regressor that scores smartphone addiction from 1 to 10. One shared Preprocessor class is the single source of truth for training, the FastAPI service, and the Streamlit demo, so training and serving cannot drift apart. Ships with SHAP explanations, tests, CI and Docker. The model card flags the 0.95 R² as an artifact of synthetic data, not clinical validity.',
        links: [
          { label: 'LIVE', href: 'https://addictv2.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/Addictv2' },
        ],
      },
      {
        h: 'FINSIGHT / SEC 10-K RAG',
        tag: 'RETRIEVAL · FINANCE',
        p: 'Answers questions about public companies strictly from their SEC 10-K filings. Section-aware chunking that follows the 10-K Item skeleton, hybrid dense and BM25 retrieval fused with Reciprocal Rank Fusion, metadata filtering by company and fiscal year, and a confidence gate that says "not found in the filings" instead of inventing a number. Every claim carries its exact section citation.',
        links: [{ label: 'REPO', href: 'https://github.com/ne-he/RAG_businessAnalysis_assist' }],
      },
      {
        h: 'FEATURE STORE MVP',
        tag: 'DATA ENGINEERING · MLOPS',
        p: 'An e-commerce feature store, end to end. Ingests transaction data, computes 20+ user-level features in batch, keeps PostgreSQL as the offline store and Redis as the online store, and serves them through a low-latency FastAPI. A Streamlit dashboard backed by Evidently watches feature freshness and drift.',
        links: [{ label: 'REPO', href: 'https://github.com/ne-he/Feature_shopz' }],
      },
      {
        h: 'PHISHGUARD V2',
        tag: 'ML · SECURITY',
        p: 'Phishing URL detection API trained on roughly 81k labelled URLs: sentence-transformer embeddings feeding a small Keras dense network. v2 exists because v1 had real defects, so it is a deliberate rebuild: strict URL validation, a health endpoint that admits when the model failed to load, config from the environment, and 17 tests including a regression test that locks the label orientation.',
        links: [
          { label: 'REPO', href: 'https://github.com/ne-he/phishguard' },
          { label: 'V1 DEMO', href: 'https://url-detection-one.vercel.app' },
        ],
      },
      {
        h: 'ASK NEMI / RESUME RAG',
        tag: 'LIVE · GENAI',
        p: 'A portfolio you talk to instead of read. Gemini embeddings (768-dim) over a curated personal knowledge base in Supabase pgvector, hybrid retrieval, a confidence gate, and streamed answers with citations. Being folded into this site.',
        links: [{ label: 'LIVE', href: 'https://web-portofolio-rag.vercel.app' }],
      },
      {
        h: 'WASTE CLASSIFIER BENCHMARK',
        tag: 'DEEP LEARNING · VISION',
        p: 'TrashNet, six waste classes, 2,527 images. Benchmarked ResNet50, EfficientNet-B0 and MobileNetV2 with selective fine-tuning, then fused them into a soft-voting ensemble. Class imbalance handled with weighted sampling and label smoothing. MobileNetV2 transfer learning reached 90.3% validation accuracy against a 54.5% baseline CNN, and Grad-CAM shows what the model actually looked at.',
        links: [
          { label: 'LIVE', href: 'https://deep-learning-imageclassif.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/Deep_Learning_imageclassif' },
        ],
      },
      {
        h: 'ICEBERG',
        tag: 'THIS SITE',
        p: 'Live-rendered 3D scroll experience. Blender-modeled ice driven through an agentic Blender-to-web pipeline, React Three Fiber, real-time refraction. No scrubbed video, every object here is real and clickable. Geometry ships meshopt-compressed: the heaviest rock went from 10.7 MB down to 0.4 MB.',
        links: [{ label: 'REPO', href: 'https://github.com/ne-he/iceberg' }],
      },
      {
        h: 'ARMORY HALL',
        tag: 'CREATIVE WEB',
        p: 'A cinematic two-act portfolio: a dark hall powers on as you scroll and each project steps out as its own unit. GSAP choreography, canvas frame-scrubbing, AI-generated visuals.',
        links: [
          { label: 'LIVE', href: 'https://armory-rouge.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/armory' },
        ],
      },
      {
        h: 'HCI LAB',
        tag: 'FULL-STACK',
        p: 'A TypeScript monorepo where the API contract is the single source of truth: Express 5 and PostgreSQL through Drizzle, Zod validation throughout, and Orval generating the frontend hooks and schemas straight from the OpenAPI spec, so the two halves cannot silently diverge.',
        links: [{ label: 'REPO', href: 'https://github.com/ne-he/hci_lab' }],
      },
      {
        h: 'FAMILY TASK BOARD',
        tag: 'PRODUCT',
        p: 'A shared task board built for my own household rather than for a grade. Next.js and TypeScript, deployed and in use.',
        links: [
          { label: 'LIVE', href: 'https://family-list-iota.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/Partai_Wilhelmus' },
        ],
      },
      {
        h: 'ALSO SHIPPED',
        tag: 'SMALLER BUILDS',
        p: 'SimpleNotes, a native SwiftUI notes app for iOS 16. A to-do and focus dashboard built in a Software Engineering mini project. And a Second Brain CLI: deterministic index-and-score retrieval over my course materials so the model opens only the top-ranked section, A/B tested at roughly 40% cheaper token usage.',
        links: [
          { label: 'SIMPLENOTES', href: 'https://github.com/ne-he/swift_UI_notes' },
          { label: 'TO-DO DASHBOARD', href: 'https://github.com/ne-he/To-do-list-organizer' },
        ],
      },
    ],
    foot: 'SELECTED WORK / ALL REPOS AT GITHUB.COM/NE-HE',
  },
  skills: {
    code: 'ICEBERG_SEC_04',
    kicker: 'what i work with',
    title: 'SKILLS',
    rows: [
      {
        h: 'DATA & ANALYSIS',
        p: 'Python, pandas, NumPy, Polars, SQL, exploratory data analysis, Jupyter. Used across the Feature Store and every model below.',
      },
      {
        h: 'MACHINE LEARNING',
        p: 'scikit-learn, CatBoost, PyTorch, TensorFlow and Keras. Transfer learning, class imbalance handling, and explanation with SHAP and Grad-CAM rather than a bare accuracy number.',
      },
      {
        h: 'AI / LLM',
        p: 'Gemini API, retrieval-augmented generation, hybrid dense and BM25 retrieval fused with RRF, embeddings and vector search (pgvector), confidence gating, and eval harnesses that measure hit-rate and faithfulness.',
      },
      {
        h: 'SERVING & INFRA',
        p: 'FastAPI, PostgreSQL, Redis, Docker, GitHub Actions, Streamlit, pytest. Enough to take a model from notebook to a deployed endpoint that stays up.',
      },
      {
        h: 'AGENTIC WORKFLOWS',
        p: 'Claude Code, MCP tool pipelines (Blender-to-web asset generation), automation-first development.',
      },
      {
        h: 'CREATIVE / WEB',
        p: 'Three.js, React Three Fiber, Next.js, TypeScript, Blender, Vite, GSAP.',
      },
    ],
    foot: 'STACK / SEMESTER 4 SNAPSHOT',
  },
}

export const CONTACT = {
  email: 'nehewj@gmail.com',
  github: 'https://github.com/ne-he',
  linkedin: 'https://www.linkedin.com/in/nehemiah-wilhelmus-b90391327/',
  whatsapp: 'https://wa.me/6281911497766',
}
