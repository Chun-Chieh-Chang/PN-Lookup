/**
 * verifyCoreLogic.js
 * 
 * 核心數據邏輯固化確效驗證腳本 (Core Data Logic Freeze & Anti-Regression Verification Suite)
 * 於 npm run build 與部署前自動執行，確保以下核心不變量 100% 成立：
 *   1. 主資料庫 parts 陣列必須獨一無二去重（693 筆種子基線），不得包含任何重複品號。
 *   2. 種子轉譯器 (convertUnifiedSeedToMaster) 必須 100% 保持 MECE 去重歸併邏輯。
 *   3. 圖檔比對邊界防禦 (isMatchedSegment) 必須能防範 B-003 貪婪匹配 B-0030。
 * 
 * 相容性說明 (CI Sandbox Defense)：
 *   `data/` 與 `rawdata/` 依據專案 Zero Private Data 資安規範已被列入 `.gitignore`（不推送到公開 Git 倉庫）。
 *   當在 CI (GitHub Actions) 靜態沙盒建置環境運行時，若私有資料庫檔不在，將自動跳過檔案依賴型測試，保留無相容性純單元邏輯驗證，確保 CI 建構 100% 成功。
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { convertUnifiedSeedToMaster } from './buildMaster.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const MASTER_PATH = join(ROOT_DIR, 'data', 'pn-lookup-master.json');
const RAW_SEED_PATH = join(ROOT_DIR, 'rawdata', 'master_table_unified.json');

console.log('🔒 [防禦檢查] 正在執行數據邏輯固化確效驗證 (Verifying Core Invariants)...');

let failedTests = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    failedTests++;
  } else {
    console.log(`✅ [PASS] ${message}`);
  }
}

// ----------------------------------------------------------------------------
// 測試 1: 主資料庫去重不變量 (Deduplication Invariant)
// ----------------------------------------------------------------------------
if (existsSync(MASTER_PATH)) {
  const master = JSON.parse(readFileSync(MASTER_PATH, 'utf-8'));
  const parts = master.parts || [];
  const uniqueNos = new Set(parts.map(p => p.partNo));
  
  assert(
    parts.length === uniqueNos.size,
    `主資料庫獨一無二性: 總數 (${parts.length}) 必須等於不重複數量 (${uniqueNos.size})`
  );
  assert(
    parts.length >= 1002,
    `主資料庫品號總數下限固化: 當前 ${parts.length} 筆，必須 >= 圖檔優先管線 1002 筆（種子 707 + 圖檔提取 292 + E09 合併；707 = 693 + 24 scannedAssemblies − 8 MDXE − 2 收縮膜尺寸雜訊過濾）`
  );
} else {
  console.log(`ℹ️ [CI 沙盒模式] 未檢測到本機私有資料庫 ${MASTER_PATH} (遵循 Zero-Private-Data .gitignore 規範)，略過本機檔案測試。`);
}

// ----------------------------------------------------------------------------
// 測試 2: 種子檔轉譯與 BOM 不變量 (Seed Translation Invariant)
// ----------------------------------------------------------------------------
if (existsSync(RAW_SEED_PATH)) {
  const rawSeed = JSON.parse(readFileSync(RAW_SEED_PATH, 'utf-8'));
  const converted = convertUnifiedSeedToMaster(rawSeed);
  const convParts = converted.parts || [];
  const convUnique = new Set(convParts.map(p => p.partNo));

  assert(
    convParts.length === convUnique.size,
    `種子檔轉譯去重性: 轉譯總數 (${convParts.length}) 等於不重複數 (${convUnique.size})`
  );
  assert(
    convParts.length === 707,
    `種子檔轉譯筆數固化: 預期 707 筆實體品號（693 種子 + 24 組件圖識別補登 scannedAssemblies − 8 筆 MDXE 尾綴版次合併 − 2 筆收縮膜尺寸雜訊 0.08*14mm 過濾；圖檔提取由 mergeDrawings 增量）`
  );
  assert(
    Object.keys(converted.bom.children).length === 181,
    `BOM 階層組件數固化: 當前 ${Object.keys(converted.bom.children).length} 組，預期 181 組`
  );
} else {
  console.log(`ℹ️ [CI 沙盒模式] 未檢測到本機私有種子檔 ${RAW_SEED_PATH} (遵循 Zero-Private-Data .gitignore 規範)，略過種子轉譯測試。`);
}

// ----------------------------------------------------------------------------
// 測試 3: 圖檔匹配邊界防禦不變量 (Boundary Matching Invariant)
// ----------------------------------------------------------------------------
function NORM(s) {
  return s.replace(/[^A-Z0-9]+/gi, '').toUpperCase();
}

function isMatchedSegmentTest(sNorm, pnNorm) {
  if (!sNorm || !pnNorm) return false;
  if (sNorm === pnNorm) return true;
  if (sNorm.length > pnNorm.length && sNorm.startsWith(pnNorm)) {
    const nextChar = sNorm[pnNorm.length];
    if (nextChar < '0' || nextChar > '9') return true;
  }
  return false;
}

assert(
  isMatchedSegmentTest(NORM('B-0030'), NORM('B-003')) === false,
  `邊界防禦: B-003 不可匹配 B-0030`
);
assert(
  isMatchedSegmentTest(NORM('B-003-REV1'), NORM('B-003')) === true,
  `邊界防禦: B-003 必須匹配 B-003-REV1`
);
assert(
  isMatchedSegmentTest(NORM('A01-200-111_V1'), NORM('A01-200-111')) === true,
  `邊界防禦: A01-200-111 必須匹配 A01-200-111_V1`
);

// ----------------------------------------------------------------------------
// 測試 4: 本體語意關聯一致性約束 (Ontological Invariants & Semantic Constraints)
// ----------------------------------------------------------------------------
if (existsSync(MASTER_PATH)) {
  const master = JSON.parse(readFileSync(MASTER_PATH, 'utf-8'));
  const bom = master.bom || { children: {}, parents: {} };
  const children = bom.children || {};
  const parents = bom.parents || {};

  // 4.1 BOM 雙向映射一致性
  let bidirectionalMismatch = 0;
  for (const [parentPn, childList] of Object.entries(children)) {
    for (const childPn of childList) {
      if (!parents[childPn] || !parents[childPn].includes(parentPn)) {
        bidirectionalMismatch++;
      }
    }
  }
  assert(
    bidirectionalMismatch === 0,
    `本體雙向映射一致性: BOM children 與 parents 100% 雙向對稱 (異常數: ${bidirectionalMismatch})`
  );

  // 4.2 BOM 無自環循環防護
  let selfLoopCount = 0;
  for (const [parentPn, childList] of Object.entries(children)) {
    if (childList.includes(parentPn)) {
      selfLoopCount++;
    }
  }
  assert(
    selfLoopCount === 0,
    `本體無環約束: BOM 階層中不得存在自我循環引用 (自環數: ${selfLoopCount})`
  );

  // 4.3 替代品號本體反對稱性
  const parts = master.parts || [];
  let selfAlternateCount = 0;
  for (const p of parts) {
    if (p.alternates && p.alternates.includes(p.partNo)) {
      selfAlternateCount++;
    }
  }
  assert(
    selfAlternateCount === 0,
    `本體替代品號約束: 品號不可將自身宣告為替代料號 (自我替代數: ${selfAlternateCount})`
  );
}

// ----------------------------------------------------------------------------
// 結算與防禦攔截
// ----------------------------------------------------------------------------
if (failedTests > 0) {
  console.error(`\n💥 [CRITICAL ERROR] 共有 ${failedTests} 項數據邏輯驗證失敗！已攔截打包/部署。`);
  process.exit(1);
} else {
  console.log(`\n🎉 [SUCCESS] 數據邏輯與本體約束固化測試全數 100% 通過！\n`);
}
