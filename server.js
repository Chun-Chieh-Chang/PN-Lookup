import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const MASTER_PATH = join(DATA_DIR, 'master.json');
const LEGACY_PARTS_PATH = join(DATA_DIR, 'parts.json');
const LEGACY_BOM_PATH = join(DATA_DIR, 'bom.json');

const app = express();
app.use(express.json({ limit: '10mb' }));

function defaultMaster() {
  return {
    type: 'pn-lookup-backup',
    version: 2,
    parts: [],
    bom: { children: {}, parents: {} },
  };
}

function loadMaster() {
  if (!existsSync(MASTER_PATH)) {
    let parts = [];
    let bom = { children: {}, parents: {} };
    try { parts = JSON.parse(readFileSync(LEGACY_PARTS_PATH, 'utf-8')); } catch {}
    try { bom = JSON.parse(readFileSync(LEGACY_BOM_PATH, 'utf-8')); } catch {}
    saveMaster({ parts, bom });
  }
  return JSON.parse(readFileSync(MASTER_PATH, 'utf-8'));
}

function saveMaster(data) {
  const next = { ...defaultMaster(), ...data };
  if (!Array.isArray(next.parts)) next.parts = [];
  if (!next.bom || typeof next.bom !== 'object') next.bom = { children: {}, parents: {} };
  if (!next.bom.children) next.bom.children = {};
  if (!next.bom.parents) next.bom.parents = {};
  writeFileSync(MASTER_PATH, JSON.stringify(next, null, 2), 'utf-8');
}

// Serialize writes to avoid read-modify-write races between parts/bom updates
let writeQueue = Promise.resolve();
function enqueueWrite(mutator) {
  writeQueue = writeQueue.then(() => {
    const master = loadMaster();
    mutator(master);
    saveMaster(master);
  });
  return writeQueue;
}

// Master API — the single source of truth (data/master.json)
app.get('/api/master', (_req, res) => {
  try {
    res.json(loadMaster());
  } catch {
    res.status(500).json({ error: 'Failed to load master data' });
  }
});

app.put('/api/master', (req, res) => {
  const { parts, bom } = req.body || {};
  if (!Array.isArray(parts) || !bom) {
    return res.status(400).json({ error: 'parts and bom are required' });
  }
  enqueueWrite((master) => {
    master.parts = parts;
    master.bom = bom;
  }).then(() => {
    res.json({ ok: true, parts: parts.length, assemblies: Object.keys(bom.children || {}).length });
  }).catch(() => {
    res.status(500).json({ error: 'Failed to save master data' });
  });
});

// BOM API — backed by master.json
app.get('/api/bom', (_req, res) => {
  try {
    res.json(loadMaster().bom);
  } catch {
    res.status(500).json({ error: 'Failed to load BOM data' });
  }
});

app.put('/api/bom', (req, res) => {
  const { children, parents } = req.body;
  if (!children || !parents) {
    return res.status(400).json({ error: 'children and parents are required' });
  }
  enqueueWrite((master) => {
    master.bom = { children, parents };
  }).then(() => {
    res.json({ ok: true, count: Object.keys(children).length });
  }).catch(() => {
    res.status(500).json({ error: 'Failed to save BOM data' });
  });
});

// Parts API — backed by master.json
app.get('/api/parts', (_req, res) => {
  try {
    res.json(loadMaster().parts);
  } catch {
    res.json([]);
  }
});

app.put('/api/parts', (req, res) => {
  const parts = req.body;
  if (!Array.isArray(parts)) {
    return res.status(400).json({ error: 'parts must be an array' });
  }
  enqueueWrite((master) => {
    master.parts = parts;
  }).then(() => {
    res.json({ ok: true, count: parts.length });
  }).catch(() => {
    res.status(500).json({ error: 'Failed to save parts data' });
  });
});

// Serve static files
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback — all non-API routes serve index.html
app.use((_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PN-Lookup server running on http://localhost:${PORT}`);
});
