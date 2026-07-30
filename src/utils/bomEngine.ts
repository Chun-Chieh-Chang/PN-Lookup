import { PartItem, ItemType } from '../types';
import { BOM_CHILDREN, BOM_PARENTS, ASSEMBLY_PART_NOS } from '../data/bomData';

export function enrichParts(parts: PartItem[]): PartItem[] {
  return parts.map((p) => {
    const isAssembly = ASSEMBLY_PART_NOS.has(p.partNo) || ASSEMBLY_PART_NOS.has(p.partNo.toUpperCase());
    const children = BOM_CHILDREN[p.partNo] || BOM_CHILDREN[p.partNo.toUpperCase()];
    const parents = BOM_PARENTS[p.partNo] || BOM_PARENTS[p.partNo.toUpperCase()];
    return {
      ...p,
      itemType: p.itemType || (isAssembly ? 'assembly' as const : 'part' as const),
      components: p.components && p.components.length > 0 ? p.components : (children ? [...children] : undefined),
      usedInAssemblies: p.usedInAssemblies && p.usedInAssemblies.length > 0 ? p.usedInAssemblies : (parents ? [...parents] : undefined),
    };
  });
}

export interface BOMRelation {
  relatedItem: PartItem;
  relationType: 'child_component' | 'parent_assembly';
  note: string;
}

export function getItemType(item: PartItem): ItemType {
  if (item.itemType) return item.itemType;

  const upperPartNo = item.partNo.toUpperCase();

  // Known assembly part numbers from SA/SB/SC/SD sheets
  if (ASSEMBLY_PART_NOS.has(upperPartNo) || ASSEMBLY_PART_NOS.has(item.partNo)) {
    return 'assembly';
  }

  return 'part';
}

function findPartByNo(partNo: string, allParts: PartItem[]): PartItem | undefined {
  return allParts.find((p) => p.partNo === partNo || p.id === partNo);
}

function resolveChildrenRecursive(
  assemblyPartNo: string,
  allParts: PartItem[],
  visited: Set<string>,
  depth: number
): BOMRelation[] {
  const results: BOMRelation[] = [];
  if (depth > 5 || visited.has(assemblyPartNo)) return results;
  visited.add(assemblyPartNo);

  const children = BOM_CHILDREN[assemblyPartNo];
  if (!children) return results;

  for (const childNo of children) {
    const part = findPartByNo(childNo, allParts);
    if (part) {
      results.push({
        relatedItem: part,
        relationType: 'child_component',
        note: `構成組件 (${childNo})`,
      });
    }
    // Recurse if child is also an assembly
    if (ASSEMBLY_PART_NOS.has(childNo)) {
      const subComponents = resolveChildrenRecursive(childNo, allParts, visited, depth + 1);
      for (const sub of subComponents) {
        if (!results.some((r) => r.relatedItem.id === sub.relatedItem.id)) {
          results.push(sub);
        }
      }
    }
  }

  return results;
}

export function getComponentsForAssembly(
  assembly: PartItem,
  allParts: PartItem[]
): BOMRelation[] {
  const results: BOMRelation[] = [];
  const addedIds = new Set<string>();

  // 1. If explicit components array exists (user-defined)
  if (assembly.components && assembly.components.length > 0) {
    for (const cRef of assembly.components) {
      const match = allParts.find(
        (p) => p.partNo === cRef || p.name === cRef || p.id === cRef
      );
      if (match && !addedIds.has(match.id)) {
        addedIds.add(match.id);
        results.push({
          relatedItem: match,
          relationType: 'child_component',
          note: '自訂物料單 (Direct BOM Link)',
        });
      }
    }
  }

  // 2. Data-driven BOM hierarchy from Excel sheets
  const visited = new Set<string>();
  const bomComponents = resolveChildrenRecursive(assembly.partNo, allParts, visited, 0);
  for (const comp of bomComponents) {
    if (!addedIds.has(comp.relatedItem.id)) {
      addedIds.add(comp.relatedItem.id);
      results.push(comp);
    }
  }

  return results;
}

function resolveParentsRecursive(
  partNo: string,
  allParts: PartItem[],
  visited: Set<string>,
  depth: number
): BOMRelation[] {
  const results: BOMRelation[] = [];
  if (depth > 5 || visited.has(partNo)) return results;
  visited.add(partNo);

  const parents = BOM_PARENTS[partNo];
  if (!parents) return results;

  for (const parentNo of parents) {
    const parent = findPartByNo(parentNo, allParts);
    if (parent) {
      results.push({
        relatedItem: parent,
        relationType: 'parent_assembly',
        note: `可組成 ${parent.name}`,
      });
    }
    // Recursively find higher-level assemblies
    if (ASSEMBLY_PART_NOS.has(parentNo)) {
      const grandParents = resolveParentsRecursive(parentNo, allParts, visited, depth + 1);
      for (const gp of grandParents) {
        if (!results.some((r) => r.relatedItem.id === gp.relatedItem.id)) {
          results.push(gp);
        }
      }
    }
  }

  return results;
}

export function getAssembliesForPart(
  part: PartItem,
  allParts: PartItem[]
): BOMRelation[] {
  const results: BOMRelation[] = [];
  const addedIds = new Set<string>();

  // 1. Check explicit usedInAssemblies (user-defined)
  if (part.usedInAssemblies && part.usedInAssemblies.length > 0) {
    for (const aRef of part.usedInAssemblies) {
      const match = allParts.find(
        (p) => p.partNo === aRef || p.name === aRef || p.id === aRef
      );
      if (match && !addedIds.has(match.id)) {
        addedIds.add(match.id);
        results.push({
          relatedItem: match,
          relationType: 'parent_assembly',
          note: '可組成之目標組件 (Explicit Target)',
        });
      }
    }
  }

  // 2. Reverse lookup from BOM_PARENTS (data-driven)
  const visited = new Set<string>();
  const parentAssemblies = resolveParentsRecursive(part.partNo, allParts, visited, 0);
  for (const pa of parentAssemblies) {
    if (!addedIds.has(pa.relatedItem.id)) {
      addedIds.add(pa.relatedItem.id);
      results.push(pa);
    }
  }

  return results;
}
