import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CAMERA_ELEVATION, HEX_FACINGS } from '../js/studio-core.mjs';
import { SPRITE_LAYOUT_PRESETS, spriteLayoutOffsets, spriteLayoutDimensions } from '../js/sprite-layouts.mjs';
import {
  STUDIO_FEET_PER_HEX, STUDIO_HEIGHT_RULER_FEET, studioWorldUnitsPerFoot,
  studioModelHeightFeet, studioFootprintGuide, studioLightPosition
} from '../js/studio-geometry.mjs';

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `${message}: expected ${expected}, received ${actual}`);
const combatVertices = [[0, -21], [32, -10.5], [32, 10.5], [0, 21], [-32, 10.5], [-32, -10.5]];

// Calibrate against the actual game, not imported FBX/glTF unit conventions.
const game = fs.readFileSync(new URL('../js/adventure-party.js', import.meta.url), 'utf8');
assert.equal(STUDIO_FEET_PER_HEX, Number(game.match(/const TACTICAL_FEET_PER_HEX=(\d+);/)[1]));
assert.equal(Number(game.match(/const HEX_W=(\d+);/)[1]), 64);
assert.equal(STUDIO_HEIGHT_RULER_FEET, 75);

for (const layout of SPRITE_LAYOUT_PRESETS) {
  for (let facing = 0; facing < 6; facing++) {
    for (const frameHeight of [1, 3.15, 12]) {
      const guide = studioFootprintGuide(layout.id, facing, frameHeight);
      const unitsPerFoot = studioWorldUnitsPerFoot(layout.id, frameHeight);
      const cellWidth = Math.max(...guide[0].vertices.map(vertex => vertex.x)) -
        Math.min(...guide[0].vertices.map(vertex => vertex.x));
      close(cellWidth / unitsPerFoot, 10, 'One battlefield hex is ten feet');
      close(unitsPerFoot * STUDIO_HEIGHT_RULER_FEET, cellWidth * 7.5, 'Seventy-five-foot ruler equals seven and a half hex widths');
      // A seven-foot reference mesh at each import/framing scale. The current
      // world bounds already carry model size, so it must not be applied again.
      for (const modelScale of [25, 100, 105, 200, 1000, 2000]) {
        close(studioModelHeightFeet(cellWidth * 0.7 * modelScale / 100, layout.id, frameHeight),
          7 * modelScale / 100, 'Measured height follows model size exactly once');
      }
      const cells = spriteLayoutOffsets(layout.id, facing);
      const pixelCenters = cells.map(({ x, y }) => ({ x: 64 * (x + y / 2), y: 31.5 * y }));
      const centroid = {
        x: pixelCenters.reduce((sum, center) => sum + center.x, 0) / cells.length,
        y: pixelCenters.reduce((sum, center) => sum + center.y, 0) / cells.length
      };
      const pixelsPerUnit = layout.renderHeight / frameHeight;
      const screen = point => ({ x: point.x * pixelsPerUnit, y: point.z * Math.sin(CAMERA_ELEVATION) * pixelsPerUnit });
      assert.equal(guide.length, layout.offsets.length);
      close(guide.reduce((sum, cell) => sum + cell.x, 0) / guide.length, 0, 'World x centroid');
      close(guide.reduce((sum, cell) => sum + cell.z, 0) / guide.length, 0, 'World z centroid');
      for (let index = 0; index < guide.length; index++) {
        const expected = { x: pixelCenters[index].x - centroid.x, y: pixelCenters[index].y - centroid.y };
        const projected = screen(guide[index]);
        close(projected.x, expected.x, `${layout.id}/${facing} occupied center x`);
        close(projected.y, expected.y, `${layout.id}/${facing} occupied center y`);
        assert.equal(guide[index].vertices.length, 6);
        const vertices = guide[index].vertices.map(screen);
        for (let vertex = 0; vertex < 6; vertex++) {
          close(vertices[vertex].x, expected.x + combatVertices[vertex][0], 'Combat vertex x');
          close(vertices[vertex].y, expected.y + combatVertices[vertex][1], 'Combat vertex y');
        }
        close(Math.max(...vertices.map(point => point.x)) - Math.min(...vertices.map(point => point.x)), 64, 'Projected hex width');
        close(Math.max(...vertices.map(point => point.y)) - Math.min(...vertices.map(point => point.y)), 42, 'Projected hex height');
      }
      // A model-size change only affects its render dimensions. The same
      // base-frame guide remains identical for every supported model size.
      for (const modelScale of [25, 105, 200, 2000]) {
        const scaled = spriteLayoutDimensions(layout.id, 100, modelScale);
        close(scaled.renderHeight / layout.renderHeight, modelScale / 100, 'Model scale is separate from guide size');
        assert.deepEqual(studioFootprintGuide(layout.id, facing, frameHeight), guide);
      }
    }
  }
}

