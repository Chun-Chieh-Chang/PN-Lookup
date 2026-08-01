import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const RAW_SEED_PATH = join(ROOT_DIR, 'rawdata', 'master_table_unified.json');
const OUTPUT_PATH = join(ROOT_DIR, 'data', 'pn-lookup-master.json');

export function convertUnifiedSeedToMaster(seedData) {
  const partsMap = new Map();

  function addPart(p) {
    if (!p.partNo) return;
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
        alternates: p.alternates ? Array.from(new Set(p.alternates)) : [],
      });
    } else {
      if (!existing.customer && p.customer) existing.customer = p.customer;
      if ((!existing.name || existing.name === existing.partNo) && p.name) existing.name = p.name;
      if (!existing.color && p.color) existing.color = p.color;
      if (!existing.material && p.material) existing.material = p.material;
      if (p.alternates) {
        existing.alternates = Array.from(new Set([...existing.alternates, ...p.alternates]));
      }
    }
  }

  // 1. internalParts
  if (Array.isArray(seedData.internalParts)) {
    for (const ip of seedData.internalParts) {
      const partNo = ip['產品編號'] || ip['partNo'];
      if (!partNo) continue;
      const alternates = [];
      if (ip['零件編號(客)']) alternates.push(ip['零件編號(客)']);
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
      const partNo = cp['品號'] || cp['partNo'];
      if (!partNo) continue;
      addPart({
        partNo,
        name: cp['品名'] || partNo,
        customer: cp['客戶'] || '',
      });
    }
  }

  // 3. customerPartNumbers
  if (Array.isArray(seedData.customerPartNumbers)) {
    for (const cpn of seedData.customerPartNumbers) {
      const internalNo = cpn['對應廠內料號'] || cpn['partNo'];
      const custNo = cpn['客戶料號'] || cpn['customerPartNo'];
      if (internalNo) {
        const alternates = custNo ? [custNo] : [];
        addPart({
          partNo: internalNo,
          name: cpn['名稱'] || internalNo,
          customer: cpn['客戶'] || '',
          alternates,
        });
      }
      if (custNo && custNo !== internalNo) {
        addPart({
          partNo: custNo,
          name: cpn['名稱'] || custNo,
          customer: cpn['客戶'] || '',
          alternates: internalNo ? [internalNo] : [],
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
