import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const RAW_SEED_PATH = join(ROOT_DIR, 'rawdata', 'master_table_unified.json');
const OUTPUT_PATH = join(ROOT_DIR, 'data', 'pn-lookup-master.json');
const EXTRACT_PATH = join(ROOT_DIR, 'data', 'drawings-extract.json');
const SEMANTIC_PATH = join(ROOT_DIR, 'data', 'semantic-extract.json');
const ICU_PATH = join(ROOT_DIR, 'data', 'icu-parts.json');
const V7_DRAWINGS_PATH = join(ROOT_DIR, 'data', 'drawings_extract_v7.json');
const ASSEMBLY_EXTRACT_PATH = join(ROOT_DIR, 'data', 'assembly_drawings_extract.json');
const SET_EXTRACT_PATH = join(ROOT_DIR, 'data', 'set_drawings_extract.json');
const OCR_RESULTS_PATH = join(ROOT_DIR, 'data', 'ocr_results_141.json');
const MATERIAL_EXTRACT_PATH = join(ROOT_DIR, 'data', 'material_drawings_extract.json');
const MATERIAL_OCR_PATH = join(ROOT_DIR, 'data', 'ocr_results_material_60.json');
const RESIN_EXTRACT_PATH = join(ROOT_DIR, 'data', 'resin_drawings_extract.json');
const RESIN_OCR_PATH = join(ROOT_DIR, 'data', 'ocr_results_resin_2.json');

// 品號正規化（與前端 imageLibrary.normalize 一致）
function norm(s) {
  return String(s || '').replace(/[^A-Z0-9]+/gi, '').toUpperCase();
}

// v7.8.7 圖檔優先管線：將 drawings-extract.json（組件圖/零件圖/物料圖檔名品號 + 組件圖內文 BOM 候選）
// 合併進 master。圖檔為第一事實來源（圖檔證據的品項一定收錄），seed 已提供的品項僅補缺欄位不覆蓋。
export function mergeDrawingsIntoMaster(master, extract) {
  const existing = new Map(master.parts.map((p) => [norm(p.partNo), p]));
  // v7.8.9 別名索引：norm(別稱) → 規範 part（BOM 鍵規範化用）
  for (const p of master.parts) {
    for (const a of (p.alternates || [])) {
      if (!existing.has(norm(a))) existing.set(norm(a), p);
    }
  }
  const bomKey = (x) => {
    const p = existing.get(norm(x));
    return p ? p.partNo : x;
  };
  const catByRole = { 組件: '組件圖候補', 零件: '零件圖', 物料: '物料圖' };

  function addPart(pn, role) {
    if (!pn) return null;
    const n = norm(pn);
    let ex = existing.get(n);
    if (!ex) {
      // v7.8.9 互為別名合併：圖檔寫法命中既有 part 的別稱 → 併入既有實體
      for (const p of existing.values()) {
        if ((p.alternates || []).some((a) => norm(a) === n)) {
          ex = p;
          break;
        }
      }
    }
    if (ex) return ex;
    const p = {
      id: pn, partNo: pn, name: pn, customer: '',
      category: catByRole[role] || '組件圖候補', color: '', material: '',
      moldNo: '', cavity: '',
      notes: '由組件圖檔名識別（v7.8.7 圖檔優先管線）',
      alternates: [],
    };
    master.parts.push(p);
    existing.set(n, p);
    return p;
  }

  function addBomLink(parent, child) {
    parent = bomKey(parent);
    child = bomKey(child);
    if (!parent || !child || parent === child) return;
    if (!master.bom.children[parent]) master.bom.children[parent] = [];
    if (!master.bom.children[parent].includes(child)) master.bom.children[parent].push(child);
    if (!master.bom.parents[child]) master.bom.parents[child] = [];
    if (!master.bom.parents[child].includes(parent)) master.bom.parents[child].push(parent);
  }

  let added = 0;
  // v7.8.8 圖檔為主整合：組件有圖檔 BOM 時，取代 Excel 組件表 children
  // （粒度差異：圖檔展開至最終零件 B06-410-111-1+B-077，Excel 以子組件 SA0001 為單位；
  //  圖檔為目前版次事實來源，且版次差異以圖面為準，如 SA0002 → H00-111-111-4）
  const drawingOwners = new Set();
  for (const it of (extract.items || [])) {
    if ((it.bomLinks || []).length) drawingOwners.add(bomKey(it.filePartNo));
  }
  for (const owner of drawingOwners) {
    const kids = master.bom.children[owner] || [];
    // v7.8.19 取代時保留物料類 children（收縮膜 0.08*14mm / 0.08*14.5mm）：
    // 圖檔提取器不將尺寸規格視為品號 token → 圖檔 BOM 不含收縮膜，但圖面 KEY UNIT 表實有
    // （Gemini 核對 SB0064/SB0065/SB0035/SB0011 證實）→ 圖檔 BOM 與物料 children 合併
    const materialKids = kids.filter((k) => {
      const pk = master.parts.find((p) => norm(p.partNo) === norm(k));
      return pk && pk.category === '物料圖';
    });
    delete master.bom.children[owner];
    for (const k of kids) {
      if (materialKids.includes(k)) continue;
      const arr = master.bom.parents[k];
      if (arr) master.bom.parents[k] = arr.filter((p) => p !== owner);
      if (master.bom.parents[k] && master.bom.parents[k].length === 0) delete master.bom.parents[k];
    }
    if (materialKids.length) master.bom.children[owner] = materialKids;
  }
  for (const it of (extract.items || [])) {
    if (it.filePartNo) {
      const isNew = !existing.has(norm(it.filePartNo));
      const p = addPart(it.filePartNo, it.role);
      if (isNew) added++;
      // v7.8.11 候補降級：無 BOM 的「組件圖候補」依圖內文證據（無零件清單表）歸為零件圖
      if (p && p.category === '組件圖候補' && it.role === '零件' && !(master.bom.children[p.partNo] || []).length) {
        p.category = '零件圖';
        p.notes = '由組件圖檔名識別，圖內文無零件清單（v7.8.11 降級為零件圖）';
      }
      // v7.8.14 SPC 圖號修正後：既有單品零件若有組件圖（內文零件清單）→ 升級為組件圖候補
      // v7.8.20 擴及「零件圖」（v7.8.11 無 BOM 證據降級者）：新證據（無表頭 BOM 版式組件圖）
      // 出現 → 一併升級（R1-2357/R1-8392/MDXE-*_E 等）
      if (p && (p.category === '單品零件' || p.category === '零件圖') && it.role === '組件' && (it.bomLinks || []).length) {
        p.category = '組件圖候補';
        p.notes = '由組件圖檔名識別，圖內文有零件清單（v7.8.20 無表頭 BOM 版式判別）';
      }
    }
    for (const l of (it.bomLinks || [])) {
      addPart(l.assembly, '組件');
      addPart(l.child, '零件');
      addBomLink(l.assembly, l.child);
    }
  }
  master.totalParts = master.parts.length;
  return { added };
}

// v7.9.0 語意合併：semantic-extract.json（LLM 語意識別：品名規格/圖號/原料/BOM）→ master
// 優先序：seed Excel 欄位 > 語意（seed 有值時語意不覆寫；僅補缺），檔名品號已由 v7.8.x 管線收錄
// 語意 BOM 僅「補充」既有組件圖 children 缺漏（MDXE-153-02 之 22-69xxxx 管路品號）
export function mergeSemanticIntoMaster(master, semantic) {
  const existing = new Map(master.parts.map((p) => [norm(p.partNo), p]));
  let materialFilled = 0, nameFilled = 0, dwgAdded = 0, descAdded = 0, bomAdded = 0;

  // 語意 material 雜訊過濾：供應商/色料行、純品號樣式（HOO-111-111-1）、無意義詞（FABBED）
  const isJunkMaterial = (s) => {
    if (!s) return true;
    const t = s.trim();
    if (!t) return true;
    if (/^(FABBED|N\/A|NONE|NA)$/i.test(t)) return true;
    if (/UB!|FAR EAST|BABF|HELIOGEN|COLORANT|DESCRIPTION/i.test(t)) return true;
    if (/^[A-Z0-9]+(?:-[A-Z0-9]+)+$/i.test(t)) return true; // 品號樣式（HOO-111-111-1）
    return false;
  };
  const isJunkDescription = (s) => !s || String(s).trim().length > 160 || /\.\.\s/.test(s);

  // v7.9.1 BOM 補缺品號白名單：語意 BOM 子件僅收錄有效品號格式，過濾材質/品名/模具號/尺寸雜訊
  const PN_RE = /^(?:[A-Z]{1,4}\d{1,4}(?:-\d{1,4}){1,3}[A-Z0-9]?|[A-Z]{2,4}\d{4,7}|\d{1,2}[A-Z]\d{3,6}|\d{4,}(?:-\d+)*|\d{2,3}(?:-\d+){1,3})$/i;
  const PN_JUNK_RE = /^(SHRINK|STOPPER|BAG|CAP|VENT|N\/A|NONE|TRANS|BENISON|HANNAH|JIAN|IR\s*NIPOL|POLY|PVC|ABS|PE|HDPE|LDPE|FABRIC|RUBBER|SILICONE|O-RING|LATCH|LOCK|SEAL|SPRING|GASKET|\d{1,3}(?:\.\d+)?mm?|0\.0\d+.*|9494|TRANS\s*9494)$/i;
  const PN_MOULDEX_RE = /^M\d{3,4}-R\d+$/i;
  // 語意 BOM 補缺排除清單（使用者確認之模型誤讀品號）
  const PN_MANUAL_BLACKLIST = /^(BO6-410-311-1|HO0-111-041-1|HOO-111-111-4|HOO-111-341-1|HOO0-111-131-5|A01-210-131|E13-999-421-5)$/i;

  for (const it of (semantic.items || [])) {
    if (!it.ok || !it.data) continue;
    const pn = it.data.partNo;
    if (!pn) continue;
    const p = existing.get(norm(pn));
    if (!p) continue;
    const d = it.data;

    if (d.description && !isJunkDescription(d.description)) {
      if (!p.description) { p.description = d.description; descAdded++; }
    }
    if (d.dwgNo) {
      if (!p.dwgNo) { p.dwgNo = d.dwgNo; dwgAdded++; }
      else if (p.dwgNo !== d.dwgNo) {
        // 版本/寫法差異（135-015 vs VLV-135-015、403801 vs 8003875）：語意與既有衝突時保留既有（seed/早期管線優先）
      }
    }
    if (d.material && !isJunkMaterial(d.material)) {
      if (!p.material) { p.material = d.material; materialFilled++; }
    }
    if (d.description && !isJunkDescription(d.description) && (!p.name || p.name === pn)) {
      p.name = d.description; nameFilled++;
    }
    // 語意 BOM 補缺：只針對既有組件圖 children（組件鍵存在才補），僅收錄 master 尚未收錄的子件
    const kids = master.bom.children[p.partNo];
    if (kids && kids.length && Array.isArray(d.bom) && d.bom.length) {
      for (const b of d.bom) {
        const childNo = String(b.partNo || '').trim();
        if (!childNo || norm(childNo) === norm(pn)) continue;
        if (kids.some((k) => norm(k) === norm(childNo))) continue;
        // 品號格式白名單：不符合 → 略過（材質/品名/模具號/尺寸雜訊不收錄）
        if (!PN_RE.test(childNo) || PN_JUNK_RE.test(childNo) || PN_MOULDEX_RE.test(childNo) || PN_MANUAL_BLACKLIST.test(childNo)) {
          console.log(`  [BOM 雜訊略過] ${pn} → ${childNo}（${(b.description || '').slice(0, 30)}）`);
          continue;
        }
        if (!existing.has(norm(childNo))) {
          master.parts.push({
            id: childNo, partNo: childNo, name: b.description || childNo, customer: '',
            category: '零件', color: '', material: b.material || '',
            moldNo: '', cavity: '',
            notes: '由語意 BOM 補缺識別（v7.9.0 圖檔語意識別）',
            alternates: [],
          });
          existing.set(norm(childNo), master.parts[master.parts.length - 1]);
        }
        master.bom.children[p.partNo].push(childNo);
        if (!master.bom.parents[childNo]) master.bom.parents[childNo] = [];
        if (!master.bom.parents[childNo].includes(p.partNo)) master.bom.parents[childNo].push(p.partNo);
        bomAdded++;
      }
    }
  }
  master.totalParts = master.parts.length;
  return { materialFilled, nameFilled, dwgAdded, descAdded, bomAdded };
}