// Independent expected compass components for a +Z-forward model.
const horizontalDirections = {
  E: [1, 0], NE: [0.5, -Math.sqrt(3) / 2], NW: [-0.5, -Math.sqrt(3) / 2],
  W: [-1, 0], SW: [-0.5, Math.sqrt(3) / 2], SE: [0.5, Math.sqrt(3) / 2]
};
for (const facing of HEX_FACINGS) {
  for (const elevation of [0, 20, 45, 90]) {
    for (const distance of [1, 10, 37]) {
      const position = studioLightPosition(facing.id, elevation, distance);
      const radians = elevation * Math.PI / 180;
      close(position.x, horizontalDirections[facing.id][0] * Math.cos(radians) * distance, 'Light compass x');
      close(position.z, horizontalDirections[facing.id][1] * Math.cos(radians) * distance, 'Light compass z');
      close(position.y, Math.sin(radians) * distance, 'Light elevation');
      close(Math.hypot(position.x, position.y, position.z), distance, 'Light distance');
      const projectionScale = Math.cos(radians) * distance / 64;
      close(position.x, facing.screenVector[0] * projectionScale, 'Light follows sprite compass x');
      close(position.z * Math.sin(CAMERA_ELEVATION), facing.screenVector[1] * projectionScale, 'Light follows sprite compass y');
    }
  }
  assert.deepEqual(studioLightPosition(facing.id, 45), studioLightPosition(facing.id, 45, 10));
}

assert.throws(() => studioFootprintGuide('single', 0, 0), /frame height/);
assert.throws(() => studioFootprintGuide('single', 0, NaN), /frame height/);
assert.equal(studioModelHeightFeet(0, 'single', 3.15), 0);
assert.throws(() => studioWorldUnitsPerFoot('single', 0), /frame height/);
assert.throws(() => studioWorldUnitsPerFoot('single', Infinity), /frame height/);
assert.throws(() => studioModelHeightFeet(-1, 'single', 3.15), /model height/);
assert.throws(() => studioModelHeightFeet(NaN, 'single', 3.15), /model height/);
assert.throws(() => studioLightPosition('unknown', 45), /direction/);
assert.throws(() => studioLightPosition('E', NaN), /elevation/);
assert.throws(() => studioLightPosition('E', 45, 0), /distance/);

// Exercise the actual off-scene bounds helper: updateWorldMatrix alone skips
// SkinnedMesh's bind-inverse refresh and incorrectly squares a parent's scale.
// A data URL lets CI's Node 20 read the bundled ESM without a package.json type.
const threeSource = fs.readFileSync(new URL('../assets/vendor/three/three.core.min.js', import.meta.url));
const threeModuleUrl = `data:text/javascript;base64,${threeSource.toString('base64')}`;
const THREE = await import(threeModuleUrl);
const studioSource = fs.readFileSync(new URL('../js/3d-studio.mjs', import.meta.url), 'utf8');

// Exercise the production camera adjustment against the bundled camera and
// OrbitControls: model points must retain their screen positions and depth,
// including an already-panned/zoomed view and pending movement inertia.
const controlsSource = fs.readFileSync(new URL('../assets/vendor/three/addons/controls/OrbitControls.js', import.meta.url), 'utf8')
  .replace("from 'three'", `from '${threeModuleUrl}'`);
