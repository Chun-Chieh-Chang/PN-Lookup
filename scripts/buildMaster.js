import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const RAW_SEED_PATH = join(ROOT_DIR, 'rawdata', 'master_table_unified.json');
const OUTPUT_PATH = join(ROOT_DIR, 'data', 'pn-lookup-master.json');
const EXTRACT_PATH = join(ROOT_DIR, 'data', 'drawings-extract.json');
const SEMANTIC_PATH = join(ROOT_DIR, 'data', 'semantic-extract.json');
const ICU_PATH = join(ROOT_DIR, 'data', 'icu-parts.json');

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
    return Array.from(new Set(alts.filter((a) => typeof a === 'string' && /^[A-Z0-9][A-Z0-9-]*$/i.test(a) && a !== selfPartNo)));
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

  // v7.8.15 物料類別三層體系：物料 / 零件 / 組件（SA~SD 組立 + 其他組件）
  // 內部邏輯判斷維持細粒度值（單品零件/零件圖/組件圖候補/物料圖），僅輸出前統一映射
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

  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(master, null, 2), 'utf-8');
  console.log(`Successfully built master table to ${OUTPUT_PATH}!`);
  console.log(`Total Parts: ${master.parts.length}, Assemblies: ${Object.keys(master.bom.children).length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildMaster();
}
