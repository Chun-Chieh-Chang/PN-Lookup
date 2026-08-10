/**
 * mindmapClassifier.ts
 * 
 * 產品思維導圖分類引擎 (MindMap Classifier Engine)
 * 依據「產品識別教育訓練_Rev. 02_2025-11-05.pdf」的完整分類知識建構。
 * 
 * 分類體系：
 *   A. 廠內品號 → 零件 (Component) / 組件 (Sub-assembly) / Set
 *   B. 客戶品號 → ICU (插袋針/採藥針及其子類) / BD / MPS / Biometrix / Vivus
 *   C. 未分類 → 待人工分類
 */

import { PartItem } from '../types';

// ────────────────────────────────────────────────────────────────────────────
// 型別定義
// ────────────────────────────────────────────────────────────────────────────

export type MindMapCategory =
  // 廠內零件
  | 'factory_part_t_connector'       // T接頭 A01/A02/A03
  | 'factory_part_y_connector'       // Y管 B05/B06
  | 'factory_part_mll'               // 針基/轉式 C09/C11
  | 'factory_part_fll'               // 針基/滑式 D09/D10
  | 'factory_part_cap'               // 針基蓋 E09/E10/E11
  | 'factory_part_clamp'             // 夾具 F17/F18
  | 'factory_part_other'             // 其他 G05/G13/H00
  | 'factory_part_k_connector'       // 連接管 K07/K08/K27
  | 'factory_part_q_barbed'          // 倒鉤式 Q09/Q10
  // 廠內組件
  | 'factory_asm_sa'                 // SA 組件 (2pcs)
  | 'factory_asm_sb'                 // SB 組件 (3pcs)
  | 'factory_asm_sc'                 // SC 組件 (4pcs)
  | 'factory_asm_sd'                 // SD 組件 (5pcs)
  | 'factory_asm_special'            // 特殊組件 (3M41459 等)
  // 廠內 Set
  | 'factory_set_mdxe'               // MDXE Extension set (不含插入針)
  | 'factory_set_mdxi'               // MDXI I.V. set (含插入針)
  // 客戶 ICU - 插袋針 (Bag spike)
  | 'customer_icu_bag_vented_port'   // 透氣口 (有透氣口/過濾網) R1-8026/R1-8027/R1-15460
  | 'customer_icu_bag_vented_clave'  // 透氣-有鼻子 (Clave) R1-8028/R1-15456/RAW0000335
  | 'customer_icu_bag_nonvented'     // 不透氣 (僅握把) R1-8029/R1-8030/R1-8577
  | 'customer_icu_bag_cap'           // 插袋針蓋 R1-8112
  // 客戶 ICU - 採藥針 (Vial spike)
  | 'customer_icu_vial_nipple'       // 奶嘴 (圓盤) R1-8391/R1-15951
  | 'customer_icu_vial_9035'         // 9035 (兩個翅膀) R1-9035
  | 'customer_icu_vial_flower'       // 花系列 (四個爪子) R1-10134/R1-10260/R1-10226
  | 'customer_icu_vial_cap'          // 採藥針蓋 R1-15853
  // 客戶其他
  | 'customer_bd'                    // BD (購買Set及零件)
  | 'customer_mps'                   // MPS
  | 'customer_biometrix'             // Biometrix
  | 'customer_vivus'                 // Vivus (動物使用)
  // 未分類
  | 'unclassified';                  // 待人工分類

interface ClassificationResult {
  category: MindMapCategory;
  breadcrumb: string[];         // 完整路徑，如 ['廠內品號', '零件', 'T接頭 (A01~A03)']
  subLabel?: string;            // 額外子標籤 (例如 "透氣-透氣口 Side port")
  confidence: 'exact' | 'pattern' | 'customer_field' | 'inferred';
}

// ────────────────────────────────────────────────────────────────────────────
// 已知品號精確對照表 (來自 PDF 第26~33頁)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 插袋針 - 透氣口 (有透氣口/過濾網, 針身較短)
 * 特徵: 透氣口 Side port = 透氣過濾端口, 黏管尺寸: 母魯爾或.141"
 */
const BAG_SPIKE_VENTED_PORT_PARTS = new Set([
  'R1-8026',   // 透氣過濾端口, 黏管母魯爾
  'R1-8027',   // 透氣過濾端口, 黏管.141"
  'R1-15460',  // 透氣過濾端口, 黏管.162/.170"
  'R1-15458',  // 組件 (含R1-15460 + 1.2µm白蓋)
  'R1-15457',  // 組件 (含R1-15460 + 1.2µm紅蓋)
  'R1-15784',  // 組件 (含R1-8026 + 0.2µm白蓋)
  'R1-15198',  // 組件 (含R1-8026 + 1.2µm白蓋)
  'R1-15200',  // 組件 (含R1-8027 + 1.2µm白蓋)
]);