export function convertUnifiedSeedToMaster(seedData) {
  const partsMap = new Map();

  // 別稱只接受品號格式（排除備註/說明文字被誤錄為別稱），且不得為自身品號
  function sanitizeAlternates(alts, selfPartNo = '') {
    if (!Array.isArray(alts)) return [];
    return Array.from(new Set(alts.filter((a) => typeof a === 'string' && /^[A-Z0-9][A-Z0-9.\-]*$/i.test(a) && a !== selfPartNo)));
  }

  function addPart(p) {
    if (!p.partNo) return;
    const alternates = sanitizeAlternates(p.alternates, p.partNo);
    // 以正規化品號為 key 去重：同一品號不同寫法（如 E09-000412-1 vs E09-000-412-1）合併，
    // 後到者的寫法保留為別稱，避免前端索引衝突
    const key = norm(p.partNo);
    let existing = partsMap.get(key);
    if (!existing) {
      // v7.8.9 互為別名合併：新品號是既有 part 的別稱（如 R1-8112 ∈ E13-999-421.alternates），
      // 或新品號別稱是既有 partNo → 併入既有單一實體，避免 BOM 鍵分裂（雙實體各自掛不同組件）
      for (const ex of partsMap.values()) {
        if (ex.alternates.some((a) => norm(a) === key)) {
          existing = ex;
          break;
        }
      }
      if (!existing) {
        const hit = alternates.find((a) => partsMap.has(norm(a)));
        if (hit) existing = partsMap.get(norm(hit));
      }
    }
    if (!existing) {
      partsMap.set(key, {
        id: p.partNo,
        partNo: p.partNo,
        name: p.name || p.partNo,
        customer: p.customer || '',
        category: p.category || '單品零件',
        color: p.color || '',
        material: p.material || '',
        moldNo: p.moldNo || '',
        cavity: p.cavity || '',
        notes: p.notes || '',
        alternates,
      });
    } else {
      if (existing.partNo !== p.partNo && !alternates.includes(p.partNo)) {
        existing.alternates = sanitizeAlternates([...existing.alternates, p.partNo], existing.partNo);
      }
      if (!existing.customer && p.customer) existing.customer = p.customer;
      if ((!existing.name || existing.name === existing.partNo) && p.name) existing.name = p.name;
      if (!existing.color && p.color) existing.color = p.color;
      if (!existing.material && p.material) existing.material = p.material;
      if (!existing.moldNo && p.moldNo) existing.moldNo = p.moldNo;
      if (!existing.cavity && p.cavity) existing.cavity = p.cavity;
      if (alternates.length > 0) {
        existing.alternates = sanitizeAlternates([...existing.alternates, ...alternates], existing.partNo);
      }
      return existing;
    }
  }

  // 1. internalParts
  if (Array.isArray(seedData.internalParts)) {
    for (const ip of seedData.internalParts) {
      const partNo = ip['產品編號'] || ip['partNo'];
      if (!partNo) continue;
      // 別稱來源：客戶零件編號 + 舊版廠內品號（舊編號亦可能出現在圖檔檔名）
      const alternates = [];
      if (ip['零件編號(客)']) alternates.push(ip['零件編號(客)']);
      if (ip['產品編號(舊)']) alternates.push(ip['產品編號(舊)']);
      addPart({
        partNo,
        name: ip['零件名稱(中)'] || ip['零件名稱(英)'] || partNo,
        customer: ip['客戶'] || '',
        color: ip['顏色'] || '',
        material: ip['原料'] || '',
        moldNo: ip['模具號碼'] || '',
        cavity: ip['穴數'] || '',
        alternates,
      });
    }
  }

  // 2. customerParts
  if (Array.isArray(seedData.customerParts)) {
    for (const cp of seedData.customerParts) {
      const partNo = cp['產品編號'] || cp['品號'] || cp['partNo'];
      if (!partNo) continue;
      addPart({
        partNo,
        name: cp['零件名稱(中)'] || cp['品名'] || partNo,
        customer: cp['客戶'] || '',
      });
    }
  }

  // 3. customerPartNumbers
  // 欄位語意：產品編號=廠內品號、零件編號(客)=客戶料號、圖面編號=客戶圖面編號（常出現於圖檔檔名）
  if (Array.isArray(seedData.customerPartNumbers)) {
    for (const cpn of seedData.customerPartNumbers) {
      const internalNo = cpn['產品編號'] || cpn['partNo'];
      const custNo = cpn['零件編號(客)'] || cpn['customerPartNo'];
      const drawingNo = cpn['圖面編號'] || '';
      const name = cpn['零件名稱(英)'] || cpn['零件名稱(中)'] || internalNo || custNo;

      if (internalNo) {
        // 廠內品號：掛上客戶料號 + 圖面編號做別稱（圖面編號剝除 -MC 後綴；-MC = Mouldex Component 客戶來源標記，不屬品號，如 R1-2255-MC → R1-2255）
        addPart({
          partNo: internalNo,
          name,
          customer: cpn['客戶'] || '',
          color: cpn['顏色'] || '',
          material: cpn['原料'] || '',
          moldNo: cpn['模具號碼'] || '',
          cavity: cpn['穴數'] || '',
          alternates: [custNo, drawingNo.replace(/-MC$/i, '')].filter(Boolean),
        });
      }
      if (custNo && custNo !== internalNo) {
        // 客戶料號本身亦為有效品項，圖面編號（剝除 -MC 後綴）為其別稱
        addPart({
          partNo: custNo,
          name: cpn['零件名稱(英)'] || cpn['零件名稱(中)'] || custNo,
          customer: cpn['客戶'] || '',
          moldNo: cpn['模具號碼'] || '',
          cavity: cpn['穴數'] || '',
          alternates: [internalNo || drawingNo.replace(/-MC$/i, '')].filter(Boolean),
        });
      }
    }
  }

  // 5. scannedAssemblies（組件圖識別補登，2026-08-17 起：rawdata/圖檔 中組件圖檔名對應的組件品號）
  //    這些品號存在於組件圖（含子件），但未收錄於 Excel 種子工作表；由掃描回饋補登，作為組件鍵使用。
  if (Array.isArray(seedData.scannedAssemblies)) {
    for (const sa of seedData.scannedAssemblies) {
      const partNo = sa['產品編號'] || sa.partNo;
      if (!partNo) continue;
      addPart({
        partNo,
        name: sa['零件名稱(中)'] || sa['零件名稱(英)'] || partNo,
        customer: sa['客戶'] || '',
        category: '組件圖候補',
        notes: sa['備註'] || '由組件圖識別補登',
      });
    }
  }

  // 6. bomHierarchy
  const childrenMap = {};
  const parentsMap = {};

  // v7.8.9 BOM 鍵規範化：parent/child 先解析為規範品號（norm 索引含 alternates），
  // 避免同一品號兩種寫法（如 E13-999-421 ≡ R1-8112）在 BOM 結構中分裂為兩個鍵
  const bomNormIndex = new Map();
  for (const p of partsMap.values()) {
    bomNormIndex.set(norm(p.partNo), p.partNo);
    for (const a of p.alternates) bomNormIndex.set(norm(a), p.partNo);
  }
  const bomKey = (x) => bomNormIndex.get(norm(x)) || x;

  function addBomLink(parent, child) {
    parent = bomKey(parent);
    child = bomKey(child);
    if (!parent || !child) return;
    if (parent === child) return;
    if (!childrenMap[parent]) childrenMap[parent] = [];
    if (!childrenMap[parent].includes(child)) childrenMap[parent].push(child);

    if (!parentsMap[child]) parentsMap[child] = [];
    if (!parentsMap[child].includes(parent)) parentsMap[child].push(parent);
  }

  if (seedData.bomHierarchy && typeof seedData.bomHierarchy === 'object') {
    for (const levelKey of Object.keys(seedData.bomHierarchy)) {
      const list = seedData.bomHierarchy[levelKey];
      if (Array.isArray(list)) {
        for (const item of list) {
          const assemblyId = item.assemblyId || item.id;
          if (!assemblyId) continue;
          const asm = addPart({
            partNo: assemblyId,
            name: item.name || assemblyId,
            category: levelKey + '組立',
          });
          // v7.8.17 組立表優先：seed 零件表先行建檔的組立（如 SA0145）category 為「單品零件」時，
          // 以 bomHierarchy 組立表為事實來源升級為組立類別（組件鍵與類別一致）
          if (asm && (asm.category === '單品零件' || !asm.category)) {
            asm.category = levelKey + '組立';
          }
          if (Array.isArray(item.children)) {
            for (const child of item.children) {
              const childNo = typeof child === 'string' ? child : (child.partNo || child.id);
              // v7.8.8 過濾 Excel 組件表雜訊（非品號 token：日期連寫等）
              // v7.8.19 收縮膜收錄為物料：seed 組立表以尺寸當 partNo（0.08*14mm / 0.08*14.5mm，name=收縮膜），
              // 圖面 BOM（KEY UNIT 表）亦以尺寸呈現（0.08X14mm 同物）→ 白名單放行，其餘含 * 仍為雜訊過濾
              const SHRINK_BAND_RE = /^0\.08\*14(?:\.5)?mm$/i;
              if (!childNo) continue;
              if (!SHRINK_BAND_RE.test(childNo) && (!/^[A-Z0-9][A-Z0-9_.\-]*$/i.test(childNo) || /\*/.test(childNo))) continue;
              addBomLink(assemblyId, childNo);
              addPart({
                partNo: childNo,
                name: typeof child === 'object' ? child.name : childNo,
                ...(SHRINK_BAND_RE.test(childNo) ? { category: '物料圖' } : {}),
              });
            }
          }
        }
      }
    }
  }

  // 7. pnAliases（簡稱 → 正式品號，如 X3299 → X3299AAM；簡稱亦為別稱，使檔名比對/搜尋皆可命中）
  if (seedData.pnAliases && typeof seedData.pnAliases === 'object') {
    for (const [alias, canonical] of Object.entries(seedData.pnAliases)) {
      const target = partsMap.get(norm(canonical));
      if (!target) {
        addPart({ partNo: canonical, name: canonical, alternates: [alias] });
        continue;
      }
      target.alternates = sanitizeAlternates([...target.alternates, alias]);
    }
  }

  const parts = Array.from(partsMap.values());
  return {
    type: 'pn-lookup-master',
    version: '3.1.0',
    parts,
    bom: {
      children: childrenMap,
      parents: parentsMap,
    },
    totalParts: parts.length,
  };
}

// v7.9.1 ICU 原料料號對照表：合併 ICU 零件（覆蓋 material/color/moldNo/cavity/dwgNo，新增不存在品號）
export function mergeICUPartsIntoMaster(master, icuParts) {
  const existing = new Map(master.parts.map((p) => [norm(p.partNo), p]));
  let updated = 0, added = 0;

  for (const icu of icuParts) {
    const n = norm(icu.partNo);
    const ex = existing.get(n);

    if (ex) {
      // 已存在：以 Excel 為主覆蓋 material（及 color/moldNo/cavity/dwgNo）
      if (icu.material) ex.material = icu.material;
      if (icu.color) ex.color = icu.color;
      if (icu.moldNo) ex.moldNo = icu.moldNo;
      if (icu.cavity) ex.cavity = String(icu.cavity);
      if (icu.dwgNo) ex.dwgNo = icu.dwgNo;
      // name：英文名為主，中文名為輔
      if (icu.nameEN && !ex.description) ex.description = icu.nameEN;
      if (icu.nameCN && (!ex.name || ex.name === ex.partNo)) ex.name = icu.nameCN;
      updated++;
    } else {
      // 新品號：收錄為零件
      master.parts.push({
        id: icu.partNo,
        partNo: icu.partNo,
        name: icu.nameCN || icu.nameEN || icu.partNo,
        customer: icu.customer || 'ICU',
        category: '零件',
        color: icu.color || '',
        material: icu.material || '',
        moldNo: icu.moldNo || '',
        cavity: icu.cavity || '',
        notes: '由ICU原料料號對照表導入',
        alternates: [],
        description: icu.nameEN || '',
        dwgNo: icu.dwgNo || '',
      });
      existing.set(n, master.parts[master.parts.length - 1]);
      added++;
    }
  }

  return { updated, added };
}

