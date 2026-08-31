import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import { convertUnifiedSeedToMaster } from './scripts/buildMaster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const MASTER_PATH = join(DATA_DIR, 'pn-lookup-master.json');
const LEGACY_MASTER_PATH = join(DATA_DIR, 'master.json');
const RAW_SEED_PATH = join(__dirname, 'rawdata', 'master_table_unified.json');
const IMAGE_CONFIG_PATH = join(__dirname, '.image-config.local.json');

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
    // 1. 優先嘗試從舊版 master.json 自動遷移
    if (existsSync(LEGACY_MASTER_PATH)) {
      try {
        const legacyData = JSON.parse(readFileSync(LEGACY_MASTER_PATH, 'utf-8'));
        saveMaster(legacyData);
        return legacyData;
      } catch {
        /* ignore fallback error */
      }
    }
    // 2. 若資料庫檔案全數遺失，自動從 rawdata 統一種子檔轉譯並做災難復原
    if (existsSync(RAW_SEED_PATH)) {
      try {
        const seedData = JSON.parse(readFileSync(RAW_SEED_PATH, 'utf-8'));
        const master = (seedData.parts && seedData.bom) ? seedData : convertUnifiedSeedToMaster(seedData);
        saveMaster(master);
        return master;
      } catch {
        /* ignore seed error */
      }
    }
    return defaultMaster();
  }
  return JSON.parse(readFileSync(MASTER_PATH, 'utf-8'));
}

function saveMaster(data) {
  const next = { ...defaultMaster(), ...data };
  if (!Array.isArray(next.parts)) next.parts = [];

  // 自動防禦去重：依 partNo 保留唯一實體，防止重複追加
  const partsMap = new Map();
  for (const p of next.parts) {
    if (p && p.partNo && !partsMap.has(p.partNo)) {
      partsMap.set(p.partNo, p);
    }
  }
  next.parts = Array.from(partsMap.values());

  if (!next.bom || typeof next.bom !== 'object') next.bom = { children: {}, parents: {} };
  if (!next.bom.children) next.bom.children = {};
  if (!next.bom.parents) next.bom.parents = {};
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(MASTER_PATH, JSON.stringify(next, null, 2), 'utf-8');
}

// Image folder configuration management
function loadImageConfig() {
  try {
    if (existsSync(IMAGE_CONFIG_PATH)) {
      return JSON.parse(readFileSync(IMAGE_CONFIG_PATH, 'utf-8'));
    }
  } catch { /* ignore */ }
  return { imageFolderPath: null };
}

function saveImageConfig(config) {
  try {
    mkdirSync(dirname(IMAGE_CONFIG_PATH), { recursive: true });
    writeFileSync(IMAGE_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch {
    return false;
  }
}

// Scan rawdata directory for image folders (圖檔 or Drawing)
function scanImageFolders() {
  const RAWDATA_PATH = join(__dirname, 'rawdata');
  const candidates = [];

  function scanDir(dir, depth) {
    if (depth > 3 || !existsSync(dir)) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const name = entry.name.toLowerCase();
          if (name === '圖檔' || name === 'drawing' || name === 'drawings') {
            candidates.push(join(dir, entry.name));
          }
          if (depth < 3) {
            scanDir(join(dir, entry.name), depth + 1);
          }
        }
      }
    } catch { /* ignore scan errors */ }
  }

  scanDir(RAWDATA_PATH, 0);

  // 優先順序：rawdata/圖檔 -> Drawings/Drawing -> 候選清單第一項
  const result = candidates.find(p => p.endsWith('圖檔'))
    ?? candidates.find(p => p.toLowerCase().endsWith('drawings') || p.toLowerCase().endsWith('drawing'))
    ?? candidates[0]
    ?? null;

  return result;
}

// 記憶體快取：避免高頻縮圖請求造成磁碟過度重複遍歷
let mediaFilesCache = null;
let mediaCacheFolder = null;
let mediaCacheTime = 0;

