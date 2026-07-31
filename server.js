import express from 'express';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const BOM_PATH = join(DATA_DIR, 'bom.json');
const PARTS_PATH = join(DATA_DIR, 'parts.json');

const app = express();
app.use(express.json({ limit: '10mb' }));

function loadJSON(path) {
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function saveJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

// BOM API
app.get('/api/bom', (_req, res) => {
  try {
    res.json(loadJSON(BOM_PATH));
  } catch {
    res.status(500).json({ error: 'Failed to load BOM data' });
  }
});

app.put('/api/bom', (req, res) => {
  try {
    const { children, parents } = req.body;
    if (!children || !parents) {
      return res.status(400).json({ error: 'children and parents are required' });
    }
    saveJSON(BOM_PATH, { children, parents });
    res.json({ ok: true, count: Object.keys(children).length });
  } catch {
    res.status(500).json({ error: 'Failed to save BOM data' });
  }
});

// Parts API
app.get('/api/parts', (_req, res) => {
  try {
    res.json(loadJSON(PARTS_PATH));
  } catch {
    res.json([]);
  }
});

app.put('/api/parts', (req, res) => {
  try {
    const parts = req.body;
    if (!Array.isArray(parts)) {
      return res.status(400).json({ error: 'parts must be an array' });
    }
    saveJSON(PARTS_PATH, parts);
    res.json({ ok: true, count: parts.length });
  } catch {
    res.status(500).json({ error: 'Failed to save parts data' });
  }
});

// Serve static files
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback — all non-API routes serve index.html
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PN-Lookup server running on http://localhost:${PORT}`);
});