// v7.9.5 圖檔工程最新成果融合：drawings_extract_v7.json（9大欄位整合與組件/SET結構化BOM）
export function mergeV7DrawingsIntoMaster(master, v7Data) {
  const partsMap = new Map(master.parts.map((p) => [norm(p.partNo), p]));
  let matCnt = 0, colCnt = 0, dwgCnt = 0, descCnt = 0, catCnt = 0, bomDetailCnt = 0;

  const drawingsByPn = new Map();
  for (const it of (v7Data.items || [])) {
    const pn = it.partNo;
    if (!pn) continue;
    const n = norm(pn);
    if (!drawingsByPn.has(n)) drawingsByPn.set(n, []);
    drawingsByPn.get(n).push(it);
  }

  for (const p of master.parts) {
    const n = norm(p.partNo);
    const dwgList = drawingsByPn.get(n);
    if (dwgList && dwgList.length > 0) {
      let bestDwg = dwgList[0];
      for (const d of dwgList) {
        if (d.materialCode || (d.bom && d.bom.length)) {
          bestDwg = d;
          break;
        }
      }

      // 1. 圖檔檔名
      if (bestDwg.fileName) p.drawingFileName = bestDwg.fileName;
      // 2. 圖號
      if (bestDwg.drawingNo) {
        p.dwgNo = bestDwg.drawingNo;
        dwgCnt++;
      } else if (!p.dwgNo) {
        p.dwgNo = p.partNo;
      }
      // 3. 版本
      if (bestDwg.revision) p.revision = bestDwg.revision;
      // 5. 品名原文/描述
      if (bestDwg.description && (!p.description || p.description === p.partNo)) {
        p.description = bestDwg.description;
        descCnt++;
      }
      // 6. 顏色
      if (bestDwg.color && !p.color) {
        p.color = bestDwg.color;
        colCnt++;
      }
      // 7. 原料名稱
      if (bestDwg.materialName && (!p.material || p.material === '零件' || p.material === 'N/A')) {
        p.material = bestDwg.materialName;
        matCnt++;
      }
      // 8. 原料編碼
      if (bestDwg.materialCode) p.materialCode = bestDwg.materialCode;

      // 分類校正 (組件)
      if (bestDwg.category === '組件' && (p.category === '零件' || p.category === '單品零件' || p.category === '零件圖')) {
        p.category = '其他組件';
        catCnt++;
      }
    }

    // 9. 組件/SET 結構化 BOM 零件清單 (單位用量、品號、品名、原料名稱、原料編號)
    const isAssyOrSet = (p.category && (p.category.includes('組件') || p.category.includes('組立') || p.category === 'SET'));
    if (isAssyOrSet) {
      const bomDetails = [];
      const v7Boms = [];
      if (dwgList) {
        for (const d of dwgList) {
          if (d.bom && d.bom.length) v7Boms.push(...d.bom);
        }
      }

      if (v7Boms.length > 0) {
        for (const b of v7Boms) {
          const cpn = (b.partNo || '').trim();
          if (!cpn) continue;
          const childPart = partsMap.get(norm(cpn));
          bomDetails.push({
            partNo: cpn,
            name: b.description || (childPart ? (childPart.name || childPart.description) : cpn),
            qty: String(b.qty || '1'),
            material: b.material || (childPart ? childPart.material : '') || '',
            materialCode: (childPart ? childPart.materialCode : '') || '',
          });
        }
      } else {
        const childPns = (master.bom && master.bom.children && master.bom.children[p.partNo]) || [];
        for (const cpn of childPns) {
          const childPart = partsMap.get(norm(cpn));
          bomDetails.push({
            partNo: cpn,
            name: childPart ? (childPart.name || childPart.description || cpn) : cpn,
            qty: '1',
            material: (childPart ? childPart.material : '') || '',
            materialCode: (childPart ? childPart.materialCode : '') || '',
          });
        }
      }

      if (bomDetails.length > 0) {
        p.bomDetails = bomDetails;
        bomDetailCnt++;
      }
    }
  }

  return { matCnt, colCnt, dwgCnt, descCnt, catCnt, bomDetailCnt };
}

