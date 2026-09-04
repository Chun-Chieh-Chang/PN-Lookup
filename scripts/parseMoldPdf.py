"""
parseMoldPdf.py  —  解析「產品成型週期與重量.pdf」→ rawdata/內網資訊/mold-specs-parsed.json

輸出欄位（每筆對應 PDF 一行 = 一個模具 × 品號組合）:
  moldNo, designCavity, effectiveCavity, rawPartNo, variantSuffix,
  alias, moldWeight, runnerWeight, weightPerCavity, cycleTime,
  dailyCapacity, materialType, materialSpec, color, ppovVerified

執行: python scripts/parseMoldPdf.py
"""
import json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF_PATH = ROOT / 'rawdata' / '內網資訊' / '產品成型週期與重量.pdf'
OUT_PATH = ROOT / 'rawdata' / '內網資訊' / 'mold-specs-parsed.json'

if not PDF_PATH.exists():
    print(f'⚠️  PDF 不存在，跳過: {PDF_PATH}')
    sys.exit(0)

try:
    import pymupdf
except ImportError:
    print('⚠️  pymupdf 未安裝，跳過: pip install pymupdf')
    sys.exit(0)

# ── 正則定義 ──────────────────────────────────────────────────────────────────
PN_RE = re.compile(
    r'^('
    r'[A-Z][0-9]{2}-[0-9]{3}-[0-9]{3}[A-Z0-9\-]*'   # A01-200-131, C09-410-131-1
    r'|R1-[0-9]+[A-Z]?'                                # R1-2355, R1-9035A
    r'|[0-9]{2}-[0-9]{4}'                              # 27-0246
    r'|712-[0-9]+'                                     # 712-84132-002
    r'|75-[0-9]{4}'                                    # 75-2709
    r'|126-006'
    r'|RAW[0-9]{7}'
    r'|CIV[0-9]{7}'
    r'|CP[0-9]{5}'
    r'|C74-[0-9]+'
    r'|701829'
    r')$'
)
MOLD_RE = re.compile(r'^M[IT][0-9]+[A-Z]?\(?[A-Z]?\)?[0-9]*$')
INT_RE  = re.compile(r'^[0-9]{1,3}$')   # cavity: 1-3 digit integer
NUM_RE  = re.compile(r'^[0-9]+\.?[0-9]*$')
COLORS  = {'本色','白色','紅色','黃色','藍色','綠色','紫色','橘色','黑色','茶色',
           '棕色','薰衣草紫','薄荷綠','米色','莎草紙','淺藍','粉色','深灰'}
MAT_CATS = {'ABS','PVC','PC','HDPE','PP','LDPE','PMMA','PBT','TPE','SBC','PETG'}
SKIP_RE = re.compile(r'更新日期|模具編號|設計穴數|妥善穴數|品號|別稱|整模重量|流道重量|'
                     r'單穴克重|週期時間|日產能|原料類別|原料品號|顏色|備註')

# ── 別稱合法格式（排除原料大類被誤判為別稱）────────────────────────────────
ALIAS_RE = re.compile(r'^[A-Z0-9][A-Za-z0-9\-\.]+$')

def safe_float(s):
    try: return float(s)
    except: return None

def safe_int(s):
    try: return int(s)
    except: return None

# ── 解析 ──────────────────────────────────────────────────────────────────────
doc = pymupdf.open(str(PDF_PATH))
all_text = '\n'.join(page.get_text() for page in doc)
lines = [l.strip() for l in all_text.splitlines() if l.strip()]

rows = []
i = 0
while i < len(lines):
    line = lines[i]

    if SKIP_RE.search(line):
        i += 1; continue

    if not MOLD_RE.match(line):
        i += 1; continue

    mold_no = line; i += 1

    # 設計穴數 / 妥善穴數（可選，1~3 位整數）
    design_cav = good_cav = None
    if i < len(lines) and INT_RE.match(lines[i]):
        design_cav = safe_int(lines[i]); i += 1
    if i < len(lines) and INT_RE.match(lines[i]):
        good_cav = safe_int(lines[i]); i += 1

    # 品號
    if i >= len(lines) or not PN_RE.match(lines[i]):
        continue
    raw_pn = lines[i]; i += 1

    # 別稱（可選）— 不能是數字、顏色、原料大類、模具號
    alias = ''
    if (i < len(lines)
            and not NUM_RE.match(lines[i])
            and lines[i] not in COLORS
            and lines[i] not in MAT_CATS
            and not MOLD_RE.match(lines[i])
            and not SKIP_RE.search(lines[i])
            and ALIAS_RE.match(lines[i])):
        cand = lines[i]
        # 別稱必須像料號（含連字號）或以 R1-/M2x-/B- 開頭
        if re.search(r'[-]', cand) or PN_RE.match(cand):
            alias = cand; i += 1

    # 數值欄位（最多 5 個）
    nums = []
    while i < len(lines) and NUM_RE.match(lines[i]) and len(nums) < 5:
        nums.append(lines[i]); i += 1

    mold_w = safe_float(nums[0]) if len(nums) > 0 else None
    run_w  = safe_float(nums[1]) if len(nums) > 1 else None
    cav_w  = safe_float(nums[2]) if len(nums) > 2 else None
    cycle  = safe_float(nums[3]) if len(nums) > 3 else None
    daily  = safe_int(nums[4])   if len(nums) > 4 else None

    # 原料類別
    mat_type = ''
    if i < len(lines) and lines[i] in MAT_CATS:
        mat_type = lines[i]; i += 1

    # 原料品號（多行直到顏色或新行開始）
    mat_parts = []
    while (i < len(lines)
           and lines[i] not in COLORS
           and not MOLD_RE.match(lines[i])
           and not PN_RE.match(lines[i])
           and not SKIP_RE.search(lines[i])):
        mat_parts.append(lines[i]); i += 1
    mat_spec = ' '.join(mat_parts).strip()

    # 顏色
    color = ''
    if i < len(lines) and lines[i] in COLORS:
        color = lines[i]; i += 1

    # PPOV 驗證
    ppov = False
    if i < len(lines) and 'PPOV' in lines[i]:
        ppov = True; i += 1

    # 模具品號後綴解析（R1-9035A → raw=R1-9035A, suffix=A, canonical=R1-9035）
    # 規則：R1- 品號末尾單大寫字母，且去除後仍符合 R1-\d+ 格式
    variant_suffix = None
    if re.match(r'^R1-[0-9]+[A-Z]$', raw_pn):
        variant_suffix = raw_pn[-1]

    rows.append({
        'moldNo':         mold_no,
        'designCavity':   design_cav,
        'effectiveCavity': good_cav,
        'rawPartNo':      raw_pn,
        'variantSuffix':  variant_suffix,
        'alias':          alias,
        'moldWeight':     mold_w,
        'runnerWeight':   run_w,
        'weightPerCavity': cav_w,
        'cycleTime':      cycle,
        'dailyCapacity':  daily,
        'materialType':   mat_type,
        'materialSpec':   mat_spec,
        'color':          color,
        'ppovVerified':   ppov,
    })

OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
with open(OUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(rows, f, ensure_ascii=False, indent=2)

print(f'✅ 解析完成: {len(rows)} 筆模具規格 → {OUT_PATH}')

# 統計
from collections import Counter
multi = Counter(r['rawPartNo'] for r in rows)
multi_pns = [(pn, c) for pn, c in multi.items() if c > 1]
print(f'   多模具品號: {len(multi_pns)} 件')
variant_pns = [r for r in rows if r['variantSuffix']]
print(f'   品號後綴變體 (R1-xxxA): {len(variant_pns)} 筆')
