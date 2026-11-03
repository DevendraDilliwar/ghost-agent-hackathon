import { DOMParser } from '@xmldom/xmldom';

const OFFICE = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
const TEXT = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
const TABLE = 'urn:oasis:names:tc:opendocument:xmlns:table:1.0';

export interface OfficeCell { readonly value: number | null; readonly formula: string }
export interface OfficeContent {
  readonly paragraphs: string[];
  /** Only the four cells used by the bounded Calc acceptance task. */
  readonly cells: ReadonlyMap<string, OfficeCell>;
}

function children(node: Node): Element[] {
  const result: Element[] = [];
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === 1) result.push(child as Element);
  }
  return result;
}

function count(element: Element, attribute: string, limit: number): number {
  const raw = element.getAttributeNS(TABLE, attribute);
  if (!raw) return 1;
  if (!/^[1-9][0-9]*$/.test(raw)) throw new Error('Invalid office repetition.');
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > limit) throw new Error('Office repetition exceeds bounds.');
  return value;
}

function paragraphText(node: Node): string {
  if (node.nodeType === 3 || node.nodeType === 4) return node.nodeValue ?? '';
  const element = node as Element;
  if (element.namespaceURI === TEXT) {
    if (element.localName === 's') {
      const raw = element.getAttributeNS(TEXT, 'c') || '1';
      if (!/^[1-9][0-9]*$/.test(raw) || Number(raw) > 4000) throw new Error('Invalid office spacing.');
      return ' '.repeat(Number(raw));
    }
    if (element.localName === 'tab') return '\t';
    if (element.localName === 'line-break') return '\n';
  }
  let result = '';
  for (let child = node.firstChild; child; child = child.nextSibling) result += paragraphText(child);
  return result;
}

/** Bounded ODF inspection; DTDs/entities are rejected before parsing. No network resolution. */
export function inspectOffice(xml: string, kind: 'text' | 'spreadsheet'): OfficeContent {
  if (Buffer.byteLength(xml) > 1_048_576 || /<!\s*(?:DOCTYPE|ENTITY)\b/i.test(xml)) throw new Error('Unsupported office XML.');
  const invalid = () => { throw new Error('Malformed office XML.'); };
  const doc = new DOMParser({ errorHandler: { warning: invalid, error: invalid, fatalError: invalid } }).parseFromString(xml, 'application/xml');
  const root = doc.documentElement;
  if (root?.namespaceURI !== OFFICE || root.localName !== 'document-content') throw new Error('Invalid office root.');
  const body = children(root).find(node => node.namespaceURI === OFFICE && node.localName === 'body');
  const content = body && children(body).find(node => node.namespaceURI === OFFICE && node.localName === kind);
  if (!content) throw new Error('Missing office body.');
  const paragraphs: string[] = [];
  const cells = new Map<string, OfficeCell>();
  if (kind === 'text') {
    // Ignore headers/styles/annotations: only document-body paragraphs count.
    const visit = (node: Element, depth: number) => {
      if (depth > 32 || paragraphs.length > 1000) throw new Error('Office content exceeds bounds.');
      if (node.namespaceURI === OFFICE && node.localName === 'annotation') return;
      if (node.namespaceURI === TEXT && ['p', 'h'].includes(node.localName ?? '')) paragraphs.push(paragraphText(node));
      else for (const child of children(node)) visit(child, depth + 1);
    };
    visit(content, 0);
  } else {
    const table = children(content).find(node => node.namespaceURI === TABLE && node.localName === 'table');
    if (!table) throw new Error('Missing spreadsheet table.');
    let rowNumber = 1;
    const visitRows = (container: Element, depth: number) => {
      if (depth > 16) throw new Error('Office row nesting exceeds bounds.');
      for (const row of children(container)) {
        if (rowNumber > 4) break;
        if (row.namespaceURI !== TABLE) continue;
        if (['table-header-rows', 'table-rows', 'table-row-group'].includes(row.localName ?? '')) { visitRows(row, depth + 1); continue; }
        if (row.localName !== 'table-row') continue;
        const repeats = count(row, 'number-rows-repeated', 1_048_576);
        const first = children(row).find(node => node.namespaceURI === TABLE && ['table-cell', 'covered-table-cell'].includes(node.localName ?? ''));
        if (first) {
          count(first, 'number-columns-repeated', 16384);
          const raw = first.getAttributeNS(OFFICE, 'value');
          const value = first.getAttributeNS(OFFICE, 'value-type') === 'float' && raw !== null && raw.trim() !== '' && Number.isFinite(Number(raw)) ? Number(raw) : null;
          const cell = { value, formula: first.getAttributeNS(TABLE, 'formula') ?? '' };
          for (let offset = 0; offset < repeats && rowNumber + offset <= 4; offset++) cells.set('A' + (rowNumber + offset), cell);
        }
        rowNumber += repeats;
      }
    };
    visitRows(table, 0);
  }
  return { paragraphs, cells };
}

export function hasExpectedSum(content: OfficeContent): boolean {
  return [10, 20, 30, 60].every((value, index) => content.cells.get('A' + (index + 1))?.value === value) &&
    /^(?:of|oooc):=SUM\(\[?\.?A1:\.?A3\]?\)$/i.test(content.cells.get('A4')?.formula.replace(/\s+/g, '') ?? '');
}