/**
 * 插袋針 - 透氣有鼻子 Clave (針尖較尖, 針身較長, 表面光亮)
 * 特徵: 透氣口 Side port = 鼻子, 黏管.141"/.162/.170"
 */
const BAG_SPIKE_VENTED_CLAVE_PARTS = new Set([
  'R1-8028',      // 透氣-鼻子, 黏管.141"
  'R1-15456',     // 透氣-鼻子, 黏管.162/.170"
  'RAW0000335',   // 透氣-鼻子, 針身較長光亮, 黏管.162/.170"
  'R1-15201',     // 組件 (含R1-8028 + 無過濾網連蓋)
  'R1-15459',     // 組件 (含R1-15456 + 無過濾網連蓋)
  'RAW0000336',   // 組件 (含RAW0000335 + 無過濾網連蓋)
]);

/**
 * 插袋針 - 不透氣 (僅握把設計, 無透氣口)
 */
const BAG_SPIKE_NON_VENTED_PARTS = new Set([
  'R1-8029',   // 不透氣, 黏管母魯爾
  'R1-8030',   // 不透氣, 黏管.170"
  'R1-8577',   // 不透氣, 針身較長針尖較尖
  'R1-15202',  // 組件 (含R1-8029 + R1-8112)
  'R1-15203',  // 組件 (含R1-8030 + R1-8112)
]);

/** 插袋針蓋 */
const BAG_SPIKE_CAP_PARTS = new Set(['R1-8112']);

/** 
 * 採藥針 - 奶嘴 (圓盤外型)
 * R1-8391 (針身主體端口較短), R1-15951 (較長)
 */
const VIAL_SPIKE_NIPPLE_PARTS = new Set([
  'R1-8391',   // 奶嘴零件, 較短
  'R1-15951',  // 奶嘴零件, 較長
  'R1-15933',  // 奶嘴組件 (含R1-8391 + R1-15853)
  'R1-15936',  // 奶嘴組件 (含R1-15951 + R1-15853)
]);

/** 
 * 採藥針 - 9035 (兩個翅膀)
 */
const VIAL_SPIKE_9035_PARTS = new Set([
  'R1-9035',   // 9035 兩翼零件
  'R1-15935',  // 9035 組件 (含R1-9035 + R1-15853)
]);

/** 
 * 採藥針 - 花系列 (四個爪子, 分小/中/大花)
 * R1-10134 小花20mm, R1-10260 中花28mm, R1-10226 大花32mm
 */
const VIAL_SPIKE_FLOWER_PARTS = new Set([
  'R1-10134',  // 小花零件, 20mm
  'R1-10260',  // 中花零件, 28mm
  'R1-10226',  // 大花零件, 32mm
  'R1-10149',  // 小花組件 (含R1-10134 + R1-15853)
  'R1-10356',  // 中花組件 (含R1-10260 + R1-15853)
  'R1-10278',  // 大花組件 (含R1-10226 + R1-15853)
]);

/** 採藥針蓋 */
const VIAL_SPIKE_CAP_PARTS = new Set(['R1-15853']);

// ────────────────────────────────────────────────────────────────────────────
// 前綴比對規則 (廠內品號)
// ────────────────────────────────────────────────────────────────────────────

const FACTORY_PREFIX_MAP: Array<{ prefixes: string[]; category: MindMapCategory; label: string }> = [
  { prefixes: ['A01', 'A02', 'A03'], category: 'factory_part_t_connector', label: 'T接頭' },
  { prefixes: ['B05', 'B06'],         category: 'factory_part_y_connector', label: 'Y管' },
  { prefixes: ['C09', 'C11'],         category: 'factory_part_mll',         label: '針基/轉式 (MLL)' },
  { prefixes: ['D09', 'D10'],         category: 'factory_part_fll',         label: '針基/滑式 (FLL)' },
  { prefixes: ['E09', 'E10', 'E11'],  category: 'factory_part_cap',         label: '針基蓋' },
  { prefixes: ['F17', 'F18'],         category: 'factory_part_clamp',       label: '夾具' },
  { prefixes: ['G05', 'G13'],         category: 'factory_part_other',       label: '其他' },
  { prefixes: ['H00'],                category: 'factory_part_other',       label: '其他' },
  { prefixes: ['K07', 'K08', 'K27'], category: 'factory_part_k_connector', label: '連接管 (K系列)' },
  { prefixes: ['Q09', 'Q10'],         category: 'factory_part_q_barbed',   label: '倒鉤式連接器 (Q系列)' },
];

// ────────────────────────────────────────────────────────────────────────────
// 主分類函式
// ────────────────────────────────────────────────────────────────────────────

