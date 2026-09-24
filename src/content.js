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

// satu kalimat status, sengaja satu sumber: tampil di baris ABOUT dan di
// kartu LET'S CONNECT. Jangan ditambahin tanggal atau janji lain di sini
export const AVAILABILITY = 'Open to AI/ML and data internships.'

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
        p: 'Data Science undergraduate at Binus University, Jakarta. Semester 5, building at the intersection of machine learning and the web.',
      },
      {
        h: 'AVAILABILITY',
        p: AVAILABILITY,
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
        p: 'Retrieval systems and agentic workflows: an analyst agent that recomputes its own arithmetic a second way before it answers, a streaming air-quality platform that retrains itself when the data drifts, a 10-K RAG engine with a hallucination gate, a resume chatbot that is live, and this 3D site.',
      },
      {
        h: 'SEP 2026 / SEMESTER 5',
        tag: 'NOW',
        p: 'Taking earlier builds all the way to public. FinSight was rewritten from a Python prototype into one deployed Next.js app, with its refusal threshold set from measured data instead of a guess. KENNETH, a parking app for a venture course team, went live on Firebase.',
      },
    ],
    foot: 'TIMELINE / UPDATED 09.2026',
  },
  projects: {
    code: 'ICEBERG_SEC_03',
    kicker: "things i've built",
    title: 'PROJECTS',
    // Urutan asli permintaan Nehemiah langsung, dengan VERDICT dan PULSE
    // disisipkan di depan waktu keduanya masuk roster (9 Agu 2026). Sepuluh
    // teratas dikasih link; sisanya cukup disebut di satu baris penutup.
    // 24 Sep 2026: FinSight naik ke v2 (live), KENNETH masuk di sebelah projek produk.
    // hook + facts: versi skim buat recruiter (panel nampilin ini dulu, paragraf
    // penuh baru kebuka lewat tombol Details). Dua-duanya WAJIB dicomot dari
    // paragrafnya sendiri, angkanya harus sama persis. Ganti paragraf = cek ulang ini.
    rows: [
      {
        h: 'VERDICT ANALYST',
        tag: 'LIVE · AGENTIC AI',
        hook: 'A data-analyst agent that is not right until something outside it checks.',
        facts: ['Locked Docker sandbox', 'pandas against DuckDB SQL', 'Deterministic statistics engine'],
        p: 'A data-analyst agent built on the assumption that an agent is not right until something outside it checks. It writes and runs its own code in a locked Docker sandbox, then recomputes every descriptive number a second independent way, pandas against DuckDB SQL, so confidence is measured rather than claimed. Causal questions are never answered by the language model: they route to a deterministic statistics engine that must pass recover-the-ground-truth tests, and any figure in the narrative that is absent from the engine output gets the narrative swapped for a deterministic template.',
        links: [
          { label: 'LIVE', href: 'https://agentic-verdict-sand.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/agentic_verdict' },
        ],
      },
      {
        h: 'PULSE / LIVE AIR QUALITY',
        tag: 'MLOPS · STREAMING',
        hook: 'Jakarta air quality, built around what happens after a model deploys.',
        facts: ['Updates on every single event', 'Retrains itself when the data drifts', 'One command, no cloud account'],
        p: 'Jakarta air quality, built around what happens after a model deploys. Sensor and weather data stream through Redis into an online model that updates on every single event rather than in nightly batches, forecasts PM2.5 with an uncertainty band, and flags spikes. When the data drifts it retrains itself, versions the result, and rewrites its own model card, while an LLM agent turns each spike into a plain-language incident card. Runs as a self-contained demo, one command, no cloud account needed.',
        links: [{ label: 'REPO', href: 'https://github.com/ne-he/pulse' }],
      },
      {
        h: 'FINSIGHT V2 / SEC 10-K RAG',
        tag: 'LIVE · FINANCIAL RAG',
        hook: 'Answers from SEC 10-K filings, cited down to the section, or refuses.',
        facts: ['hit-rate@6 18/18', 'Out-of-scope refusals 4/4', 'Zero false refusals'],
        p: 'Answers questions about public companies strictly from their SEC 10-K filings, cited down to the section, or refuses when the filing does not support an answer. v2 rewrites the Python original as one Next.js app on Vercel with Supabase for sign-in, history and vector search. Hybrid vector and full-text retrieval fused with Reciprocal Rank Fusion, one search per company so comparisons never lose a side, and a refusal gate set at the midpoint of the measured gap. On 936 chunks and a 22-question golden set: hit-rate@6 18/18, out-of-scope refusals 4/4, zero false refusals. Every citation opens its source passage beside the answer.',
        links: [
          { label: 'LIVE', href: 'https://finsight-v2-nine.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/finsight-v2' },
        ],
      },
      {
        h: 'PHISHGUARD V2',
        tag: 'ML · SECURITY',
        hook: 'Phishing URL detection API. v2 is a deliberate rebuild because v1 had real defects.',
        facts: ['Roughly 81k labelled URLs', '17 tests', 'Label-orientation regression test'],
        p: 'Phishing URL detection API trained on roughly 81k labelled URLs: sentence-transformer embeddings feeding a small Keras dense network. v2 exists because v1 had real defects, so it is a deliberate rebuild: strict URL validation, a health endpoint that admits when the model failed to load, config from the environment, and 17 tests including a regression test that locks the label orientation.',
        links: [
          { label: 'LIVE', href: 'https://url-detection-one.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/URL_Detection' },
        ],
      },
      {
        h: 'ASK NEMI / RESUME RAG',
        tag: 'LIVE · GENAI',
        hook: 'A portfolio you talk to instead of read.',
        facts: ['Gemini embeddings (768-dim)', 'Streamed answers with citations', 'Runs as the chat on this site'],
        p: 'A portfolio you talk to instead of read. Gemini embeddings (768-dim) over a curated personal knowledge base in Supabase pgvector, hybrid retrieval, a confidence gate, and streamed answers with citations. It already runs inside this site as the chat assistant.',
        links: [{ label: 'LIVE', href: 'https://web-portofolio-rag.vercel.app' }],
      },
      {
        h: 'FEATURE STORE MVP',
        tag: 'DATA ENGINEERING · MLOPS',
        hook: 'An e-commerce feature store, end to end.',
        facts: ['20+ user-level features', 'PostgreSQL offline, Redis online', 'Evidently drift watch'],
        p: 'An e-commerce feature store, end to end. Ingests transaction data, computes 20+ user-level features in batch, keeps PostgreSQL as the offline store and Redis as the online store, and serves them through a low-latency FastAPI. A Streamlit dashboard backed by Evidently watches feature freshness and drift.',
        links: [
          { label: 'LIVE', href: 'https://ne-he-feature-store-mvp.hf.space' },
          { label: 'REPO', href: 'https://github.com/ne-he/Feature_shopz' },
        ],
      },
      {
        h: 'PHONE ADDICTION PREDICTOR V2',
        tag: 'FLAGSHIP',
        hook: 'A CatBoost regressor that scores smartphone addiction from 1 to 10.',
        facts: ['One Preprocessor for training and serving', 'SHAP, tests, CI and Docker', '0.95 R² flagged as a synthetic-data artifact'],
        p: 'A CatBoost regressor that scores smartphone addiction from 1 to 10. One shared Preprocessor class is the single source of truth for training, the FastAPI service, and the Streamlit demo, so training and serving cannot drift apart. Ships with SHAP explanations, tests, CI and Docker. The model card flags the 0.95 R² as an artifact of synthetic data, not clinical validity.',
        links: [
          { label: 'LIVE', href: 'https://addictv2.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/Addictv2' },
        ],
      },
      {
        h: 'WASTE CLASSIFIER BENCHMARK',
        tag: 'DEEP LEARNING · VISION',
        hook: 'Three CNNs benchmarked on TrashNet, then fused into a soft-voting ensemble.',
        facts: ['MobileNetV2: 90.3% validation accuracy', 'Baseline CNN: 54.5%', 'Grad-CAM'],
        p: 'TrashNet, six waste classes, 2,527 images. Benchmarked ResNet50, EfficientNet-B0 and MobileNetV2 with selective fine-tuning, then fused them into a soft-voting ensemble. Class imbalance handled with weighted sampling and label smoothing. MobileNetV2 transfer learning reached 90.3% validation accuracy against a 54.5% baseline CNN, and Grad-CAM shows what the model actually looked at.',
        links: [
          { label: 'LIVE', href: 'https://deep-learning-imageclassif.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/Deep_Learning_imageclassif' },
        ],
      },
      {
        h: 'E-COMMERCE SALES ANALYSIS',
        tag: 'LIVE · ANALYTICS',
        hook: '20,848 marketplace orders read for three decisions an owner actually has to make.',
        facts: ['Eleven order-status variants normalised', 'Missing months kept as gaps', 'Revenue never double counted'],
        p: '20,848 marketplace orders read for three decisions an owner actually has to make: which products deserve budget, which regions are failing, and where margin leaks. The highest-volume product turns out not to be the revenue driver, cancellation tracks geography rather than the COD payment method it usually gets blamed on, and shipping subsidy compounds the loss in the same provinces that cancel most. The harder half was the data: eleven order-status variants normalised so valid orders were not discarded, two missing months marked as gaps instead of zeroes, and multi-category orders split proportionally so revenue is never double counted.',
        links: [
          { label: 'LIVE', href: 'https://dashboard-nehemiah.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/nemi-dashboard' },
        ],
      },
      {
        h: 'KENNETH / JAKARTA PARKING',
        tag: 'LIVE · VENTURE',
        hook: 'Shows how full a Jakarta car park is before you leave home.',
        facts: ['Twenty malls and BINUS campuses', 'Team set the case, I built the app', 'Simulated data, and it says so'],
        p: 'A mobile web app that shows how full a Jakarta car park is before you leave home, how long the gate queue is, and which nearby place still has space. Google Maps stops at the building entrance, KENNETH starts there. Twenty malls and BINUS campuses, priority entry, building valet and EV charger booking, routing to the least busy gate, and a partner dashboard for building managers. Built for the BINUS Venture Creation course: the team set the product and business case, I built the app. React, TypeScript, MapLibre and three.js on Firebase. The data is simulated and every location says so.',
        links: [
          { label: 'LIVE', href: 'https://kenneth-park.web.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/kenneth' },
        ],
      },
      {
        h: 'FAMILY TASK BOARD',
        tag: 'PRODUCT',
        hook: 'A shared task board built for my own household rather than for a grade.',
        facts: ['Next.js and TypeScript', 'Deployed and in use'],
        p: 'A shared task board built for my own household rather than for a grade. Next.js and TypeScript, deployed and in use.',
        links: [
          { label: 'LIVE', href: 'https://partai-wilhelmus.vercel.app' },
          { label: 'REPO', href: 'https://github.com/ne-he/Partai_Wilhelmus' },
        ],
      },
      {
        h: 'ICEBERG',
        tag: 'THIS SITE',
        hook: 'Live-rendered 3D scroll experience. Every object here is real and clickable.',
        facts: ['React Three Fiber', 'Agentic Blender-to-web pipeline', 'Heaviest rock 10.7 MB to 0.4 MB'],
        p: 'Live-rendered 3D scroll experience. Blender-modeled ice driven through an agentic Blender-to-web pipeline, React Three Fiber, real-time refraction. No scrubbed video, every object here is real and clickable. Geometry ships meshopt-compressed: the heaviest rock went from 10.7 MB down to 0.4 MB.',
        links: [{ label: 'REPO', href: 'https://github.com/ne-he/iceberg' }],
      },
      {
        h: 'ALSO SHIPPED',
        tag: 'SMALLER BUILDS',
        hook: 'Armory Hall, HCI Lab, SimpleNotes for iOS, a Second Brain CLI and four more.',
        facts: ['OpenAPI contract generates the hooks', 'Native SwiftUI for iOS 16', 'Roughly 40% cheaper token usage'],
        p: 'Armory Hall, a cinematic two-act portfolio where a dark room powers on as you scroll, built on GSAP choreography and canvas frame-scrubbing. HCI Lab, a TypeScript monorepo where the OpenAPI contract generates the frontend hooks, so the two halves cannot silently diverge. A churn pipeline that will not promote a model until it clears an accuracy gate, a credit scorer fronted by a form built for a loan officer rather than a data scientist, and a workout-load scorer that rates a training program before you run it. SimpleNotes, a native SwiftUI notes app for iOS 16. A to-do and focus dashboard from a Software Engineering mini project. And a Second Brain CLI: deterministic index-and-score retrieval over my course materials so the model opens only the top-ranked section, A/B tested at roughly 40% cheaper token usage.',
        links: [
          { label: 'ARMORY HALL', href: 'https://armory-rouge.vercel.app' },
          { label: 'HCI LAB', href: 'https://web-hci-final-clash-of-bang.vercel.app' },
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
        p: 'Python, pandas, NumPy, Polars, DuckDB, SQL, exploratory data analysis, Jupyter. Used across the Feature Store, the e-commerce analysis, and every model below.',
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
        p: 'FastAPI, PostgreSQL, Redis, Docker, GitHub Actions, MLflow, Streamlit, pytest. Enough to take a model from notebook to a deployed endpoint that stays up.',
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
    foot: 'STACK / SEMESTER 5 SNAPSHOT',
  },
}

export const CONTACT = {
  email: 'nehewj@gmail.com',
  github: 'https://github.com/ne-he',
  linkedin: 'https://www.linkedin.com/in/nehemiah-wilhelmus-b90391327/',
  whatsapp: 'https://wa.me/6281911497766',
  armory: 'https://armory-rouge.vercel.app',
}