const { OrbitControls } = await import(`data:text/javascript;base64,${Buffer.from(controlsSource).toString('base64')}`);
const rescaleSource = studioSource.match(/function rescaleModelView\([^\n]*\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(rescaleSource, 'Extract the production model-view adjustment');
const camera = new THREE.OrthographicCamera(-4, 4, 3, -3, 0.01, 100);
const controls = new OrbitControls(camera, null);
camera.position.set(8, 13, 10);
camera.zoom = 1.8;
controls.target.set(1.4, 2.1, -0.6);
controls.enableDamping = true;
controls.update(); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
const rescaleView = new Function('mainCamera', 'orbit', `${rescaleSource}\nreturn rescaleModelView;`)(camera, controls);
const referencePoints = [[-1, 0, -0.5], [1, 0, 0.5], [-1, 3, 0.5], [1, 3, -0.5]]
  .map(point => new THREE.Vector3(...point));
const projected = referencePoints.map(point => point.clone().project(camera));
const orientation = camera.quaternion.clone();
let previousScale = 100;
for (const scale of [2000, 25, 2000, 355, 100]) {
  // These are the actual controls' pending deltas; resizing should cancel them
  // at the currently visible view, not finish the motion with a camera jump.
  controls._panOffset.set(0.6, -0.25, 0.3);
  controls._sphericalDelta.theta = 0.12;
  controls._sphericalDelta.phi = 0.08;
  rescaleView(scale / previousScale);
  for (let tick = 0; tick < 3; tick++) controls.update();
  camera.updateMatrixWorld();
  for (const [index, point] of referencePoints.entries()) {
    const actual = point.clone().multiplyScalar(scale / 100).project(camera);
    for (const axis of ['x', 'y', 'z']) close(actual[axis], projected[index][axis], 'Scaled model keeps its screen projection and clipping depth');
  }
  close(Math.abs(camera.quaternion.dot(orientation)), 1, 'Model sizing preserves the view angle');
  close(camera.zoom, 1.8, 'Manual zoom remains independent of automatic scale compensation');
  assert.equal(controls.enableDamping, true);
  previousScale = scale;
}

const boundsSource = studioSource.match(/function geometryBounds\([^\n]*\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(boundsSource, 'Extract the production model-bounds helper');
const geometryBounds = new Function('THREE', `${boundsSource}\nreturn geometryBounds;`)(THREE);
// The production live-height path includes both attached equipment and
// animated mesh geometry; only saved physical T-Pose calibration excludes gear.
const bodyBoundsSource = studioSource.match(/function geometryBodyBounds\([^\n]*\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(bodyBoundsSource, 'Extract body-only calibration bounds');
const geometryBodyBounds = new Function('geometryBounds',
  `${bodyBoundsSource}\nreturn geometryBodyBounds;`)(geometryBounds);
const liveBody = new THREE.Group();
const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
bodyMesh.position.y=1;liveBody.add(bodyMesh);
const heldWeapon = new THREE.Group();
heldWeapon.userData.studioEquipment=true;
liveBody.add(heldWeapon);
const blade = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2, 0.15), new THREE.MeshBasicMaterial());
blade.position.y=3;heldWeapon.add(blade);
const shieldMount = new THREE.Group();
shieldMount.userData.studioShield=true;
liveBody.add(shieldMount);
const shieldMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.4), new THREE.MeshBasicMaterial());
shieldMesh.position.set(-1, 2.3, 0);shieldMount.add(shieldMesh);
const spanY = bounds => bounds.max.y - bounds.min.y;
close(spanY(geometryBodyBounds(liveBody)), 2, 'T-Pose body calibration excludes sword and shield');
close(spanY(geometryBounds(liveBody, { refreshSkinnedBounds:false })), 4, 'Live silhouette includes raised sword');
heldWeapon.rotation.z=Math.PI/2;
assert.ok(Math.abs(spanY(geometryBounds(liveBody, { refreshSkinnedBounds:false })) - 2.575) < 1e-5,
  'Live height responds to the rotated blade, including its slight below-ground extension');
close(spanY(geometryBodyBounds(liveBody)), 2, 'Body calibration stays unchanged through gear movement');
assert.ok(studioSource.includes('modelBounds = geometryBounds(state.model, { refreshSkinnedBounds: false })') &&
  studioSource.includes('const bodyBounds = geometryBodyBounds(state.model'),
  'Height display and T-Pose calibration use separate measured bounds');
for (const mesh of [bodyMesh,blade,shieldMesh]) {mesh.geometry.dispose();mesh.material.dispose();}
const mainViewSource = studioSource.match(/function mainViewFrame\([^\n]*\) \{[\s\S]*?\n\}/)?.[0];
assert.ok(mainViewSource, 'Extract the production half-window framing');
const viewModel = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 1), new THREE.MeshBasicMaterial());
const turntable = new THREE.Group();
turntable.add(viewModel);
const viewState = { model: viewModel, facing: 'SE' };
const fitView = new Function('THREE', 'state', 'turntable', 'HEX_FACINGS', 'CAMERA_ELEVATION', 'geometryBounds',
  `${mainViewSource}\nreturn mainViewFrame;`)(THREE, viewState, turntable, HEX_FACINGS, CAMERA_ELEVATION, geometryBounds);