export function classifyPart(item: PartItem): ClassificationResult {
  const partNo = item.partNo.trim();
  const customerUpper = (item.customer || '').toUpperCase().trim();
  const nameUpper = (item.name || '').toUpperCase();

  // ── 1. 精確比對: ICU 插袋針與採藥針子類 ─────────────────────────────────

  if (BAG_SPIKE_VENTED_PORT_PARTS.has(partNo)) {
    return {
      category: 'customer_icu_bag_vented_port',
      breadcrumb: ['客戶品號', 'ICU', '插袋針 (Bag spike)', '透氣-透氣口 (Side port)'],
      subLabel: '透氣口/過濾網',
      confidence: 'exact',
    };
  }
  if (BAG_SPIKE_VENTED_CLAVE_PARTS.has(partNo)) {
    return {
      category: 'customer_icu_bag_vented_clave',
      breadcrumb: ['客戶品號', 'ICU', '插袋針 (Bag spike)', '透氣-有鼻子 (Clave)'],
      subLabel: '針尖較尖 · 針身較長',
      confidence: 'exact',
    };
  }
  if (BAG_SPIKE_NON_VENTED_PARTS.has(partNo)) {
    return {
      category: 'customer_icu_bag_nonvented',
      breadcrumb: ['客戶品號', 'ICU', '插袋針 (Bag spike)', '不透氣 (僅握把)'],
      subLabel: '無透氣口/過濾網',
      confidence: 'exact',
    };
  }
  if (BAG_SPIKE_CAP_PARTS.has(partNo)) {
    return {
      category: 'customer_icu_bag_cap',
      breadcrumb: ['客戶品號', 'ICU', '插袋針 (Bag spike)', '插袋針蓋 (R1-8112)'],
      subLabel: '防止針尖撞傷',
      confidence: 'exact',
    };
  }
  if (VIAL_SPIKE_NIPPLE_PARTS.has(partNo)) {
    return {
      category: 'customer_icu_vial_nipple',
      breadcrumb: ['客戶品號', 'ICU', '採藥針 (Vial spike)', '奶嘴 (圓盤型)'],
      subLabel: '外型像奶嘴',
      confidence: 'exact',
    };
  }
  if (VIAL_SPIKE_9035_PARTS.has(partNo)) {
    return {
      category: 'customer_icu_vial_9035',
      breadcrumb: ['客戶品號', 'ICU', '採藥針 (Vial spike)', '9035 (兩個翅膀)'],
      subLabel: '兩個翅膀設計',
      confidence: 'exact',
    };
  }
  if (VIAL_SPIKE_FLOWER_PARTS.has(partNo)) {
    const size = partNo === 'R1-10134' || partNo === 'R1-10149' ? '小花 20mm'
               : partNo === 'R1-10260' || partNo === 'R1-10356' ? '中花 28mm'
               : partNo === 'R1-10226' || partNo === 'R1-10278' ? '大花 32mm'
               : '四爪設計';
    return {
      category: 'customer_icu_vial_flower',
      breadcrumb: ['客戶品號', 'ICU', '採藥針 (Vial spike)', '花系列 (四個爪子)'],
      subLabel: size,
      confidence: 'exact',
    };
  }
  if (VIAL_SPIKE_CAP_PARTS.has(partNo)) {
    return {
      category: 'customer_icu_vial_cap',
      breadcrumb: ['客戶品號', 'ICU', '採藥針 (Vial spike)', '採藥針蓋 (R1-15853)'],
      subLabel: '防止針尖撞傷',
      confidence: 'exact',
    };
  }

  // ── 2. 廠內 Set (前綴比對) ────────────────────────────────────────────────

  if (partNo.startsWith('MDXE-') || nameUpper.includes('EXTENSION SET')) {
    return {
      category: 'factory_set_mdxe',
      breadcrumb: ['廠內品號', 'Set', 'MDXE (Extension set, 不含插入針)'],
      confidence: 'pattern',
    };
  }
  if (partNo.startsWith('MDXI-') || nameUpper.includes('I.V. SET')) {
    return {
      category: 'factory_set_mdxi',
      breadcrumb: ['廠內品號', 'Set', 'MDXI (I.V. set, 含插入針)'],
      confidence: 'pattern',
    };
  }

  // ── 3. 廠內組件 (前綴比對) ────────────────────────────────────────────────

  if (partNo.startsWith('SA-') || partNo.startsWith('SA0')) {
    return {
      category: 'factory_asm_sa',
      breadcrumb: ['廠內品號', '組件 (Sub-assembly)', 'SA 系列 (2 pcs)'],
      confidence: 'pattern',
    };
  }
  if (partNo.startsWith('SB-') || partNo.startsWith('SB0')) {
    return {
      category: 'factory_asm_sb',
      breadcrumb: ['廠內品號', '組件 (Sub-assembly)', 'SB 系列 (3 pcs)'],
      confidence: 'pattern',
    };
  }
  if (partNo.startsWith('SC-') || partNo.startsWith('SC0')) {
    return {
      category: 'factory_asm_sc',
      breadcrumb: ['廠內品號', '組件 (Sub-assembly)', 'SC 系列 (4 pcs)'],
      confidence: 'pattern',
    };
  }
  if (partNo.startsWith('SD-') || partNo.startsWith('SD0')) {
    return {
      category: 'factory_asm_sd',
      breadcrumb: ['廠內品號', '組件 (Sub-assembly)', 'SD 系列 (5 pcs)'],
      confidence: 'pattern',
    };
  }

  // ── 4. 廠內零件 (前綴 XXX- 或 XXXYYY 格式) ────────────────────────────────

  // 零件品號格式: "C09-410-211" (前3碼為品號碼, 後接"-")
  // 或直接前3碼比對
  const pnCode = partNo.substring(0, 3);
  for (const rule of FACTORY_PREFIX_MAP) {
    if (rule.prefixes.includes(pnCode)) {
      return {
        category: rule.category,
        breadcrumb: ['廠內品號', '零件 (Component)', rule.label],
        confidence: 'pattern',
      };
    }
  }

  // ── 5. 特殊組件 (廠內特殊品號如 3M41459) ────────────────────────────────

  if (partNo === '3M41459') {
    return {
      category: 'factory_asm_special',
      breadcrumb: ['廠內品號', '組件 (Sub-assembly)', '特殊品號'],
      subLabel: '特殊規格組件',
      confidence: 'exact',
    };
  }

  // ── 6. 客戶品號 - 根據品號前綴或 customer 欄位 ────────────────────────────

  // ICU 品號前綴模式: R1-, 27-, 75-, CIV-, RAW-
  if (
    partNo.startsWith('R1-') ||
    partNo.startsWith('27-') ||
    partNo.startsWith('75-') ||
    partNo.startsWith('CIV') ||
    partNo.startsWith('RAW') ||
    customerUpper.includes('ICU')
  ) {
    // 嘗試從品號名稱推斷是插袋針還是採藥針
    const isVial = nameUpper.includes('VIAL') || nameUpper.includes('採藥');
    const isBag = nameUpper.includes('BAG') || nameUpper.includes('插袋');
    if (isVial) {
      return {
        category: 'customer_icu_vial_flower',
        breadcrumb: ['客戶品號', 'ICU', '採藥針 (Vial spike)', '未細分'],
        confidence: 'inferred',
      };
    }
    if (isBag) {
      return {
        category: 'customer_icu_bag_vented_port',
        breadcrumb: ['客戶品號', 'ICU', '插袋針 (Bag spike)', '未細分'],
        confidence: 'inferred',
      };
    }
    // 無法細分，歸入 ICU 不透氣 (最常見基礎型)
    return {
      category: 'customer_icu_bag_nonvented',
      breadcrumb: ['客戶品號', 'ICU', '插入針系列 (未細分)'],
      confidence: 'inferred',
    };
  }

  // BD 品號: 8013945, 8003875, X3299AAM
  if (
    customerUpper.includes('BD') ||
    /^(8013945|8003875|X3299AAM)/.test(partNo)
  ) {
    return {
      category: 'customer_bd',
      breadcrumb: ['客戶品號', 'BD', '購買 Set 及零件'],
      confidence: customerUpper.includes('BD') ? 'customer_field' : 'pattern',
    };
  }

  // MPS 品號: EB 開頭
  if (customerUpper.includes('MPS') || partNo.startsWith('EB')) {
    return {
      category: 'customer_mps',
      breadcrumb: ['客戶品號', 'MPS', 'Set 以 MPS 品號下單'],
      confidence: customerUpper.includes('MPS') ? 'customer_field' : 'pattern',
    };
  }

  // Biometrix 品號: MDXE-093-01, 9CH090
  if (
    customerUpper.includes('BIOMETRIX') ||
    partNo === 'MDXE-093-01' ||
    partNo === '9CH090'
  ) {
    return {
      category: 'customer_biometrix',
      breadcrumb: ['客戶品號', 'Biometrix', '購買 Set (MDXE-093-01)'],
      confidence: 'customer_field',
    };
  }

  // Vivus 品號: XSN 開頭 (Animalcare 品號)
  if (customerUpper.includes('VIVUS') || customerUpper.includes('ANIMALCARE') || partNo.startsWith('XSN')) {
    return {
      category: 'customer_vivus',
      breadcrumb: ['客戶品號', 'Vivus (動物使用)', '廠內品號下單 MDXE-XXX'],
      confidence: customerUpper.includes('VIVUS') ? 'customer_field' : 'pattern',
    };
  }

  // ── 7. 無法分類 ────────────────────────────────────────────────────────────
  return {
    category: 'unclassified',
    breadcrumb: ['待人工分類'],
    confidence: 'inferred',
  };
}
