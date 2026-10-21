import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Run the production pinned loader and its real dependencies in Node without
// changing the browser package's module format or installing dependencies.
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'adventure-party-fbx-'));
try {
  await fs.writeFile(path.join(temporary, 'package.json'), '{"type":"module"}');
  const vendor = new URL('../assets/vendor/three/', import.meta.url);
  for (const name of ['addons/loaders/FBXLoader.js', 'addons/libs/fflate.module.js',
    'addons/curves/NURBSCurve.js', 'addons/curves/NURBSUtils.js']) {
    const destination = path.join(temporary, name);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(new URL(name, vendor), destination);
  }
  const three = path.join(temporary, 'node_modules/three');
  await fs.mkdir(three, { recursive: true });
  await fs.writeFile(path.join(three, 'package.json'), '{"type":"module","exports":"./three.core.min.js"}');
  await fs.copyFile(new URL('three.core.min.js', vendor), path.join(three, 'three.core.min.js'));
  const { FBXLoader } = await import(pathToFileURL(path.join(temporary, 'addons/loaders/FBXLoader.js')));
  const fixture = await fs.readFile(new URL('./fixtures/multiple-animation-takes.fbx', import.meta.url), 'utf8');
  const parse = source => {
    const buffer = new TextEncoder().encode(source);
    const warnings = [];
    const previous = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));
    try { return { root: new FBXLoader().parse(buffer.buffer, ''), warnings }; }
    finally { console.warn = previous; }
  };

  const { root, warnings } = parse(fixture);
  assert.equal(root.name, 'Root', 'The single group root is unwrapped');
  assert.equal(root.ID, 1);
  assert.ok(root.getObjectByName('Triangle')?.isMesh, 'The authored fixture contains a real mesh');
  assert.deepEqual(root.userData.fbxAnimations, {
    stackCount: 8, clipCount: 6, emptyStackCount: 2, layeredStackCount: 2
  }, 'Discovery metadata survives the root unwrap');
  assert.deepEqual(root.animations.map(clip => clip.name), ['Walk', 'Attack', 'Attack', 'Empty first', 'Layered', 'Fallback']);
  assert.deepEqual(root.animations.map(clip => clip.userData.fbxAnimation), [
    { stackId: '100', start: 2, end: 4, layerCount: 1 },
    { stackId: '200', start: 0, end: 1, layerCount: 1 },
    { stackId: '300', start: 0, end: 2, layerCount: 1 },
    { stackId: '400', start: 0, end: 1, layerCount: 2 },
    { stackId: '500', start: 0, end: 1, layerCount: 2 },
    { stackId: '600', start: 1, end: 3, layerCount: 1 }
  ]);
  assert.deepEqual(root.animations.map(clip => clip.duration), [6, 1, 2, 1, 1, 4],
    'The loader preserves original track timelines for studio normalization');
  assert.deepEqual([...root.animations[0].tracks[0].times], [0, 2, 4, 6]);
  assert.deepEqual([...root.animations[0].tracks[0].values], [0, 0, 0, 2, 0, 0, 4, 0, 0, 6, 0, 0]);
  assert.deepEqual([...root.animations[3].tracks[0].values], [5, 0, 0, 6, 0, 0],
    'An empty first layer and unrelated stack child cannot hide the usable layer');
  assert.deepEqual([...root.animations[4].tracks[0].values], [0, 0, 0, 1, 0, 0],
    'A second blended layer does not become a separate take or overwrite the first');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Layered.*multiple nonempty layers/);

  // FBX permits a curve to drive multiple curve nodes in separate animation stacks.
  // Derive a two-stack fixture from the authored file, keeping the real parser path.
  const objectSection = fixture.slice(fixture.indexOf('Objects:'), fixture.indexOf('\nConnections:'));
  const objects = new Map([...objectSection.matchAll(/^\t(?:Model|Geometry|AnimationStack|AnimationLayer|AnimationCurveNode|AnimationCurve): (\d+),[^\n]*\{\n[\s\S]*?^\t\}/gm)]
    .map(match => [Number(match[1]), match[0]]));
  const twoStacks = (shared, reverse = false, unrelated = false) => {
    const ids = [1, 2, 3, 100, 200, 101, 201, 110, 210, 111, 211];
    const links = shared
      ? ['\tC: "OP",111,110,"d|X"', '\tC: "OP",111,210,"d|X"']
      : ['\tC: "OP",111,110,"d|X"', '\tC: "OP",211,210,"d|X"'];
    if (reverse) links.reverse();
    if (unrelated) links.unshift('\tC: "OO",111,110', '\tC: "OP",111,1,"d|X"', '\tC: "OP",111,999,"d|X"');
    return fixture.slice(0, fixture.indexOf('Objects:')) + 'Objects:  {\n' + ids.map(id => objects.get(id)).join('\n') +
      '\n}\nConnections:  {\n' + [
        '\tC: "OO",1,0', '\tC: "OO",2,1', '\tC: "OO",3,2',
        '\tC: "OO",101,100', '\tC: "OO",201,200',
        '\tC: "OO",110,101', '\tC: "OP",110,1,"Lcl Translation"',
        '\tC: "OO",210,201', '\tC: "OP",210,1,"Lcl Translation"', ...links
      ].join('\n') + '\n}\n';
  };
  const control = parse(twoStacks(false)).root;
  assert.deepEqual(control.userData.fbxAnimations, { stackCount: 2, clipCount: 2, emptyStackCount: 0, layeredStackCount: 0 });
  assert.deepEqual(control.animations.map(clip => [...clip.tracks[0].times]), [[0, 2, 4, 6], [0, 1]]);
  assert.deepEqual([...control.animations[1].tracks[0].values], [0, 0, 0, 10, 0, 0]);
  for (const [reverse, unrelated] of [[false, false], [true, false], [false, true]]) {
    const shared = parse(twoStacks(true, reverse, unrelated)).root;
    assert.deepEqual(shared.userData.fbxAnimations, control.userData.fbxAnimations,
      'Every connected stack remains usable regardless of shared-curve connection order');
    assert.deepEqual(shared.animations.map(clip => clip.name), ['Walk', 'Attack']);
    assert.deepEqual(shared.animations.map(clip => clip.userData.fbxAnimation),
      control.animations.map(clip => clip.userData.fbxAnimation), 'Distinct stack IDs and authored ranges survive shared curves');
    for (const clip of shared.animations) {
      assert.equal(clip.tracks.length, 1);
      assert.deepEqual([...clip.tracks[0].times], [0, 2, 4, 6]);
      assert.deepEqual([...clip.tracks[0].values], [0, 0, 0, 2, 0, 0, 4, 0, 0, 6, 0, 0]);
    }
  }

  const withoutStackRange = fixture.replace(
    /("AnimStack::Walk", "" \{\n)\t\tProperties70:  \{[\s\S]*?\n\t\t\}/,
    '$1');
  const takeFallback = parse(withoutStackRange).root.animations[0];
  assert.deepEqual(takeFallback.userData.fbxAnimation, { stackId: '100', start: 0, end: 6, layerCount: 1 },
    'Named Takes.LocalTime supplies a range when the stack has none');
  const invalidTake = withoutStackRange.replace('LocalTime: 0,277116948000', 'LocalTime: NaN,Infinity');
  assert.deepEqual(parse(invalidTake).root.animations[0].userData.fbxAnimation,
    { stackId: '100', start: null, end: null, layerCount: 1 }, 'Invalid spans remain unknown');
  const duplicateTake = withoutStackRange.replace('Take: "Unused"', 'Take: "Walk"');
  assert.equal(parse(duplicateTake).root.animations[0].userData.fbxAnimation.start, null,
    'Ambiguous take names never assign another take\'s time range');

  // A file may describe stacks yet contain no animation curve objects at all.
  const noAnimation = fixture.slice(0, fixture.indexOf('Objects:')) + `Objects:  {
\tModel: 1, "Model::Root", "Null" {
\t}
\tAnimationStack: 100, "AnimStack::Empty", "" {
\t}
\tAnimationStack: 200, "AnimStack::Disconnected", "" {
\t}
\tAnimationLayer: 101, "AnimLayer::Empty", "" {
\t}
}
Connections:  {
\tC: "OO",1,0
\tC: "OO",101,100
}
`;
  const empty = parse(noAnimation).root;
  assert.deepEqual(empty.animations, []);
  assert.deepEqual(empty.userData.fbxAnimations,
    { stackCount: 2, clipCount: 0, emptyStackCount: 2, layeredStackCount: 0 });

  // Optional existing binary assets can exercise the same real parser locally.
  // Textures are irrelevant to this animation check; keep image decoding out of Node.
  if (process.argv.length > 2) {
    const THREE = await import(pathToFileURL(path.join(three, 'three.core.min.js')));
    const loadTexture = THREE.TextureLoader.prototype.load;
    THREE.TextureLoader.prototype.load = function () { return new THREE.Texture(); };
    try {
      for (const filename of process.argv.slice(2)) {
        const bytes = await fs.readFile(filename);
        const model = new FBXLoader().parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
        assert.equal(model.userData.fbxAnimations.clipCount, model.animations.length);
        assert.ok(model.animations.every(clip => clip.tracks.length && typeof clip.userData.fbxAnimation.stackId === 'string'));
        console.log(`${path.basename(filename)}: ${JSON.stringify(model.userData.fbxAnimations)}`);
      }
    } finally { THREE.TextureLoader.prototype.load = loadTexture; }
  }
  console.log('FBX animations: distinct and duplicate-named stacks, shared curves and connection order, authored ranges, named-take fallback, empty layers/stacks, layered warnings, and returned-root metadata passed.');
} finally {
  await fs.rm(temporary, { recursive: true, force: true });
}
