import { EventEmitter } from 'node:events';
import { sessionBus } from 'dbus-next';
import { UIGroundingEngine } from '../../agent/vision/ui-grounding';
import { describe, expect, it, vi } from 'vitest';
import { createAtspiDetector } from './atspi-reader';
import type { AtspiConnector, AtspiNode } from './atspi-reader';

vi.mock('dbus-next', () => ({ sessionBus: vi.fn() }));

function fakeNode(overrides?: Partial<AtspiNode>): AtspiNode {
  return {
    roleName: async () => 'frame',
    name: async () => '',
    extents: async () => null,
    childCount: async () => 0,
    childAt: async () => { throw new Error('no children'); },
    ...overrides,
  };
}

function fakeScope(root: AtspiNode, children: AtspiNode[]): AtspiConnector {
  const queue = [...children];
  return {
    connect: async () => ({
      root,
      node: async () => {
        const next = queue.shift();
        if (!next) throw new Error('unknown child');
        return next;
      },
      close: () => undefined,
    }),
  };
}

function pairs(): (index: number) => Promise<unknown> {
  return async (index: number) => [':1.' + index, '/child/' + index];
}

describe('AT-SPI reader', () => {
  it('collects interactive elements with mapped types, centers, and labels', async () => {
    const root = fakeNode({ childCount: async () => 5, childAt: pairs() });
    const save = fakeNode({ roleName: async () => 'push button', name: async () => 'Save', extents: async () => [100, 200, 140, 36] });
    const amount = fakeNode({ roleName: async () => 'entry', name: async () => 'Amount', extents: async () => ({ x: 100, y: 100, width: 300, height: 38 }) });
    const label = fakeNode({ roleName: async () => 'label', name: async () => 'Static', extents: async () => [0, 0, 50, 20] });
    const tiny = fakeNode({ roleName: async () => 'push button', name: async () => 'Dot', extents: async () => [5, 5, 2, 2] });
    const junk = fakeNode({ roleName: async () => 'push button', name: async () => 'Junk', extents: async () => 'not-a-box' });
    const detect = createAtspiDetector(fakeScope(root, [save, amount, label, tiny, junk]));
    const elements = await detect(new AbortController().signal);
    expect(elements).toHaveLength(2);
    expect(elements[0]).toMatchObject({ id: 1, type: 'button', label: 'Save', center: { x: 170, y: 218 }, confidence: 0.9 });
    expect(elements[1]).toMatchObject({ id: 2, type: 'input', label: 'Amount', center: { x: 250, y: 119 } });
  });

  it('skips dead children but keeps walking their siblings', async () => {
    const root = fakeNode({ childCount: async () => 3, childAt: pairs() });
    const first = fakeNode({ roleName: async () => 'push button', name: async () => 'First', extents: async () => [0, 0, 40, 20] });
    const dead = fakeNode({ roleName: async () => { throw new Error('dead node'); } });
    const third = fakeNode({ roleName: async () => 'link', name: async () => 'Third', extents: async () => [0, 30, 40, 20] });
    const detect = createAtspiDetector(fakeScope(root, [first, dead, third]));
    const elements = await detect(new AbortController().signal);
    expect(elements.map(element => element.label)).toEqual(['First', 'Third']);
  });

  it('resolves no elements when the accessibility bus is missing', async () => {
    const detect = createAtspiDetector({ connect: async () => { throw new Error('org.a11y.Bus not found'); } });
    await expect(detect(new AbortController().signal)).resolves.toEqual([]);
  });

  it('returns nothing once the run is aborted', async () => {
    const root = fakeNode({ childCount: async () => 1, childAt: pairs() });
    const detect = createAtspiDetector(fakeScope(root, [fakeNode()]));
    const controller = new AbortController();
    controller.abort();
    await expect(detect(controller.signal)).resolves.toEqual([]);
  });

  it('caps deep trees instead of walking forever', async () => {
    const chain: AtspiNode[] = [];
    for (let depth = 0; depth < 40; depth++) chain.push(fakeNode({ childCount: async () => 1, childAt: pairs() }));
    const root = fakeNode({ childCount: async () => 1, childAt: pairs() });
    const detect = createAtspiDetector(fakeScope(root, chain));
    const elements = await detect(new AbortController().signal);
    expect(elements).toEqual([]);
  });
});


describe('AT-SPI bus lifecycle', () => {
  function fakeBus() {
    return Object.assign(new EventEmitter(), { disconnect: vi.fn(), getProxyObject: vi.fn() });
  }

  it('contains initial connection error events instead of crashing the process', async () => {
    const bus = fakeBus();
    bus.getProxyObject.mockReturnValue(new Promise(() => undefined));
    vi.mocked(sessionBus).mockImplementationOnce(() => {
      queueMicrotask(() => bus.emit('error', new Error('denied bus')));
      return bus as unknown as ReturnType<typeof sessionBus>;
    });
    await expect(createAtspiDetector()(new AbortController().signal)).resolves.toEqual([]);
    expect(bus.disconnect).toHaveBeenCalledTimes(1);
    expect(() => bus.emit('error', new Error('late disconnect error'))).not.toThrow();
  });

  it('closes a second bus when root proxy creation fails', async () => {
    const initial = fakeBus();
    initial.getProxyObject.mockResolvedValue({ getInterface: () => ({ GetAddress: async () => 'mock-address' }) });
    const second = fakeBus();
    second.getProxyObject.mockRejectedValue(new Error('no registry'));
    vi.mocked(sessionBus).mockReturnValueOnce(initial as unknown as ReturnType<typeof sessionBus>).mockReturnValueOnce(second as unknown as ReturnType<typeof sessionBus>);
    await expect(createAtspiDetector()(new AbortController().signal)).resolves.toEqual([]);
    expect(initial.disconnect).toHaveBeenCalledOnce();
    expect(second.disconnect).toHaveBeenCalledOnce();
  });

  it('aborts a hung connection on detector timeout and disconnects its bus', async () => {
    const bus = fakeBus();
    bus.getProxyObject.mockReturnValue(new Promise(() => undefined));
    vi.mocked(sessionBus).mockReturnValueOnce(bus as unknown as ReturnType<typeof sessionBus>);
    const engine = new UIGroundingEngine(createAtspiDetector(), 5);
    await expect(engine.detectRaw()).resolves.toEqual([]);
    expect(bus.disconnect).toHaveBeenCalledOnce();
  });

  it('closes the scope and returns promptly if a tree method hangs on Stop', async () => {
    const close = vi.fn();
    const controller = new AbortController();
    const detector = createAtspiDetector({ connect: async () => ({ root: fakeNode({ roleName: () => new Promise(() => undefined) }), node: async () => fakeNode(), close }) });
    const pending = detector(controller.signal);
    await Promise.resolve();
    await Promise.resolve();
    controller.abort();
    await expect(pending).resolves.toEqual([]);
    expect(close).toHaveBeenCalled();
  });
});
