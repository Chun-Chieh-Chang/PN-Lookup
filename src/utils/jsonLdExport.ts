import { PartItem } from '../types';

/**
 * 產生符合 Schema.org 與 W3C JSON-LD 規範之醫療器材知識本體結構 (Semantic Knowledge Ontology)
 */
export function generateJsonLdOntology(parts: PartItem[]): string {
  const ontologyGraph = {
    '@context': {
      '@vocab': 'https://schema.org/',
      'mouldex': 'https://mouldex-medical.com/ontology/',
      'partNo': 'mouldex:partNo',
      'itemType': 'mouldex:itemType',
      'isComponentOf': {
        '@id': 'mouldex:isComponentOf',
        '@type': '@id',
      },
      'hasComponent': {
        '@id': 'mouldex:hasComponent',
        '@type': '@id',
      },
      'alternateOf': {
        '@id': 'mouldex:alternateOf',
        '@type': '@id',
      },
    },
    '@id': 'https://mouldex-medical.com/ontology/dataset/parts-catalog',
    '@type': 'DataFeed',
    'name': '凱益醫療器材產品與 BOM 知識本體目錄 (Medical Parts & BOM Ontology)',
    'description': '符合 Schema.org 語意規範之醫療器材零件、組件與替代品號關聯知識本體。',
    'dataFeedElement': parts.map((p) => {
      const isAssembly = p.itemType === 'assembly';
      const entity: Record<string, unknown> = {
        '@id': `urn:mouldex:part:${encodeURIComponent(p.partNo)}`,
        '@type': isAssembly ? ['Product', 'MedicalDevice'] : 'Product',
        'identifier': p.partNo,
        'name': p.name || p.partNo,
        'category': p.category || 'Uncategorized',
      };

      if (p.customer) {
        entity['manufacturer'] = {
          '@type': 'Organization',
          'name': p.customer,
        };
      }

      if (p.notes) {
        entity['description'] = p.notes;
      }

      if (p.alternates && p.alternates.length > 0) {
        entity['alternateName'] = p.alternates;
        entity['alternateOf'] = p.alternates.map((alt) => `urn:mouldex:part:${encodeURIComponent(alt)}`);
      }

      if (p.components && p.components.length > 0) {
        entity['hasComponent'] = p.components.map((c) => `urn:mouldex:part:${encodeURIComponent(c)}`);
      }

      if (p.usedInAssemblies && p.usedInAssemblies.length > 0) {
        entity['isComponentOf'] = p.usedInAssemblies.map((a) => `urn:mouldex:part:${encodeURIComponent(a)}`);
        entity['isAccessoryOrSparePartFor'] = p.usedInAssemblies.map((a) => `urn:mouldex:part:${encodeURIComponent(a)}`);
      }

      return entity;
    }),
  };

  return JSON.stringify(ontologyGraph, null, 2);
}