function getCachedMediaFiles(folder) {
  const now = Date.now();
  if (mediaFilesCache && mediaCacheFolder === folder && (now - mediaCacheTime < 60000)) {
    return mediaFilesCache;
  }
  const files = scanAllMediaFiles(folder);
  mediaFilesCache = files;
  mediaCacheFolder = folder;
  mediaCacheTime = now;
  return files;
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

// Master API — the single source of truth (data/pn-lookup-master.json)
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

// Helper: 深度掃描圖檔資料夾下所有支援的媒體圖檔
function scanAllMediaFiles(folderPath) {
  const IS_MEDIA = /\.(jpe?g|png|gif|webp|bmp|svg|tiff?|pdf)$/i;
  const files = [];
  function walk(dir, rel = '') {
    if (!existsSync(dir)) return;
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = join(dir, entry.name);
        const r = rel ? `${rel}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(full, r);
        } else if (IS_MEDIA.test(entry.name)) {
          files.push({ name: entry.name, relPath: r });
        }
      }
    } catch { /* ignore */ }
  }
  walk(folderPath);
  return files;
}

// Images API — 列出資料庫中所有圖檔列表 (支援自動比對與即時連結)
app.get('/api/images/list', (_req, res) => {
  try {
    const config = loadImageConfig();
    const folder = (config.imageFolderPath && existsSync(config.imageFolderPath))
      ? config.imageFolderPath
      : scanImageFolders();

    if (!folder || !existsSync(folder)) {
      return res.json({ folderName: null, count: 0, files: [] });
    }

    const files = getCachedMediaFiles(folder);
    res.json({
      folderName: basename(folder) || 'Drawings',
      folderPath: folder,
      count: files.length,
      files,
    });
  } catch (err) {
    console.error('掃描圖檔清單失敗:', err);
    res.status(500).json({ error: 'Failed to list images' });
  }
});

// Images API — 串流 / 開啟單張圖檔 (支援 PDF/圖片於瀏覽器直接開啟檢視)
app.get('/api/images/raw', (req, res) => {
  try {
    const config = loadImageConfig();
    const folder = (config.imageFolderPath && existsSync(config.imageFolderPath))
      ? config.imageFolderPath
      : scanImageFolders();

    if (!folder || !existsSync(folder)) {
      return res.status(404).send('Image folder not found');
    }

    const relPath = req.query.path || '';
    const fileName = req.query.name || '';

    let targetPath = null;
    if (relPath) {
      const safeRel = String(relPath).replace(/^[/\\]+/, '');
      const resolved = join(folder, safeRel);
      if (resolved.startsWith(folder) && existsSync(resolved)) {
        targetPath = resolved;
      }
    } else if (fileName) {
      const allFiles = getCachedMediaFiles(folder);
      const hit = allFiles.find((f) => f.name === fileName);
      if (hit) {
        targetPath = join(folder, hit.relPath);
      }
    }

    if (!targetPath || !existsSync(targetPath)) {
      return res.status(404).send('Drawing file not found');
    }

    const ext = targetPath.split('.').pop()?.toLowerCase();
    const mimeMap = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      gif: 'image/gif',
    };
    const contentType = mimeMap[ext] || 'application/octet-stream';
    const baseName = basename(targetPath);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(baseName)}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.sendFile(targetPath);
  } catch (err) {
    console.error('讀取圖檔串流失敗:', err);
    res.status(500).send('Failed to serve image');
  }
});

// Images API — auto-detect folder and save config
app.get('/api/images/detect-folder', (req, res) => {
  try {
    const config = loadImageConfig();
    // 優先返回已保存配置
    if (config.imageFolderPath && existsSync(config.imageFolderPath)) {
      return res.json({
        folder: config.imageFolderPath,
        isAutoDetected: false,
        source: 'config'
      });
    }

    // 執行掃描
    const folder = scanImageFolders();
    res.json({
      folder,
      isAutoDetected: !!folder,
      source: folder ? 'scan' : 'not-found'
    });
  } catch (error) {
    console.error('掃描圖檔資料夾失敗:', error);
    res.status(500).json({
      folder: null,
      error: error.message,
      source: 'error'
    });
  }
});

app.post('/api/images/save-config', (req, res) => {
  const { folder } = req.body || {};
  if (!folder || typeof folder !== 'string') {
    return res.status(400).json({ error: 'folder path is required' });
  }

  try {
    if (!existsSync(folder)) {
      console.warn('Warning: folder path does not verify:', folder);
    }
  } catch (err) {
    console.warn('Warning: could not verify folder path:', folder, err.message);
  }

  const success = saveImageConfig({ imageFolderPath: folder });
  if (success) {
    res.json({ ok: true, folder });
  } else {
    res.status(500).json({ error: 'Failed to save configuration' });
  }
});

// 統一單一入口防禦：非 /api 請求一律自動轉導至前端入口 (3000 端口)
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  // 若使用者在瀏覽器意外輸入 3001，自動重新導向至唯一的前端入口 3000
  res.redirect('http://localhost:3000/PN-Lookup/');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[PN-Lookup API] 後端資料引擎運行中：http://localhost:${PORT}`);
  console.log(`[PN-Lookup UI]  唯一的介面入口請訪問：http://localhost:3000/PN-Lookup/`);
});
