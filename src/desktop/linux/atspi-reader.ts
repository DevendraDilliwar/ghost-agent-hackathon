import { sessionBus } from 'dbus-next';
import type { GroundedElement, UIElementType } from '../../shared/contracts/grounding';

/** One AT-SPI node behind the smallest D-Bus surface the tree walk needs. */
export interface AtspiNode {
  roleName(): Promise<unknown>;
  name(): Promise<unknown>;
  extents(): Promise<unknown>;
  childCount(): Promise<unknown>;
  childAt(index: number): Promise<unknown>;
}

export interface AtspiScope {
  readonly root: AtspiNode;
  node(busName: string, path: string): Promise<AtspiNode>;
  close(): void;
}

export interface AtspiConnector {
  connect(): Promise<AtspiScope>;
}

interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const MAX_NODES = 300;
const MAX_DEPTH = 16;
const MAX_CHILDREN_PER_NODE = 200;

const ROLE_TYPES: Record<string, UIElementType> = {
  'push button': 'button', 'toggle button': 'button', 'check box': 'button', 'radio button': 'button', 'page tab': 'button',
  'menu item': 'menu', 'check menu item': 'menu', 'radio menu item': 'menu',
  'combo box': 'input', entry: 'input', 'password text': 'input', text: 'input', 'document text': 'input', terminal: 'input', 'spin button': 'input',
  link: 'link', 'list item': 'interactive',
};

function asCount(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return 0;
  return Math.min(value, MAX_CHILDREN_PER_NODE);
}

function asBox(value: unknown): Box | null {
  if (Array.isArray(value)) return boxFromList(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return boxFromList([record.x, record.y, record.width, record.height]);
  }
  return null;
}

function boxFromList(fields: unknown[]): Box | null {
  const [x, y, width, height] = [fields[0], fields[1], fields[2], fields[3]];
  if (typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number') return null;
  if (![x, y, width, height].every(Number.isFinite)) return null;
  return { x, y, width, height };
}

function asBusPair(value: unknown): [string, string] | null {
  if (!Array.isArray(value) || typeof value[0] !== 'string' || typeof value[1] !== 'string') return null;
  return [value[0], value[1]];
}

async function settled(work: Promise<unknown>): Promise<unknown> {
  try {
    return await work;
  } catch {
    return null;
  }
}

async function walk(scope: AtspiScope, signal: AbortSignal): Promise<GroundedElement[]> {
  const found: GroundedElement[] = [];
  const queue: Array<{ node: AtspiNode; depth: number }> = [{ node: scope.root, depth: 0 }];
  let visited = 0;
  while (queue.length && visited < MAX_NODES) {
    if (signal.aborted) break;
    const current = queue.shift();
    if (!current) break;
    visited += 1;
    const roleRaw = await settled(current.node.roleName());
    const role = typeof roleRaw === 'string' ? roleRaw : null;
    const mapped = role ? ROLE_TYPES[role] : undefined;
    if (role && mapped) {
      try {
        const rawName = await current.node.name();
        const box = asBox(await current.node.extents());
        if (box && box.width >= 3 && box.height >= 3) {
          const label = typeof rawName === 'string' && rawName.trim() ? rawName.trim().slice(0, 120) : null;
          found.push({
            id: found.length + 1, type: mapped,
            ...(label ? { label } : {}),
            bounds: box, center: { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }, confidence: 0.9,
          });
        }
      } catch {
        // Unreadable element: skip it but keep walking its siblings.
      }
    }
    if (current.depth >= MAX_DEPTH) continue;
    const count = asCount(await settled(current.node.childCount()));
    for (let index = 0; index < count && visited + queue.length < MAX_NODES; index++) {
      const pair = asBusPair(await settled(current.node.childAt(index)));
      if (!pair) continue;
      try {
        queue.push({ node: await scope.node(pair[0], pair[1]), depth: current.depth + 1 });
      } catch {
        // Dead child: skip it but keep walking its siblings.
      }
    }
  }
  return found;
}

interface DbUsObject {
  getInterface(name: string): Record<string, (...args: unknown[]) => Promise<unknown>>;
}

function wrapNode(obj: DbUsObject): AtspiNode {
  const call = (iface: string, name: string, ...args: unknown[]): Promise<unknown> => {
    const fn = obj.getInterface(iface)[name];
    if (!fn) throw new Error('Missing D-Bus method ' + iface + '.' + name + '.');
    return fn(...args);
  };
  return {
    roleName: () => call('org.a11y.atspi.Accessible', 'GetRoleName'),
    name: () => call('org.a11y.atspi.Accessible', 'GetName'),
    extents: () => call('org.a11y.atspi.Component', 'GetExtents', 0),
    childCount: () => call('org.a11y.atspi.Accessible', 'GetChildCount'),
    childAt: (index: number) => call('org.a11y.atspi.Accessible', 'GetChildAtIndex', index),
  };
}

async function connectDbusScope(): Promise<AtspiScope> {
  const session = sessionBus();
  let address: string | null;
  try {
    const registry = await session.getProxyObject('org.a11y.Bus', '/org/a11y/bus');
    const getAddress = registry.getInterface('org.a11y.Bus').GetAddress;
    if (!getAddress) throw new Error('AT-SPI bus address unavailable.');
    const raw: unknown = await getAddress();
    address = typeof raw === 'string' && raw ? raw : null;
  } finally {
    session.disconnect();
  }
  if (!address) throw new Error('AT-SPI bus address unavailable.');
  const bus = sessionBus({ busAddress: address });
  bus.on('error', () => undefined);
  const rootObj = await bus.getProxyObject('org.a11y.atspi.Registry', '/org/a11y/atspi/accessible/root');
  return {
    root: wrapNode(rootObj as unknown as DbUsObject),
    node: async (busName: string, path: string) => wrapNode((await bus.getProxyObject(busName, path)) as unknown as DbUsObject),
    close: () => bus.disconnect(),
  };
}

/**
 * Creates an AT-SPI element detector for Linux desktops. Resolves [] when the
 * accessibility bus is missing or unreachable — grounding stays optional.
 */
export function createAtspiDetector(connector?: AtspiConnector): (signal: AbortSignal) => Promise<GroundedElement[]> {
  const source = connector ?? { connect: connectDbusScope };
  return async signal => {
    let scope: AtspiScope | null = null;
    try {
      scope = await source.connect();
      return await walk(scope, signal);
    } catch {
      return [];
    } finally {
      try {
        scope?.close();
      } catch {
        // Closing a dead bus must never fail detection.
      }
    }
  };
}