// v7.10.10 圖檔版本號全覆蓋提取器：支援多種業界命名慣例與 fallback
export function extractRevision(fn, name, desc) {
  if (fn) {
    const base = fn.replace(/\.(pdf|png|jpe?g|webp)$/i, '');
    // 1. (Rev.A) or [Rev.A] or (Rev.01)
    let m = base.match(/[([\[]\s*[Rr][Ee][Vv][.\s]*([A-Z0-9]+)\s*[)\]]/);
    if (m) return 'Rev.' + m[1].toUpperCase();

    // 2. _Rev.A or -Rev.A or _Rev_A or _Rev-A
    m = base.match(/[_\-\s][Rr][Ee][Vv][._\-\s]*([A-Z0-9]+)(?:[_\-\s.]|$)/);
    if (m) return 'Rev.' + m[1].toUpperCase();

    // 3. SPC0005450_04_RAW0000336
    m = base.match(/SPC\d+_(\d{2})_/i);
    if (m) return 'Rev.' + m[1];

    // 4. MC_08_mdx or -MC_08
    m = base.match(/MC_(\d{2})(?:_mdx|$)/i);
    if (m) return 'Rev.' + m[1];

    // 5. _A02-signed or _A021-signed
    m = base.match(/_([A-Z]\d{2,3})(?:-signed|\.|$)/i);
    if (m) return 'Rev.' + m[1].toUpperCase();

    // 6. Holder_2
    m = base.match(/Holder_(\d+)/i);
    if (m) return 'Rev.' + m[1];
  }

  // 7. Fallback: 品名規格原文中之版次字串 (如 "Boot, CA ASM, Rev.07")
  const text = (name || '') + ' ' + (desc || '');
  let mText = text.match(/[Rr][Ee][Vv][.\s]*([A-Z0-9]+)/);
  if (mText) return 'Rev.' + mText[1].toUpperCase();

  return null;
}

// v7.10.10 磁碟掃描補遺：對 drawingFileName / revision 缺失的品號進行深度關聯與版本補齊
export function repairMissingDrawingLinks(master, drawingDirs) {
  const pdfList = []; // { fileName, normClean, fullNorm }

  function scanDir(dir) {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const ent of entries) {
      if (ent.isDirectory()) { scanDir(dir + '/' + ent.name); continue; }
      if (!ent.name.toLowerCase().endsWith('.pdf')) continue;
      const base = ent.name.replace(/\.pdf$/i, '');
      const clean = base.replace(/\s*[([\[].*?[)\]]/g, '').trim();
      const normClean = clean.replace(/[^A-Z0-9]/gi, '').toUpperCase();
      pdfList.push({ fileName: ent.name, normClean, fullNorm: norm(base) });
    }
  }

  for (const dir of (drawingDirs || [])) scanDir(dir.replace(/\\/g, '/'));

  let linked = 0, revFilled = 0;

  for (const p of master.parts) {
    const candidates = [p.partNo, ...(p.alternates || [])].filter(Boolean);

    // 1. 如果已有 drawingFileName，但缺少 revision，強制重新提取 revision
    if (p.drawingFileName) {
      if (!p.revision || String(p.revision).trim() === '' || p.revision === '-' || p.revision === 'N/A') {
        const rev = extractRevision(p.drawingFileName, p.name, p.description);
        if (rev) {
          p.revision = rev;
          revFilled++;
        }
      }
      continue;
    }

    // 2. 針對尚無 drawingFileName 者，比對 partNo 與 alternates
    let matchedFile = null;
    for (const c of candidates) {
      const cn = norm(c);
      if (cn.length < 3) continue;

      const exact = pdfList.find((f) => f.normClean === cn || f.fullNorm.includes(cn));
      if (exact) {
        matchedFile = exact.fileName;
        break;
      }
    }

    // 前綴模糊比對 (長度 >= 8)
    if (!matchedFile) {
      for (const c of candidates) {
        const cn = norm(c);
        if (cn.length >= 8) {
          const prefixHit = pdfList.find((f) => {
            const minLen = Math.min(cn.length, f.normClean.length, 14);
            return minLen >= 8 && f.normClean.startsWith(cn.substring(0, minLen));
          });
          if (prefixHit) {
            matchedFile = prefixHit.fileName;
            break;
          }
        }
      }
    }

    if (matchedFile) {
      p.drawingFileName = matchedFile;
      linked++;
      if (!p.revision || String(p.revision).trim() === '' || p.revision === '-' || p.revision === 'N/A') {
        const rev = extractRevision(matchedFile, p.name, p.description);
        if (rev) {
          p.revision = rev;
          revFilled++;
        }
      }
    }
  }

  return { linked, revFilled };
}

// v7.10.12 零件原料名稱與顏色全覆蓋富化器：根據原廠工程圖面、Mouldex 輸液管編碼規範 (cx-******) 與客戶 BOM 完整補齊
export function enrichPartMaterialsAndColors(master) {
  const PART_MATERIALS = {
    '8013945': 'HDPE UNITHENE LH606, BLUE',
    'RMS-341920': 'PP BORMED HD810MO, WHITE',
    'KORU-341976': 'HDPE UNITHENE LH606, WHITE',
    'VLV-145-057': 'Polypropylene, BORMED HD810MO, Natural',
    '4500Standard': 'PP Pro-Fax 6331, LAVENDER',
    '245204024': 'PC MAKROLON 1805 451118 IA',
    'HLK-005-NFV': 'PC / Silicone',
    'B05-240-111': 'ABS TOYOLAC 900',
    'D09-410-131': 'ABS TERLUX 2802',
    'H00-111-131-1': 'ABS TERLUX 2802',
    'A02-200-131': 'ABS TERLUX 2802',
    'E11-000-412': 'HDPE UNITHENE LH606, WHITE',
    'E10-001-618': 'PP GLOBALENE 6331',
    'TA161BEPTG002B00': 'PVDF FORTEX MEMBRANE / PP',
    'CP96020': 'ABS TOYOLAC 900',
    'B-081': 'PC MAKROLON RX2530 / Silicone',
    '11-021525': 'COLORITE PVC 7477G-015',
    '11-022032': 'COLORITE PVC 7477G-015',
    '11-080273': 'COLORITE PVC 7477G-015',
    '11-082032': 'COLORITE PVC 7477G-015',
    '11-352032': 'COLORITE PVC 7477G-015',
    '11-220290N': 'PVC 7477G-015 (Non-DEHP)',
    '11-221250N': 'PVC 7477G-015 (Non-DEHP)',
    '16-680035': 'NAN-YA PVC 3MSA048P3X000',
    '16-680040': 'NAN-YA PVC 3MSA048P3X000',
    '16-680058': 'NAN-YA PVC 3MSA048P3X000',
    '16-680085': 'NAN-YA PVC 3MSA048P3X000',
    'R1-7762': 'Polyethylene (PE)',
    'R1-2536': 'Silicone Rubber',
    'R1-2535': 'Stainless Steel 302',
    'R1-8390': 'Silicone Rubber',
    'AMSINO-SDW140111': 'ABS TERLUX 2802 / B膠',
    'AMSINO-SDW140112': 'PVC Geon M4910 / B膠',
    'BC00611SA': 'PVC Tubing / PC Connectors',
    'AF07001': 'PVC Tubing / PC Connectors',
    'DB00801': 'PVC Tubing / PC Connectors',
    'DB00803': 'PVC Tubing / PC Connectors',
    'DC00601': 'PVC Tubing / PC Connectors',
    'EF01601': 'PVC Tubing / PC Connectors'
  };

  const PART_COLORS = {
    // 1. 有圖檔品項 (29 筆)
    '8013945': 'Blue (藍)',
    'RMS-341920': 'White (白)',
    'RMS-341950': 'White (白)',
    'RMS-342303': '本',
    'KORU-341976': 'White (白)',
    'VLV-145-057': 'Natural (本色)',
    '4500Standard': 'Lavender (薰衣草紫)',
    'MS0151694': 'Lavender (薰衣草紫)',
    'H00-111-131-1': '本',
    'H00-111-341': '本',
    'H00-111-1': '本',
    'D09-279-1': '本',
    'N20-208-13': '本',
    '11-350075': '本',
    '11-350100': '本',
    '11-080900': '本',
    '11-110130': '本',
    '11-353050': '本',
    '11-610160': '本',
    '12-110130': '本',
    '1L-370100': '本',
    'VLV-135-015': 'Natural (本色)',
    'VLV-138-003': 'Clear / Blue Hue (透明帶藍)',
    'VLV-141-004': 'Natural (本色)',
    'VLV-141-007': 'Natural (本色)',
    'VLV-141-010': '黃銅色 (Brass)',
    'R1-15356': '本',
    'R1-15466': 'White (白)',
    'R1-2384': 'Clear (透明)',

    // 2. 無獨立圖檔品項 (39 筆)
    '22-690250': 'Tea Color (茶色)',
    '22-691000': 'Tea Color (茶色)',
    '22-690300': 'Tea Color (茶色)',
    '22-690200': 'Tea Color (茶色)',
    '22-690100': 'Tea Color (茶色)',
    '22-690150': 'Tea Color (茶色)',
    'R1-3152': 'Blue (藍)',
    'TA161BEPTG002B00': 'White (白)',
    'E11-000-412': 'White (白)',
    'A01-350-112': 'White (白)',
    '11-021525': '本',
    '11-022032': '本',
    '11-080273': '本',
    '11-082032': '本',
    '11-352032': '本',
    '11-220290N': '本',
    '11-221250N': '本',
    '16-680035': '本',
    '16-680040': '本',
    '16-680058': '本',
    '16-680085': '本',
    'B05-240-111': '本',
    'D09-410-131': '本',
    'A02-200-131': '本',
    'H01-240-111': '本',
    'A01-111-131-5': '本',
    'H000-111-131': '本',
    'H00-111-251': '本',
    'CP96020': '本',
    'CI1-111-251': '本',
    'R1-2535': '金屬原色 (Metallic)',
    'R1-2536': '半透明 (Translucent)',
    'R1-8390': '半透明 (Translucent)',
    'R1-7762': '本',
    '245204024': 'Clear (透明)',
    '451118': 'Clear (透明)',
    'HLK-005-NFV': 'Clear (透明)',
    'B-081': 'Clear (透明)',
    'E10-001-618': '本'
  };

  const CATEGORY_CORRECTIONS = {
    'BC00611SA': '其他組件',
    'AF07001': 'SET',
    'DB00801': 'SET',
    'DB00803': 'SET',
    'DC00601': 'SET',
    'EF01601': 'SET',
    'AMSINO-SDW140111': 'SB組立',
    'AMSINO-SDW140112': 'SB組立'
  };

  let matFilled = 0, colFilled = 0, catFixed = 0;
  for (const p of master.parts) {
    if (PART_MATERIALS[p.partNo] && (!p.material || p.material === '零件' || p.material === 'N/A' || p.material === '-' || p.material === 'NONE')) {
      p.material = PART_MATERIALS[p.partNo];
      matFilled++;
    }
    if (PART_COLORS[p.partNo] && (!p.color || p.color === 'N/A' || p.color === '-' || p.color === 'NONE')) {
      p.color = PART_COLORS[p.partNo];
      colFilled++;
    }
    if (CATEGORY_CORRECTIONS[p.partNo] && (p.category === '零件' || p.category === '單品零件')) {
      p.category = CATEGORY_CORRECTIONS[p.partNo];
      catFixed++;
    }
  }

  return { matFilled, colFilled, catFixed };
}

// v7.11.0 以圖檔為唯一真實來源 (Drawing as SSOT) 全鏈路管線重構
export function applyDrawingSSOT(master) {
  const v7Extract = existsSync(V7_DRAWINGS_PATH) ? JSON.parse(readFileSync(V7_DRAWINGS_PATH, 'utf-8')).items : [];
  const assyExtract = existsSync(ASSEMBLY_EXTRACT_PATH) ? JSON.parse(readFileSync(ASSEMBLY_EXTRACT_PATH, 'utf-8')).items : [];
  const setExtract = existsSync(SET_EXTRACT_PATH) ? JSON.parse(readFileSync(SET_EXTRACT_PATH, 'utf-8')).items : [];
  const matExtract = existsSync(MATERIAL_EXTRACT_PATH) ? JSON.parse(readFileSync(MATERIAL_EXTRACT_PATH, 'utf-8')).parts : [];
  const resinExtract = existsSync(RESIN_EXTRACT_PATH) ? JSON.parse(readFileSync(RESIN_EXTRACT_PATH, 'utf-8')).parts : [];

  const fileIndex = new Map();
  for (const x of [...v7Extract, ...assyExtract, ...setExtract, ...matExtract, ...resinExtract]) {
    if (x.fileName && !fileIndex.has(x.fileName.toLowerCase())) {
      fileIndex.set(x.fileName.toLowerCase(), x);
    }
  }

  let dwgNoFixed = 0, revFixed = 0;

  for (const p of master.parts) {
    p.hasDrawing = Boolean(p.drawingFileName);

    if (p.drawingFileName) {
      const ext = fileIndex.get(p.drawingFileName.toLowerCase());
      if (ext) {
        // 1. 工程圖號 SSOT: 圖檔 Title Block 優先覆寫 Excel 筆誤與子件錯位
        const extDwg = (ext.drawingNo || ext.dwgNo || '').trim();
        const curDwg = (p.dwgNo || '').trim();
        if (extDwg && extDwg !== curDwg) {
          p.dwgNo = extDwg;
          dwgNoFixed++;
        }

        // 2. 工程版次 SSOT: 圖檔 Title Block / Revision Table 最新版次優先
        let extRev = (ext.revision || '').replace(/^Rev\.?/i, '').replace(/\.$/, '').trim();
        if (p.partNo === '126-006') extRev = 'A';
        if (p.partNo === '9X.20860.005') extRev = 'A02';
        if (p.partNo === 'SB0063') extRev = 'A';

        let curRev = (p.revision || '').replace(/^Rev\.?/i, '').replace(/\.$/, '').trim();
        if (extRev && extRev !== curRev) {
          p.revision = extRev;
          revFixed++;
        }
      }
    }
  }

  // 3. 原料材質 (Material) 6 項重大聚合物家族矛盾裁決與字串清洗
  const MATERIAL_RESOLUTIONS = {
    'A01-410-251': 'ABS TOYOLAC 900',
    'CIV0000230': 'ABS NATURAL (RADIATION GRADE), INEOS ABS USA, P/N: 348-000000 NAT; RED COLORANT, ABS, 2%, AVIENT CORPORATION, P/N: CC10183010WE',
    'R1-15201': 'ABS TAITALAC 1000 W-767 / LDPE NA-207-66',
    'R1-8190': 'LDPE NA-207-66 / ABS TAITALAC 1000 W-767',
    'PE004': 'PE 塑膠袋 (Polyethylene)',
    'R1-15466': 'CAP: HDPE, STRAP: PVC 8577G-015'
  };

  let matResolved = 0;
  for (const p of master.parts) {
    if (MATERIAL_RESOLUTIONS[p.partNo]) {
      p.material = MATERIAL_RESOLUTIONS[p.partNo];
      matResolved++;
    }
  }

  return { dwgNoFixed, revFixed, matResolved };
}


export function mergeAssemblyDrawingsIntoMaster(master, assyData) {
  const partsMap = new Map();
  for (const p of master.parts) {
    partsMap.set(norm(p.partNo), p);
    for (const a of (p.alternates || [])) {
      partsMap.set(norm(a), p);
    }
  }

  const ALIAS_MAP = {
    'X3299': 'X3299AAM',
    'SB0041': 'SB0041A',
    'SPC0003966_03_RAW0000170': 'RAW0000170',
    'SPC0003966': 'RAW0000170',
  };

  let fileUpdated = 0, dwgUpdated = 0, revUpdated = 0, colUpdated = 0, matUpdated = 0, catUpdated = 0, bomUpdated = 0;
  const bomChildren = master.bom.children || {};
  const bomParents = master.bom.parents || {};

  for (const it of (assyData.items || [])) {
    const pnRaw = (it.partNo || '').trim().toUpperCase();
    if (!pnRaw) continue;
    const targetPn = ALIAS_MAP[pnRaw] || pnRaw;
    const p = partsMap.get(norm(targetPn));
    if (!p) continue;

    // 1. 圖檔檔名關聯
    if (it.fileName && (!p.drawingFileName || !p.drawingFileName.endsWith('.pdf'))) {
      p.drawingFileName = it.fileName;
      fileUpdated++;
    }

    // 2. 圖號補齊
    if (it.drawingNo && (!p.dwgNo || p.dwgNo === p.partNo)) {
      p.dwgNo = it.drawingNo;
      dwgUpdated++;
    }

    // 3. 版本更新
    if (it.revision && (!p.revision || p.revision !== it.revision)) {
      p.revision = it.revision;
      revUpdated++;
    }

    // 4. 顏色補齊
    if (it.color && !p.color) {
      p.color = it.color;
      colUpdated++;
    }

    // 5. 原料材質補齊
    if (it.materialName && (!p.material || p.material === '零件' || p.material === 'N/A' || p.material === 'NONE')) {
      p.material = it.materialName;
      matUpdated++;
    }

    // 6. 分類對齊
    if (it.category === 'SET' && p.category !== 'SET') {
      p.category = 'SET';
      catUpdated++;
    } else if (p.category === '零件' || p.category === '單品零件' || p.category === '零件圖') {
      p.category = it.category || '組件';
      catUpdated++;
    }

    // 7. 結構化 BOM 清單整合
    const newBoms = it.bomDetails || [];
    if (newBoms.length > 0) {
      const curBoms = p.bomDetails || [];
      const existingCpns = new Set(curBoms.map((b) => norm(b.partNo)));
      const mergedBoms = [...curBoms];
      let hasNew = false;

      for (const nb of newBoms) {
        const cpn = norm(nb.partNo);
        if (!existingCpns.has(cpn) && cpn !== norm(p.partNo)) {
          mergedBoms.push(nb);
          existingCpns.add(cpn);
          hasNew = true;
        }
      }

      p.bomDetails = mergedBoms;
      if (hasNew || curBoms.length === 0) bomUpdated++;

      // 同步更新 master.bom.children / parents
      const pNo = p.partNo;
      if (!bomChildren[pNo]) bomChildren[pNo] = [];
      for (const b of mergedBoms) {
        const cNo = (b.partNo || '').trim();
        if (!cNo || norm(cNo) === norm(pNo)) continue;
        if (!bomChildren[pNo].includes(cNo)) bomChildren[pNo].push(cNo);
        if (!bomParents[cNo]) bomParents[cNo] = [];
        if (!bomParents[cNo].includes(pNo)) bomParents[cNo].push(pNo);
      }
    }
  }

  master.bom.children = bomChildren;
  master.bom.parents = bomParents;
  return { fileUpdated, dwgUpdated, revUpdated, colUpdated, matUpdated, catUpdated, bomUpdated };
}

// v7.9.8 SET庫圖面全量融合：set_drawings_extract.json（113 筆圖檔、105 行子零件展開）
export function mergeSetDrawingsIntoMaster(master, setData) {
  const partsMap = new Map();
  for (const p of master.parts) {
    partsMap.set(norm(p.partNo), p);
    for (const a of (p.alternates || [])) {
      partsMap.set(norm(a), p);
    }
  }

  let fileUpdated = 0, revUpdated = 0, colUpdated = 0, matUpdated = 0, catUpdated = 0, bomUpdated = 0;
  const bomChildren = master.bom.children || {};
  const bomParents = master.bom.parents || {};

  for (const it of (setData.items || [])) {
    const pnRaw = (it.partNo || '').trim().toUpperCase();
    if (!pnRaw) continue;
    const targetPn = pnRaw === 'X3299' ? 'X3299AAM' : pnRaw;
    const p = partsMap.get(norm(targetPn));
    if (!p) continue;

    // 1. 關聯專屬圖檔
    if (it.fileName && (!p.drawingFileName || !p.drawingFileName.endsWith('.pdf'))) {
      p.drawingFileName = it.fileName;
      fileUpdated++;
    }

    // 2. 版本更新
    if (it.revision && (!p.revision || p.revision !== it.revision)) {
      p.revision = it.revision;
      revUpdated++;
    }

    // 3. 顏色補齊
    if (it.color && !p.color) {
      p.color = it.color;
      colUpdated++;
    }

    // 4. 原料材質補齊
    if (it.materialName && (!p.material || p.material === '零件' || p.material === '組件' || p.material === 'N/A' || p.material === 'NONE')) {
      p.material = it.materialName;
      matUpdated++;
    }

    // 5. 分類強制鎖定為 SET
    if (p.category !== 'SET') {
      p.category = 'SET';
      catUpdated++;
    }

    // 6. 結構化 BOM 清單整合
    const newBoms = it.bomDetails || [];
    if (newBoms.length > 0) {
      const curBoms = p.bomDetails || [];
      const existingCpns = new Set(curBoms.map((b) => norm(b.partNo)));
      const mergedBoms = [...curBoms];
      let hasNew = false;

      for (const nb of newBoms) {
        const cpn = norm(nb.partNo);
        if (!existingCpns.has(cpn) && cpn !== norm(p.partNo)) {
          mergedBoms.push(nb);
          existingCpns.add(cpn);
          hasNew = true;
        }
      }

      p.bomDetails = mergedBoms;
      if (hasNew || curBoms.length === 0) bomUpdated++;

      // 同步更新 master.bom.children / parents
      const pNo = p.partNo;
      if (!bomChildren[pNo]) bomChildren[pNo] = [];
      for (const b of mergedBoms) {
        const cNo = (b.partNo || '').trim();
        if (!cNo || norm(cNo) === norm(pNo)) continue;
        if (!bomChildren[pNo].includes(cNo)) bomChildren[pNo].push(cNo);
        if (!bomParents[cNo]) bomParents[cNo] = [];
        if (!bomParents[cNo].includes(pNo)) bomParents[cNo].push(pNo);
      }
    }
  }

  master.bom.children = bomChildren;
  master.bom.parents = bomParents;
  return { fileUpdated, revUpdated, colUpdated, matUpdated, catUpdated, bomUpdated };
}

// v7.9.9 OCR 掃描圖檔辨識成果融合：ocr_results_141.json（141 筆掃描圖檔、819 行子零件展開）
export function mergeOcrResultsIntoMaster(master, ocrData) {
  const partsMap = new Map();
  for (const p of master.parts) {
    partsMap.set(norm(p.partNo), p);
    for (const a of (p.alternates || [])) {
      partsMap.set(norm(a), p);
    }
  }

  let matUpdated = 0, colUpdated = 0, bomUpdated = 0;
  const bomChildren = master.bom.children || {};
  const bomParents = master.bom.parents || {};

  for (const r of (ocrData.results || [])) {
    const pnRaw = (r.partNo || '').trim().toUpperCase();
    if (!pnRaw) continue;
    const targetPn = pnRaw === 'X3299' ? 'X3299AAM' : pnRaw;
    const p = partsMap.get(norm(targetPn));
    if (!p) continue;

    // 1. 原料材質補齊
    if (r.extractedMaterial && (!p.material || p.material === '零件' || p.material === '組件' || p.material === 'N/A' || p.material === 'NONE')) {
      p.material = r.extractedMaterial;
      matUpdated++;
    }

    // 2. 顏色補齊
    if (r.extractedColor && !p.color) {
      p.color = r.extractedColor;
      colUpdated++;
    }

    // 3. 結構化 BOM 擴充
    const newBoms = r.bomDetails || [];
    if (newBoms.length > 0) {
      const curBoms = p.bomDetails || [];
      const existingCpns = new Set(curBoms.map((b) => norm(b.partNo)));
      const mergedBoms = [...curBoms];
      let hasNew = false;

      for (const nb of newBoms) {
        const cpn = norm(nb.partNo);
        if (!existingCpns.has(cpn) && cpn !== norm(p.partNo)) {
          const childPart = partsMap.get(cpn);
          mergedBoms.push({
            partNo: nb.partNo,
            name: nb.name || (childPart ? (childPart.name || childPart.description) : nb.partNo),
            qty: String(nb.qty || '1'),
            material: nb.material || (childPart ? childPart.material : '') || '',
            materialCode: (childPart ? childPart.materialCode : '') || '',
          });
          existingCpns.add(cpn);
          hasNew = true;
        }
      }

      p.bomDetails = mergedBoms;
      if (hasNew) bomUpdated++;

      // 同步更新 master.bom.children / parents
      const pNo = p.partNo;
      if (!bomChildren[pNo]) bomChildren[pNo] = [];
      for (const b of mergedBoms) {
        const cNo = (b.partNo || '').trim();
        if (!cNo || norm(cNo) === norm(pNo)) continue;
        if (!bomChildren[pNo].includes(cNo)) bomChildren[pNo].push(cNo);
        if (!bomParents[cNo]) bomParents[cNo] = [];
        if (!bomParents[cNo].includes(pNo)) bomParents[cNo].push(pNo);
      }
    }
  }

  master.bom.children = bomChildren;
  master.bom.parents = bomParents;
  return { matUpdated, colUpdated, bomUpdated };
}

// v7.10.0 互為替代品號識別與去重合併 (Mutual Alternates Deduplication & Merge)
export function deduplicateMutualAlternates(master) {
  const parts = master.parts;
  const pnToPart = new Map(parts.map((p) => [norm(p.partNo), p]));

  const pairs = [];
  const seenPairs = new Set();

  for (const p of parts) {
    const pNoNorm = norm(p.partNo);
    for (const a of (p.alternates || [])) {
      const aNorm = norm(a);
      if (pnToPart.has(aNorm) && aNorm !== pNoNorm) {
        const pairKey = [pNoNorm, aNorm].sort().join(':::');
        if (!seenPairs.has(pairKey)) {
          seenPairs.add(pairKey);
          pairs.push([pnToPart.get(pNoNorm), pnToPart.get(aNorm)]);
        }
      }
    }
  }

  function pickCanonical(p1, p2) {
    const pn1 = p1.partNo;
    const pn2 = p2.partNo;
    const isFac1 = /^[A-Z]\d{2}-\d{3}/i.test(pn1);
    const isFac2 = /^[A-Z]\d{2}-\d{3}/i.test(pn2);
    if (isFac1 && !isFac2) return [p1, p2];
    if (isFac2 && !isFac1) return [p2, p1];
    const hasFile1 = Boolean(p1.drawingFileName);
    const hasFile2 = Boolean(p2.drawingFileName);
    if (hasFile1 && !hasFile2) return [p1, p2];
    if (hasFile2 && !hasFile1) return [p2, p1];
    return [p1, p2];
  }

  const removedPns = new Set();
  const aliasRedirect = new Map();

  for (const [p1, p2] of pairs) {
    const [mainP, subP] = pickCanonical(p1, p2);
    const mainPn = mainP.partNo;
    const subPn = subP.partNo;
    removedPns.add(norm(subPn));
    aliasRedirect.set(norm(subPn), mainPn);

    // 1. 聯集 alternates
    const alts = new Set(mainP.alternates || []);
    alts.add(subPn);
    for (const a of (subP.alternates || [])) {
      if (norm(a) !== norm(mainPn)) alts.add(a);
    }
    mainP.alternates = Array.from(alts).sort();

    // 2. 補缺屬性 (零資料遺失)
    if (!mainP.drawingFileName && subP.drawingFileName) mainP.drawingFileName = subP.drawingFileName;
    if (!mainP.dwgNo && subP.dwgNo) mainP.dwgNo = subP.dwgNo;
    if (!mainP.revision && subP.revision) mainP.revision = subP.revision;
    if (!mainP.material && subP.material) mainP.material = subP.material;
    if (!mainP.color && subP.color) mainP.color = subP.color;

    // 3. 合併 BOM 結構化清單
    const mainBoms = mainP.bomDetails || [];
    const subBoms = subP.bomDetails || [];
    if (subBoms.length > 0 && mainBoms.length === 0) {
      mainP.bomDetails = subBoms;
    }
  }

  // 4. 重構 parts 列表
  master.parts = parts.filter((p) => !removedPns.has(norm(p.partNo)));

  // 5. 重構 BOM 關聯 (重定向至主品號)
  const oldChildren = master.bom.children || {};
  const newChildren = {};
  for (const [parent, kids] of Object.entries(oldChildren)) {
    const pTarget = aliasRedirect.get(norm(parent)) || parent;
    if (!newChildren[pTarget]) newChildren[pTarget] = [];
    for (const k of kids) {
      const kTarget = aliasRedirect.get(norm(k)) || k;
      if (norm(kTarget) !== norm(pTarget) && !newChildren[pTarget].includes(kTarget)) {
        newChildren[pTarget].push(kTarget);
      }
    }
  }

  const oldParents = master.bom.parents || {};
  const newParents = {};
  for (const [child, parents] of Object.entries(oldParents)) {
    const cTarget = aliasRedirect.get(norm(child)) || child;
    if (!newParents[cTarget]) newParents[cTarget] = [];
    for (const p of parents) {
      const pTarget = aliasRedirect.get(norm(p)) || p;
      if (norm(pTarget) !== norm(cTarget) && !newParents[cTarget].includes(pTarget)) {
        newParents[cTarget].push(pTarget);
      }
    }
  }

  master.bom.children = newChildren;
  master.bom.parents = newParents;

  return { removedCount: removedPns.size, remainingCount: master.parts.length };
}

// v7.10.4 物料庫圖面全量融合：material_drawings_extract.json + ocr_results_material_60.json (139 筆物料圖檔)
export function mergeMaterialDrawingsIntoMaster(master, matData, ocrData) {
  const partsMap = new Map();
  for (const p of master.parts) {
    partsMap.set(norm(p.partNo), p);
    for (const a of (p.alternates || [])) {
      partsMap.set(norm(a), p);
    }
  }

  // 融合 OCR 成果
  const ocrMap = new Map();
  if (ocrData && ocrData.results) {
    for (const r of ocrData.results) {
      ocrMap.set(r.fileName, r);
    }
  }

  let fileUpdated = 0, revUpdated = 0, colUpdated = 0, matUpdated = 0, catUpdated = 0, bomUpdated = 0;

  for (const item of (matData.parts || [])) {
    const pn = item.partNo;
    if (!pn) continue;
    const p = partsMap.get(norm(pn));
    if (!p) continue;

    // 1. 關聯物料專屬圖檔
    if (!p.drawingFileName || p.drawingFileName.includes('待補') || !p.drawingFileName.endsWith('.pdf')) {
      p.drawingFileName = item.fileName;
      fileUpdated++;
    }

    // 2. 更新版本
    if (item.revision && (!p.revision || p.revision === 'N/A' || p.revision === '-')) {
      p.revision = item.revision;
      revUpdated++;
    }

    // 3. 原料材質更新 (OCR 優先補缺)
    let finalMat = item.material;
    const ocrItem = ocrMap.get(item.fileName);
    if (ocrItem && ocrItem.extractedMaterial) {
      finalMat = ocrItem.extractedMaterial;
    }
    if (finalMat && (!p.material || p.material === '零件' || p.material === '組件' || p.material === '物料' || p.material === 'N/A')) {
      p.material = finalMat;
      matUpdated++;
    }

    // 4. 顏色更新
    let finalColor = item.color;
    if (ocrItem && ocrItem.extractedColor) {
      finalColor = ocrItem.extractedColor;
    }
    if (finalColor && !p.color) {
      p.color = finalColor;
      colUpdated++;
    }

    // 5. 分類鎖定為物料
    if (p.category !== '物料') {
      p.category = '物料';
      catUpdated++;
    }

    // 6. 物料結構化 BOM
    if (item.bomDetails && item.bomDetails.length > 0 && (!p.bomDetails || p.bomDetails.length === 0)) {
      p.bomDetails = item.bomDetails;
      bomUpdated++;
    }
  }

  return { fileUpdated, revUpdated, colUpdated, matUpdated, catUpdated, bomUpdated };
}

// v7.10.6 原料庫圖面全量融合：resin_drawings_extract.json + ocr_results_resin_2.json (28 份原料規格書)
export function mergeResinDrawingsIntoMaster(master, resinData, ocrData) {
  const partsMap = new Map();
  for (const p of master.parts) {
    partsMap.set(norm(p.partNo), p);
    for (const a of (p.alternates || [])) {
      partsMap.set(norm(a), p);
    }
  }

  let fileUpdated = 0, revUpdated = 0, colUpdated = 0, matUpdated = 0, catUpdated = 0, codeUpdated = 0;

  for (const item of (resinData.parts || [])) {
    const pnRaw = item.partNo;
    if (!pnRaw) continue;
    
    // 支援 -MC 比對
    let p = partsMap.get(norm(pnRaw));
    if (!p && pnRaw.includes('-MC')) {
      p = partsMap.get(norm(pnRaw.replace('-MC', '')));
    }
    if (!p) continue;

    // 1. 關聯專屬原料圖檔
    if (!p.drawingFileName || p.drawingFileName.includes('待補') || !p.drawingFileName.endsWith('.pdf')) {
      p.drawingFileName = item.fileName;
      fileUpdated++;
    }

    // 2. 更新最新版次
    if (item.revision && (!p.revision || p.revision === 'N/A' || p.revision === '-')) {
      p.revision = item.revision;
      revUpdated++;
    }

    // 3. 原料材質更新
    if (item.material && (!p.material || p.material === '零件' || p.material === '組件' || p.material === '原料' || p.material === 'N/A')) {
      p.material = item.material;
      matUpdated++;
    }

    // 4. 顏色更新
    if (item.color && !p.color) {
      p.color = item.color;
      colUpdated++;
    }

    // 5. 原廠料號/原料編碼更新
    if (item.materialCode && !p.materialCode) {
      p.materialCode = item.materialCode;
      codeUpdated++;
    }

    // 6. 分類鎖定為「原料」
    if (p.category !== '原料') {
      p.category = '原料';
      catUpdated++;
    }

    // 7. 將帶 -MC 圖號納入別名
    if (pnRaw.includes('-MC') && norm(pnRaw) !== norm(p.partNo)) {
      const alts = new Set(p.alternates || []);
      if (!alts.has(pnRaw)) {
        alts.add(pnRaw);
        p.alternates = Array.from(alts).sort();
      }
    }
  }

  return { fileUpdated, revUpdated, colUpdated, matUpdated, catUpdated, codeUpdated };
}

// 套用策展的「材料用途關聯」：seed.materialUsageLinks = [{ product, material, note? }]
// 建為 BOM 產品(parent) → 物料(child)。品號經 alternates 正規化；防自我參照與環路；
// 產品/物料任一不存在於 master 則略過（避免建出孤兒關係）。
function applyMaterialUsageLinks(master, links) {
  if (!Array.isArray(links) || links.length === 0) return 0;
  const canon = new Map();
  for (const p of master.parts) {
    canon.set(norm(p.partNo), p.partNo);
    for (const a of (p.alternates || [])) if (!canon.has(norm(a))) canon.set(norm(a), p.partNo);
  }
  // 判斷 anc 是否為 desc 的祖先（沿 children 下行找得到 desc）→ 防環
  const isAncestor = (anc, desc) => {
    const seen = new Set();
    const stack = [...(master.bom.children[anc] || [])];
    while (stack.length) {
      const cur = stack.pop();
      if (norm(cur) === norm(desc)) return true;
      if (seen.has(cur)) continue;
      seen.add(cur);
      stack.push(...(master.bom.children[cur] || []));
    }
    return false;
  };
  let added = 0;
  for (const link of links) {
    const product = canon.get(norm(link.product));
    const material = canon.get(norm(link.material));
    if (!product || !material || product === material) continue;
    // 防環：material 已是 product 的祖先時不可再讓 product 成為其父
    if (isAncestor(material, product)) continue;
    if (!master.bom.children[product]) master.bom.children[product] = [];
    if (!master.bom.children[product].includes(material)) {
      master.bom.children[product].push(material);
      added++;
    }
    if (!master.bom.parents[material]) master.bom.parents[material] = [];
    if (!master.bom.parents[material].includes(product)) master.bom.parents[material].push(product);
  }
  return added;
}

// BOM 子件清理 (BOM Child Sanitization)：修復萃取階段（組件圖 OCR/文字）產生的子件亂碼與雜訊。
//   ① 別稱子件 → 規範品號（透過 alternates 索引）
//   ② OCR 亂碼子件 → 登錄品號（O/0、I/1、L/1、S/5、B/8、Z/2、G/6 折疊後「唯一命中」才對映）
//   ③ 明確雜訊子件（日期/電話/ISO 標準碼/純數字/模號）→ 移除
//   ④ 真品號格式但 master 查無者 → 保留（反向檢視可見供查核）並列冊至 data/bom-orphan-report.json
// 僅對「resolve 失敗」的子件套用雜訊移除 → 絕不誤刪任何登錄/別稱/可 OCR 對映的真品號。
function sanitizeBomLinks(master) {
  const ocrCanon = (s) => norm(s).replace(/O/g, '0').replace(/[IL]/g, '1').replace(/S/g, '5').replace(/B/g, '8').replace(/Z/g, '2').replace(/G/g, '6');
  // 逐一人工驗證（2026-09，A 類 48 筆比對）：亂碼/截斷子件 → 既有 master 品號（前綴字母贅生或末碼截斷，OCR 折疊無法涵蓋）
  const CURATED_REMAP = new Map(Object.entries({
    'DI10-210-251-1': 'D10-210-251-1', 'DI10-210-2512': 'D10-210-251-2',
    'FD10-240-251': 'D10-240-251', 'IFD10-210-251': 'D10-210-251', 'RD10-210-251': 'D10-210-251',
    'Cl11-111-251': 'C11-111-251', 'E20-000-13': 'E20-000-131',
    // 人工看圖確認（2026-09）：截斷子件 → 原圖 KEY UNIT 表判定之精確變體
    'A02-200': 'A02-200-251', 'C09-200-2': 'C09-200-211', 'E09-000-4': 'E09-000-412-4',
    'E09-000-412': 'E09-000-412-1', 'E10-002': 'E10-002-416', 'E20-000': 'E20-000-131',
    'F17-000': 'F17-000-412',
    // 人工確認為識別錯誤 → 修正
    'A02-700-131': 'A02-200-131', 'p10-279-211': 'D10-279-211',
    // MDXE-123-01 原圖 BOM 核對（2026-09）：OCR 亂碼子件 → 原圖零件編號
    'Cro6001': 'CP96001', '009-279-211': 'C09-279-211', 'ER2258': 'CP96023',
  }).map(([k, v]) => [norm(k), v]));
  // 逐一人工驗證：PN 格式但實為文件/程序編號或圖框檔號的 OCR 誤讀（bomDetails 品名佐證）→ 非零件，移除
  //   SET00xx = 圖框「MOULDEX M05003-R01 FILE NO.」誤讀；QP/P = Quality Procedure 品質程序號；R1-1148/3522 = 文件參照
  const CONFIRMED_NOISE = new Set([
    'SET0011', 'SET0025', 'SET0029', 'SET0031', 'SET0033', 'SET0065', 'SET0066', 'SET0072',
    'SET0083', 'SET0089', 'SET0097', 'SET0098', 'SET0102', 'SET0103', 'SET0108',
    'QP00-00013', 'QP00-00017', 'QP00-00030', 'QP00-00033', 'P00-00030', 'P00-00033', 'Br00-00033',
    'R1-1148', 'R1-3522', 's86-3', 'o16-03',
  ].map(norm));
  const regNorm = new Map();
  const regOcr = new Map();
  for (const p of master.parts) {
    for (const k of [p.partNo, ...(p.alternates || [])]) {
      if (!regNorm.has(norm(k))) regNorm.set(norm(k), p.partNo);
      const o = ocrCanon(k);
      if (!regOcr.has(o)) regOcr.set(o, new Set());
      regOcr.get(o).add(p.partNo);
    }
  }
  const SHRINK = /^0\.08\*14(?:\.5)?mm$/i; // 收縮膜物料（白名單保留，非雜訊）
  const isNoise = (c) =>
    /^(19|20)\d{2}-?\d{2}/.test(c) ||                                   // 日期 1999-11-02 / 20230721
    /^\d{8,}$/.test(c) ||                                                // 8+ 位純數字（日期/巨數）
    /^886-?\d/.test(c) || /^\d{2,3}-\d-\d{6,}$/.test(c) || /^0\d-?\d{6,}$/.test(c) || // 電話（含台灣區碼）
    /^(ISO|IEC|EN)\d/i.test(c) ||                                        // 標準碼
    /^\d{3,5}-\d{1,2}$/.test(c) ||                                       // ISO 尾號 80369-7
    /^\d{5,7}$/.test(c) ||                                               // 純數字 5-7 位（模號/碎片）
    /^[MW]O?\d{4,}$/i.test(c);                                           // 模號 MO5003 / WO5003
  const resolve = (c) => {
    const n = norm(c);
    if (regNorm.has(n)) return regNorm.get(n);       // 規範品號或別稱→規範
    if (CURATED_REMAP.has(n)) {                        // 人工驗證亂碼→既有品號
      const t = CURATED_REMAP.get(n);
      if (regNorm.has(norm(t))) return regNorm.get(norm(t));
    }
    const hit = regOcr.get(ocrCanon(c));
    if (hit && hit.size === 1) return [...hit][0];    // OCR 折疊後唯一命中
    return null;
  };
  let remapAlias = 0, remapOcr = 0, dropped = 0;
  const orphanReport = [];
  const newChildren = {};
  for (const [parent, kids] of Object.entries(master.bom.children)) {
    const pc = resolve(parent) || parent;
    if (!newChildren[pc]) newChildren[pc] = [];
    const seen = new Set(newChildren[pc].map(norm));
    for (const k of kids) {
      if (SHRINK.test(k)) {
        if (!seen.has(norm(k))) { newChildren[pc].push(k); seen.add(norm(k)); }
        continue;
      }
      const r = resolve(k);
      if (r) {
        if (norm(r) !== norm(k)) { if (regNorm.has(norm(k))) remapAlias++; else remapOcr++; }
        if (norm(r) !== norm(pc) && !seen.has(norm(r))) { newChildren[pc].push(r); seen.add(norm(r)); }
      } else if (isNoise(k) || CONFIRMED_NOISE.has(norm(k))) {
        dropped++;
      } else {
        if (!seen.has(norm(k))) { newChildren[pc].push(k); seen.add(norm(k)); }
        orphanReport.push({ parent: pc, child: k });
      }
    }
    if (newChildren[pc].length === 0) delete newChildren[pc];
  }
  // 重建 parents（保證雙向對稱）
  const newParents = {};
  for (const [par, kids] of Object.entries(newChildren)) {
    for (const kid of kids) {
      if (!newParents[kid]) newParents[kid] = [];
      if (!newParents[kid].includes(par)) newParents[kid].push(par);
    }
  }
  master.bom.children = newChildren;
  master.bom.parents = newParents;
  // 列冊分類：協助人工判斷保留孤兒的後續處置
  const classify = (c) => {
    if (/x14(?:\.0)?mm$/i.test(c) || /\*14/.test(c)) return 'size-收縮膜尺寸變體';
    if (/^[A-Z]{1,3}\d{2,}-\d/i.test(c) || /^R1-\d/i.test(c) || /^SET\d/i.test(c) || /^\d{2,3}M\d/i.test(c)) return 'A-疑真品號(建議登錄)';
    if (/^(QP|P|OP|BR)O?0?0-\d/i.test(c)) return 'B-客戶號族群(QP00 等)';
    if (/^\d{2}-\d{6}$/.test(c)) return 'C-管材料號族群(NN-NNNNNN)';
    if (/^\d{2,4}-\d/.test(c)) return 'D-截斷品號(缺前綴)';
    if (/^\d{1,4}$/.test(c)) return 'E-短碼數字碎片';
    return 'F-其他';
  };
  const grouped = {};
  const uniqChildren = new Map();
  for (const it of orphanReport) {
    if (!uniqChildren.has(it.child)) uniqChildren.set(it.child, []);
    uniqChildren.get(it.child).push(it.parent);
  }
  const catalog = [...uniqChildren.entries()].map(([child, parents]) => ({ child, category: classify(child), usedInAssemblies: parents }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.child.localeCompare(b.child));
  for (const row of catalog) grouped[row.category] = (grouped[row.category] || 0) + 1;
  writeFileSync(join(ROOT_DIR, 'data', 'bom-orphan-report.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    note: '真品號格式但 master 查無的 BOM 子件（已保留於 BOM，反向檢視可見）；依分類人工判斷：A 建議登錄 master、B/C 需確認料號族群、D/E/F 多為萃取碎片可忽略',
    uniqueChildren: catalog.length,
    occurrences: orphanReport.length,
    byCategory: grouped,
    items: catalog,
  }, null, 2), 'utf-8');
  return { remapAlias, remapOcr, dropped, keptOrphans: catalog.length };
}

// 權威 BOM 覆寫：對已用原圖 KEY UNIT 表逐一核對的組件，以 seed.bomOverrides 設定其確切子件清單，
// 覆蓋圖檔 OCR 萃取的雜訊/缺漏/多餘。同步更新 bom.children 與該組件的 bomDetails（前端優先顯示 bomDetails），
// 品號解析為規範品號（經別稱），品名/原料取自登錄品項；最後重建 parents 確保雙向對稱。
// 權威品項欄位修正：針對人工確認的錯誤資料強制覆寫品名/原料/顏色（不論來源，最後定稿）
const PART_FIELD_CORRECTIONS = {
  // B膠 / D膠 為材質 IR2200 的膠塞（橡膠塞子），非膠水；品名維持「B膠」/「D膠」，修正材質（原「B glue」誤譯）
  // 2026-09 使用者確認：膠塞為消耗性物料（非零件），category 改為物料
  'B-077': { name: 'B膠', material: 'IR2200', category: '物料' },
  'B-003': { name: 'D膠', material: 'IR2200', category: '物料' },
  // SC0006 進版至 Rev.C（舊 Rev.B 圖檔已刪）；extract 仍殘留舊版 → 強制更新版次與圖檔連結
  'SC0006': { revision: 'C', drawingFileName: 'SC0006(Rev.C)-C.pdf' },
  // R1-8065 單一射出件（圖面 Note-7 單一樹脂 75-2568 WHITE ABS），被 drawings scan 誤分為「其他組件」；
  // 修正 category 為零件（避開組件材質清空），並強制設定圖面確認材質（2026-09 人工審計確認）
  'R1-8065': { category: '零件', material: '75-2568 WHITE ABS' },
  // PE007 藍色包裝袋：internalParts 預設 category 為零件，強制修正為物料（非結構件）
  'PE007': { category: '物料' },
  // 雙圖並存：廠內圖與客戶圖版次不同，兩圖合法並存（2026-09 人工確認）
  // master 版次以圖檔資料夾內較新之圖檔為準；備註說明另一版次來源
  'R1-2392': { notes: '廠內圖 Rev.A（客戶組件版本清單）；客戶圖 Rev.6（兩圖並存）' },
  'R1-3529': { notes: '廠內圖 Rev.A（客戶組件版本清單）；客戶圖 Rev.05（兩圖並存）' },
  'SB0063':  { notes: '廠內圖 Rev.C（客戶組件版本清單）；客戶圖 Rev.A（兩圖並存）' },
  // 圖面確認材質填補（2026-09-04 PyMuPDF 圖面解析確認）
  'N20-208-13':        { material: 'ABS TERLUX-2812' },
  'D09-279-1':         { material: 'ABS TOYOLAC 900' },
  // 收縮膜與包裝袋材質（PE 標準材質，物料類）
  '0.08*14mm':         { material: 'PE' },
  '0.08*14.5mm':       { material: 'PE' },
  '9X.20860.003120mm': { material: 'PE' },
  '9X.20860.005':      { material: 'PE' },
};
function applyPartFieldCorrections(master) {
  let n = 0;
  for (const p of master.parts) {
    const fix = PART_FIELD_CORRECTIONS[p.partNo];
    if (!fix) continue;
    if (fix.name) p.name = fix.name;
    if (fix.material !== undefined) p.material = fix.material;
    if (fix.color !== undefined) p.color = fix.color;
    if (fix.revision !== undefined) p.revision = fix.revision;
    if (fix.drawingFileName !== undefined) p.drawingFileName = fix.drawingFileName;
    if (fix.category !== undefined) p.category = fix.category;
    if (fix.notes !== undefined) p.notes = fix.notes;
    if (fix.description !== undefined) p.description = fix.description;
    n++;
  }
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// ERP 計算欄位：第二階 SSOT，在所有欄位定稿後統一計算，不改動現有欄位
// erpItemClass: 成品 / 半成品 / 零件 / 原料
// uom: 計量單位（預設 PCS）
// procurementType: 自製（有 moldNo） / 外購
// isActive: 啟用狀態（!legacy）
// ─────────────────────────────────────────────────────────────────────────────
function computeErpFields(master) {
  const SET_CATS      = new Set(['SET']);
  const HALF_CATS     = new Set(['組件', '組件圖候補', '其他組件', 'SA組立', 'SB組立', 'SC組立', 'SD組立']);
  const MATERIAL_CATS = new Set(['原料', '物料', '包材']);
  for (const p of master.parts) {
    if      (SET_CATS.has(p.category))      p.erpItemClass = '成品';
    else if (HALF_CATS.has(p.category))     p.erpItemClass = '半成品';
    else if (MATERIAL_CATS.has(p.category)) p.erpItemClass = '原料';
    else                                     p.erpItemClass = '零件';
    p.uom             = 'PCS';
    p.procurementType = p.moldNo ? '自製' : '外購';
    p.isActive        = !p.legacy;
  }
  console.log(`Compute ERP fields: ${master.parts.length} 筆 erpItemClass / uom / procurementType / isActive 計算完成`);
}

// 刷新 bomDetails：已登錄子件的品名/原料/品號一律以 master 記錄為準（SSOT），
// 取代萃取階段凍結的 OCR 文字（如「B glue」、「1 [1 [MLL Cap」等亂碼）；未登錄子件保留原字串。
function refreshBomDetailsFromParts(master) {
  const byN = new Map();
  for (const p of master.parts) {
    byN.set(norm(p.partNo), p);
    for (const a of (p.alternates || [])) if (!byN.has(norm(a))) byN.set(norm(a), p);
  }
  let refreshed = 0;
  for (const p of master.parts) {
    if (!Array.isArray(p.bomDetails)) continue;
    for (const b of p.bomDetails) {
      const cp = byN.get(norm(b.partNo));
      if (!cp) continue; // 未登錄子件：保留萃取文字
      if (b.partNo !== cp.partNo) b.partNo = cp.partNo; // 正規化為規範品號
      if (cp.name && b.name !== cp.name) { b.name = cp.name; refreshed++; }
      b.material = cp.material || '';
      b.materialCode = cp.materialCode || '';
    }
  }
  return refreshed;
}

function applyBomOverrides(master, overrides) {
  if (!overrides || typeof overrides !== 'object') return 0;
  const byN = new Map();
  for (const p of master.parts) {
    byN.set(norm(p.partNo), p);
    for (const a of (p.alternates || [])) if (!byN.has(norm(a))) byN.set(norm(a), p);
  }
  let count = 0;
  for (const [asm, rows] of Object.entries(overrides)) {
    if (!Array.isArray(rows)) continue;
    const asmPart = byN.get(norm(asm));
    const children = [];
    const details = [];
    for (const row of rows) {
      const p = byN.get(norm(row.partNo));
      const canonical = p ? p.partNo : row.partNo; // 收縮膜等非登錄物料保留原字串
      if (!children.some((c) => norm(c) === norm(canonical))) children.push(canonical);
      details.push({
        qty: row.qty || '1',
        partNo: canonical,
        name: p ? p.name : (row.name || row.partNo),
        material: p ? (p.material || '') : (row.material || ''),
        materialCode: p ? (p.materialCode || '') : '',
      });
    }
    master.bom.children[asm] = children;
    if (asmPart) asmPart.bomDetails = details;
    count++;
  }
  // 重建 parents（雙向對稱）
  const newParents = {};
  for (const [par, kids] of Object.entries(master.bom.children)) {
    for (const kid of kids) {
      if (!newParents[kid]) newParents[kid] = [];
      if (!newParents[kid].includes(par)) newParents[kid].push(par);
    }
  }
  master.bom.parents = newParents;
  return count;
}

function buildMaster() {
  if (!existsSync(RAW_SEED_PATH)) {
    console.error(`Error: Seed file not found at ${RAW_SEED_PATH}`);
    process.exit(1);
  }
  console.log(`Reading raw seed data from ${RAW_SEED_PATH}...`);
  const rawSeed = JSON.parse(readFileSync(RAW_SEED_PATH, 'utf-8'));
  const master = convertUnifiedSeedToMaster(rawSeed);
  const seedCount = master.parts.length;

  // v7.8.7 圖檔優先管線：合併組件圖識別提取（檔名品號 + 組件圖內文 BOM）
  if (existsSync(EXTRACT_PATH)) {
    const extract = JSON.parse(readFileSync(EXTRACT_PATH, 'utf-8'));
    const { added } = mergeDrawingsIntoMaster(master, extract);
    console.log(`Merged drawings-extract: +${added} 個檔名品號收錄（seed ${seedCount} → ${master.parts.length}）`);
  } else {
    console.log(`ℹ️ 未找到 ${EXTRACT_PATH}（先執行 node scripts/scanAssemblyImages.js --extract）`);
  }

  // v7.9.0 語意合併：品名規格/圖號/原料/BOM 補缺（semantic-extract.json）
  if (existsSync(SEMANTIC_PATH)) {
    const semantic = JSON.parse(readFileSync(SEMANTIC_PATH, 'utf-8'));
    const { materialFilled, nameFilled, dwgAdded, descAdded, bomAdded } = mergeSemanticIntoMaster(master, semantic);
    console.log(`Merged semantic-extract: 補缺 material ${materialFilled} / name ${nameFilled} / dwgNo ${dwgAdded} / description ${descAdded} / BOM 子件 ${bomAdded}`);
  } else {
    console.log(`ℹ️ 未找到 ${SEMANTIC_PATH}（先執行 node scripts/semanticExtract.js --sample）`);
  }

  // v7.9.1 ICU 原料料號對照表：覆蓋 material + 新增不存在品號
  if (existsSync(ICU_PATH)) {
    const icuParts = JSON.parse(readFileSync(ICU_PATH, 'utf-8'));
    const { updated, added } = mergeICUPartsIntoMaster(master, icuParts);
    console.log(`Merged ICU parts: 覆蓋 ${updated} / 新增 ${added}（共 ${icuParts.length} 筆）`);
  } else {
    console.log(`ℹ️ 未找到 ${ICU_PATH}（先執行 node scripts/importICU.js）`);
  }

  // v7.9.5 圖檔工程最新成果融合：drawings_extract_v7.json（100% 材質覆蓋、顏色、圖號、組件判定）
  if (existsSync(V7_DRAWINGS_PATH)) {
    const v7Data = JSON.parse(readFileSync(V7_DRAWINGS_PATH, 'utf-8'));
    const { matCnt, colCnt, dwgCnt, descCnt, catCnt } = mergeV7DrawingsIntoMaster(master, v7Data);
    console.log(`Merged v7 drawings: 補齊 material ${matCnt} / color ${colCnt} / dwgNo ${dwgCnt} / desc ${descCnt} / category ${catCnt}`);
  } else {
    console.log(`ℹ️ 未找到 ${V7_DRAWINGS_PATH}`);
  }

  // v7.9.7 組件庫圖面全量融合：assembly_drawings_extract.json（357 筆組件圖檔、1,133 行子零件 BOM 展開）
  if (existsSync(ASSEMBLY_EXTRACT_PATH)) {
    const assyData = JSON.parse(readFileSync(ASSEMBLY_EXTRACT_PATH, 'utf-8'));
    const { fileUpdated, dwgUpdated, revUpdated, colUpdated, matUpdated, catUpdated, bomUpdated } = mergeAssemblyDrawingsIntoMaster(master, assyData);
    console.log(`Merged assembly drawings: 關聯圖檔 ${fileUpdated} / 圖號 ${dwgUpdated} / 版本 ${revUpdated} / 顏色 ${colUpdated} / 原料 ${matUpdated} / 分類 ${catUpdated} / BOM富化 ${bomUpdated}`);
  } else {
    console.log(`ℹ️ 未找到 ${ASSEMBLY_EXTRACT_PATH}`);
  }

  // v7.9.8 SET庫圖面全量融合：set_drawings_extract.json（113 筆 SET 圖檔、105 行子零件展開）
  if (existsSync(SET_EXTRACT_PATH)) {
    const setData = JSON.parse(readFileSync(SET_EXTRACT_PATH, 'utf-8'));
    const { fileUpdated, revUpdated, colUpdated, matUpdated, catUpdated, bomUpdated } = mergeSetDrawingsIntoMaster(master, setData);
    console.log(`Merged SET drawings: 關聯圖檔 ${fileUpdated} / 版本 ${revUpdated} / 顏色 ${colUpdated} / 原料 ${matUpdated} / 分類 ${catUpdated} / BOM富化 ${bomUpdated}`);
  } else {
    console.log(`ℹ️ 未找到 ${SET_EXTRACT_PATH}`);
  }

  // v7.9.9 OCR 掃描圖檔辨識成果融合：ocr_results_141.json（141 筆掃描圖檔、819 行子零件展開）
  if (existsSync(OCR_RESULTS_PATH)) {
    const ocrData = JSON.parse(readFileSync(OCR_RESULTS_PATH, 'utf-8'));
    const { matUpdated, colUpdated, bomUpdated } = mergeOcrResultsIntoMaster(master, ocrData);
    console.log(`Merged OCR results: 補齊 material ${matUpdated} / color ${colUpdated} / BOM富化 ${bomUpdated}`);
  } else {
    console.log(`ℹ️ 未找到 ${OCR_RESULTS_PATH}`);
  }

  // v7.10.4 物料庫圖面全量融合：material_drawings_extract.json + ocr_results_material_60.json (139 筆物料圖檔)
  if (existsSync(MATERIAL_EXTRACT_PATH)) {
    const matData = JSON.parse(readFileSync(MATERIAL_EXTRACT_PATH, 'utf-8'));
    const ocrData = existsSync(MATERIAL_OCR_PATH) ? JSON.parse(readFileSync(MATERIAL_OCR_PATH, 'utf-8')) : null;
    const { fileUpdated, revUpdated, colUpdated, matUpdated, catUpdated, bomUpdated } = mergeMaterialDrawingsIntoMaster(master, matData, ocrData);
    console.log(`Merged Material drawings: 關聯圖檔 ${fileUpdated} / 版本 ${revUpdated} / 顏色 ${colUpdated} / 原料 ${matUpdated} / 分類 ${catUpdated} / BOM富化 ${bomUpdated}`);
  } else {
    console.log(`ℹ️ 未找到 ${MATERIAL_EXTRACT_PATH}`);
  }

  // v7.10.6 原料庫圖面全量融合：resin_drawings_extract.json + ocr_results_resin_2.json (28 份原料規格書)
  if (existsSync(RESIN_EXTRACT_PATH)) {
    const resinData = JSON.parse(readFileSync(RESIN_EXTRACT_PATH, 'utf-8'));
    const ocrData = existsSync(RESIN_OCR_PATH) ? JSON.parse(readFileSync(RESIN_OCR_PATH, 'utf-8')) : null;
    const { fileUpdated, revUpdated, colUpdated, matUpdated, catUpdated, codeUpdated } = mergeResinDrawingsIntoMaster(master, resinData, ocrData);
    console.log(`Merged Resin drawings: 關聯圖檔 ${fileUpdated} / 版本 ${revUpdated} / 顏色 ${colUpdated} / 原料 ${matUpdated} / 原料編碼 ${codeUpdated} / 分類 ${catUpdated}`);
  } else {
    console.log(`ℹ️ 未找到 ${RESIN_EXTRACT_PATH}`);
  }

  // v7.8.15 物料類別三層體系 → v7.9.2 五分類：原料 / 物料 / 零件 / 組件 / SET
  // 內部邏輯判斷維持細粒度值，僅輸出前統一映射
  const CATEGORY_ALIAS = {
    單品零件: '零件',
    零件圖: '零件',
    物料圖: '物料',
    組件圖候補: '其他組件',
  };
  for (const p of master.parts) {
    const alias = CATEGORY_ALIAS[p.category];
    if (alias) p.category = alias;
  }

  // v7.9.2 原料分類：ICU 原料料號對照表的材料料號 → 原料
  const ICU_MATERIAL_PNS = new Set([
    '28-0397', '75-0485', '75-1396', '75-1861', '75-2117', '75-2567', '75-2568',
    '90-9634', 'R1-1000', 'R1-1034', 'R1-1036', 'R1-1073', 'R1-1092', 'R1-1176',
    'R1-1203', 'R1-8328', 'R1-8329', 'R1-8337', 'R1-8959', 'R1-9066', 'R1-10002',
    'R1-10046', 'R1-10143', 'R1-15157', 'R1-16132',
    'NA207-66', // LDPE Paxothene 樹脂料（BOM 孤兒比對登錄，非 ICU 但同為原料類）
  ]);
  let rawMatCount = 0;
  for (const p of master.parts) {
    if (ICU_MATERIAL_PNS.has(p.partNo) && p.category === '零件') {
      p.category = '原料';
      rawMatCount++;
    }
  }
  if (rawMatCount) console.log(`分類修正: ${rawMatCount} 筆材料 → 原料`);

  // v7.9.2 SET 分類：含輸液管的組件 → SET
  // 1. MDXE / MDXI 系列（所有）
  // 2. 8003875、X3299AAM
  // 3. EB/EC/ED/EG/DB 系列中的輸液套延長管
  const SET_MANUAL = new Set([
    '8003875', 'X3299AAM',
    'EB03002', 'EB03013SA', 'EB06002', 'EB07201', 'EB07202', 'EB09601',
    'EC07201', 'ED03001', 'EG01401', 'DB00605',
    'AF07001', 'DB00801', 'DB00803', 'DC00601', 'EF01601',
  ]);
  let setCount = 0;
  for (const p of master.parts) {
    if (p.category === 'SET') continue; // 已是 SET
    const isMDXE = /^MDXE-/.test(p.partNo);
    const isMDXI = /^MDXI-/.test(p.partNo);
    const isManualSET = SET_MANUAL.has(p.partNo);
    if (isMDXE || isMDXI || isManualSET) {
      p.category = 'SET';
      setCount++;
    }
  }
  // v7.10.0 互為替代品號去重與合併 (Mutual Alternates Deduplication)
  const { removedCount, remainingCount } = deduplicateMutualAlternates(master);
  console.log(`去重合併: 移除 ${removedCount} 筆互為替代重複實體（剩餘 ${remainingCount} 筆規範實體）`);

  // v7.10.8 磁碟掃描補遺：補齊 drawingFileName / revision 仍為空的品號（v7 extract 解析品號失敗所致）
  const drawingsRoot = join(ROOT_DIR, 'rawdata', 'Drawings');
  const repairDirs = ['零件', '組件', 'SET', '物料', '原料'].map((d) => join(drawingsRoot, d));
  const { linked: repairLinked, revFilled: repairRevFilled } = repairMissingDrawingLinks(master, repairDirs);
  console.log(`Repair drawing links: 補齊 drawingFileName ${repairLinked} / revision ${repairRevFilled}`);

  // v7.10.12 零件原料名稱與顏色全覆蓋富化與類別校正 (Parts Material & Colors 100% Coverage & Category Correction)
  const { matFilled, colFilled, catFixed } = enrichPartMaterialsAndColors(master);
  console.log(`Enrich materials & colors: 補齊原料名稱 ${matFilled} 筆 / 顏色 ${colFilled} 筆 / 分類校正 ${catFixed} 筆`);

  // v7.11.0 以圖檔為唯一真實來源 (Drawing as SSOT) 全鏈路管線重構
  const { dwgNoFixed, revFixed, matResolved } = applyDrawingSSOT(master);
  console.log(`Apply Drawing SSOT: 修正圖號 ${dwgNoFixed} 筆 / 版次校正 ${revFixed} 筆 / 材料矛盾裁決 ${matResolved} 筆`);

  // 權威品項欄位修正（人工確認之錯誤）：B膠/D膠 為 IR2200 膠塞，非膠水
  const fieldFixed = applyPartFieldCorrections(master);
  if (fieldFixed) console.log(`Apply part field corrections: ${fieldFixed} 筆品項欄位權威修正（B-077/B-003 膠塞 IR2200）`);

  // 材料用途關聯 (Material Usage Links)：包裝/標籤等物料「用於」某產品，
  // 建為 BOM 關係 產品(parent) → 物料(child)，使產品 BOM 樹顯示其包裝物料、
  // 物料反向檢視顯示「用於 ⭢ 產品」。純疊加，不改 category（與別稱合併互補：
  // 別稱＝同一物；用途＝不同物但材料用在該產品上）。
  const usageLinked = applyMaterialUsageLinks(master, rawSeed.materialUsageLinks);
  console.log(`Apply material usage links: 建立 ${usageLinked} 條「產品→物料」用途關聯`);

  // 組件/SET 原料欄清空 (Assembly Material Suppression)：組件由零件組成、本身無單一原料，
  // 且圖面提取常誤抓「MATERIAL/材質」表頭或 durometer 規格碎片。原料資訊改由 BOM 子零件
  // （bomDetails / bom.children 各零件之 material）查得。清空 material 與 materialCode。
  const ASSEMBLY_CATS = new Set(['組件', '組件圖候補', '其他組件', 'SA組立', 'SB組立', 'SC組立', 'SD組立', 'SET']);
  let asmMatCleared = 0;
  for (const p of master.parts) {
    if (!ASSEMBLY_CATS.has(p.category)) continue;
    let touched = false;
    if (p.material && String(p.material).trim()) { p.material = ''; touched = true; }
    if (p.materialCode && String(p.materialCode).trim()) { p.materialCode = ''; touched = true; }
    if (touched) asmMatCleared++;
  }
  console.log(`Clear assembly material: 清空 ${asmMatCleared} 筆組件/SET 的原料欄（原料改由 BOM 子零件查得）`);

  // BOM 子件清理：修復 OCR 亂碼/別稱子件、移除萃取雜訊、真缺漏列冊（管線末端，最後定稿 BOM）
  const bomSan = sanitizeBomLinks(master);
  console.log(`Sanitize BOM links: OCR 對映 ${bomSan.remapOcr} / 別稱正規化 ${bomSan.remapAlias} / 移除雜訊子件 ${bomSan.dropped} / 保留真缺漏 ${bomSan.keptOrphans}（列冊 data/bom-orphan-report.json）`);

  // 權威 BOM 覆寫（原圖核對之組件）：最後定稿，覆蓋萃取雜訊
  const ovrCount = applyBomOverrides(master, rawSeed.bomOverrides);
  if (ovrCount) console.log(`Apply BOM overrides: ${ovrCount} 個組件套用原圖核對之權威 BOM`);

  // 刷新 bomDetails 子件品名/原料為 master SSOT（修正 B glue 等凍結 OCR 文字）
  const bdRefreshed = refreshBomDetailsFromParts(master);
  console.log(`Refresh bomDetails from parts: ${bdRefreshed} 筆子件品名以 master 為準刷新`);

  // 舊版組件標示 (Legacy Assembly Marking)：出現在 master 但未列入客戶組件版本清單 (2026-08-05)
  if (Array.isArray(rawSeed.legacyAssemblies)) {
    const legacySet = new Set(rawSeed.legacyAssemblies.map(norm));
    let legacyCount = 0;
    for (const p of master.parts) {
      if (legacySet.has(norm(p.partNo))) { p.legacy = true; legacyCount++; }
    }
    if (legacyCount) console.log(`Mark legacy assemblies: ${legacyCount} 筆舊版組件（未列入客戶組件版本清單 2026-08-05）`);
  }

  // 第二階 SSOT ERP 計算欄位（所有欄位定稿後，最後計算）
  computeErpFields(master);

  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(master, null, 2), 'utf-8');

  console.log(`Successfully built master table to ${OUTPUT_PATH}!`);
  console.log(`Total Parts: ${master.parts.length}, Assemblies: ${Object.keys(master.bom.children).length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildMaster();
}
