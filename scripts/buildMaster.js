import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const RAW_SEED_PATH = join(ROOT_DIR, 'rawdata', 'master_table_unified.json');
const OUTPUT_PATH = join(ROOT_DIR, 'data', 'pn-lookup-master.json');
const EXTRACT_PATH = join(ROOT_DIR, 'data', 'drawings-extract.json');

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
    delete master.bom.children[owner];
    for (const k of kids) {
      const arr = master.bom.parents[k];
      if (arr) master.bom.parents[k] = arr.filter((p) => p !== owner);
      if (master.bom.parents[k] && master.bom.parents[k].length === 0) delete master.bom.parents[k];
    }
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
      if (p && p.category === '單品零件' && it.role === '組件' && (it.bomLinks || []).length) {
        p.category = '組件圖候補';
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
          addPart({
            partNo: assemblyId,
            name: item.name || assemblyId,
            category: levelKey + '組立',
          });
          if (Array.isArray(item.children)) {
            for (const child of item.children) {
              const childNo = typeof child === 'string' ? child : (child.partNo || child.id);
              // v7.8.8 過濾 Excel 組件表雜訊（非品號 token：收縮膜尺寸 0.08*14mm、日期連寫等）
              if (!childNo || !/^[A-Z0-9][A-Z0-9_.\-]*$/i.test(childNo) || /\*/.test(childNo)) continue;
              addBomLink(assemblyId, childNo);
              addPart({
                partNo: childNo,
                name: typeof child === 'object' ? child.name : childNo,
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