for (const aspect of [0.7, 1.4, 2.4]) for (const scale of [0.25, 1, 20]) {
  viewModel.scale.setScalar(scale * 1.09);
  viewModel.position.set(0, 2 * scale * 1.09, 0);
  const frame = fitView(aspect), half = frame.height / 2;
  const view = new THREE.OrthographicCamera(-half * aspect, half * aspect, half, -half, 0.01, frame.height * 10);
  view.position.copy(frame.center).add(new THREE.Vector3(0, Math.sin(CAMERA_ELEVATION), Math.cos(CAMERA_ELEVATION)).multiplyScalar(frame.height * 2));
  view.lookAt(frame.center); view.updateMatrixWorld();
  const bounds = geometryBounds(viewModel), points = [];
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    points.push(new THREE.Vector3(x, y, z).project(view));
  }
  const spans = ['x', 'y'].map(axis => (Math.max(...points.map(point => point[axis])) - Math.min(...points.map(point => point[axis]))) / 2);
  close(Math.max(...spans), 0.5, 'Model bounds fill half the available width or height');
  const center = frame.center.clone().project(view);
  close(center.x, 0, 'Model is horizontally centered'); close(center.y, 0, 'Model is vertically centered');
}
viewModel.geometry.dispose(); viewModel.material.dispose();
for (const refreshSkinnedBounds of [true, false]) {
  const readBounds = root => geometryBounds(root, { refreshSkinnedBounds });
  const ancestor = new THREE.Group(), model = new THREE.Group();
  ancestor.add(model);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array(8).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0], 4));
  geometry.morphAttributes.position = [new THREE.Float32BufferAttribute([0, 0, 0, 0, 2, 0], 3)];
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
  const bone = new THREE.Bone();
  mesh.add(bone); model.add(mesh);
  mesh.bind(new THREE.Skeleton([bone]));
  const span = bounds => bounds.max.y - bounds.min.y;
  close(span(readBounds(model)), 1, 'Rest skinned-mesh height');
  model.scale.setScalar(2);
  close(span(readBounds(model)), 2, 'Parent scale applies once to the skinned-mesh height, not twice');
  ancestor.position.set(3, 7, -2);
  ancestor.scale.setScalar(1.5);
  let bounds = readBounds(model);
  close(bounds.min.y, 7, 'Ancestor translation updates before measuring');
  close(span(bounds), 3, 'Ancestor size changes update before measuring');
  bone.position.y = 0.5;
  bounds = readBounds(model);
  close(bounds.min.y, 8.5, 'Current bone translation updates before measuring');
  close(span(bounds), 3, 'Root motion changes altitude without changing height');
  mesh.morphTargetInfluences[0] = 1;
  close(span(readBounds(model)), 6, 'Current morph deformation contributes to height');
  bone.rotation.z = Math.PI / 4;
  close(span(readBounds(model)), 6 / Math.sqrt(2), 'Current bone rotation changes the posed vertical span');
  geometry.dispose(); mesh.material.dispose(); mesh.skeleton.dispose();
}
console.log('Studio geometry: four active layouts × six facings project to exact combat centers and 64×42 cells; 10-foot hex calibration, 75-foot ruler, model-height scaling through 2000%, stable camera projection with real orbit inertia, and real skinned/morph bounds; centered guides and six light directions passed.');
