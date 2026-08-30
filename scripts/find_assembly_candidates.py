import json, re, fitz, sys

with open('data/drawings_extract_v7.json') as f:
    raw = json.load(f)
data = raw['items']

ASSEMBLY_KEYWORDS = [
    'SUB-ASSY', 'SUB ASSY', 'ASSEMBLY', 'COMPONENT',
    'UNIVERSAL VIAL', 'ADAPTOR AND BREATHER', 'ADAPTOR(R1-',
]

def is_in_part_folder(fp):
    parts = fp.replace('\\', '/').split('/')
    return any(p == '零件' for p in parts)

assembly_candidates = []
for d in data:
    fp = d['filePath']
    folder = d.get('folder', '')
    # Only consider files in 零件 directories
    if not is_in_part_folder(fp):
        continue
    # Skip if already has BOM
    if d.get('bomStructure') or d.get('bomItemsCount', 0) > 0:
        continue
    try:
        doc = fitz.open(fp)
        text = ''.join(pg.get_text() for pg in doc)
        doc.close()
    except Exception as e:
        continue
    r1_parts = sorted(set(re.findall(r'R1-\d+', text)))
    main = d.get('partNo', '')
    others = [p for p in r1_parts if p != main]
    desc_upper = d.get('description', '').upper()
    is_asm_desc = any(kw in desc_upper for kw in ASSEMBLY_KEYWORDS)

    # High confidence: 2+ other parts OR assembly description keywords
    if len(others) >= 2 or (len(others) >= 1 and is_asm_desc):
        assembly_candidates.append({
            'fileName': d['fileName'],
            'partNo': main,
            'filePath': fp,
            'folder': folder,
            'r1_parts': r1_parts,
            'other_parts': others,
            'desc': d.get('description', '')[:80],
            'score': len(others) * 2 + (5 if is_asm_desc else 0),
        })

assembly_candidates.sort(key=lambda x: -x['score'])

print(f'Total assembly candidates: {len(assembly_candidates)}')
for c in assembly_candidates[:50]:
    print(f'  [{c["score"]}] {c["fileName"]}')
    print(f'      partNo={c["partNo"]}  R1_parts={c["r1_parts"]}')
    print(f'      desc={repr(c["desc"][:60])}')
    print()

with open('data/assembly_candidates.json', 'w') as f:
    json.dump(assembly_candidates, f, ensure_ascii=False, indent=2)
print(f'Saved {len(assembly_candidates)} candidates to data/assembly_candidates.json')
