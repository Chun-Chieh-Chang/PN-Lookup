import express from 'express';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BOM_PATH = join(__dirname, 'data', 'bom.json');

const app = express();
app.use(express.json({ limit: '10mb' }));

function loadBOM() {
  return JSON.parse(readFileSync(BOM_PATH, 'utf-8'));
}

function saveBOM(data) {
  writeFileSync(BOM_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// BOM API
app.get('/api/bom', (_req, res) => {
  try {
    res.json(loadBOM());
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
    saveBOM({ children, parents });
    res.json({ ok: true, count: Object.keys(children).length });
  } catch {
    res.status(500).json({ error: 'Failed to save BOM data' });
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
