import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const RAW_SEED_PATH = join(ROOT_DIR, 'rawdata', 'master_table_unified.json');
const OUTPUT_PATH = join(ROOT_DIR, 'data', 'pn-lookup-master.json');

export function convertUnifiedSeedToMaster(seedData) {
  const partsMap = new Map();

  // 別稱只接受品號格式（排除備註/說明文字被誤錄為別稱）
  function sanitizeAlternates(alts) {
    if (!Array.isArray(alts)) return [];
    return Array.from(new Set(alts.filter((a) => typeof a === 'string' && /^[A-Z0-9][A-Z0-9-]*$/i.test(a))));
  }

  function addPart(p) {
    if (!p.partNo) return;
    const alternates = sanitizeAlternates(p.alternates);
    const existing = partsMap.get(p.partNo);
    if (!existing) {
      partsMap.set(p.partNo, {
        id: p.partNo,
        partNo: p.partNo,
        name: p.name || p.partNo,
        customer: p.customer || '',
        category: p.category || '單品零件',
        color: p.color || '',
        material: p.material || '',
        notes: p.notes || '',
        alternates,
      });
    } else {
      if (!existing.customer && p.customer) existing.customer = p.customer;
      if ((!existing.name || existing.name === existing.partNo) && p.name) existing.name = p.name;
      if (!existing.color && p.color) existing.color = p.color;
      if (!existing.material && p.material) existing.material = p.material;
      if (alternates.length > 0) {
        existing.alternates = sanitizeAlternates([...existing.alternates, ...alternates]);
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
        // 廠內品號：掛上客戶料號 + 圖面編號做別稱
        addPart({
          partNo: internalNo,
          name,
          customer: cpn['客戶'] || '',
          alternates: [custNo, drawingNo].filter(Boolean),
        });
      }
      if (custNo && custNo !== internalNo) {
        // 客戶料號本身亦為有效品項，圖面編號為其別稱
        addPart({
          partNo: custNo,
          name: cpn['零件名稱(英)'] || cpn['零件名稱(中)'] || custNo,
          customer: cpn['客戶'] || '',
          alternates: [internalNo || drawingNo].filter(Boolean),
        });
      }
    }
  }

  // 4. bomHierarchy
  const childrenMap = {};
  const parentsMap = {};

  function addBomLink(parent, child) {
    if (!parent || !child) return;
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
              if (childNo) {
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

  mkdirSync(join(ROOT_DIR, 'data'), { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(master, null, 2), 'utf-8');
  console.log(`Successfully built master table to ${OUTPUT_PATH}!`);
  console.log(`Total Parts: ${master.parts.length}, Assemblies: ${Object.keys(master.bom.children).length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  buildMaster();
}
