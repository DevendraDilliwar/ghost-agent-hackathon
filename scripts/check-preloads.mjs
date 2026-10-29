import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

for (const [entry, globalName] of [['index', 'ghostAgent'], ['controls', 'ghostControls']]) {
  const code = await readFile(new URL('../out/preload/' + entry + '.cjs', import.meta.url), 'utf8');
  const worlds = new Map();
  const electron = {
    contextBridge: { exposeInMainWorld: (name, bridge) => worlds.set(name, bridge) },
    ipcRenderer: { invoke: async () => undefined, on: () => undefined, removeListener: () => undefined },
  };
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports, require: name => {
    assert.equal(name, 'electron', 'Sandboxed preload must not require a generated chunk or a Node module');
    return electron;
  } });
  new vm.Script(code, { filename: entry + '.cjs' }).runInContext(context, { timeout: 1000 });
  assert.equal(worlds.size, 1);
  const bridge = worlds.get(globalName);
  assert.ok(bridge, 'Expected isolated bridge is missing');
  assert.ok(Object.isFrozen(bridge));
  assert.equal(bridge.ipcRenderer, undefined);
  if (entry === 'controls') {
    assert.deepEqual(Object.keys(bridge).sort(), ['getSnapshot', 'onChanged', 'openTask', 'pause', 'resume', 'stop']);
  }
}
console.log('Both sandboxed preloads are self-contained and expose frozen, named bridges.');
