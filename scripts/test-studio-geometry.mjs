import assert from 'node:assert/strict';
import { CAMERA_ELEVATION, HEX_FACINGS } from '../js/studio-core.mjs';
import { SPRITE_LAYOUT_PRESETS, spriteLayoutOffsets, spriteLayoutDimensions } from '../js/sprite-layouts.mjs';
import { studioFootprintGuide, studioLightPosition } from '../js/studio-geometry.mjs';

const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9,
  `${message}: expected ${expected}, received ${actual}`);
const combatVertices = [[0, -21], [32, -10.5], [32, 10.5], [0, 21], [-32, 10.5], [-32, -10.5]];

for (const layout of SPRITE_LAYOUT_PRESETS) {
  for (let facing = 0; facing < 6; facing++) {
    for (const frameHeight of [1, 3.15, 12]) {
      const guide = studioFootprintGuide(layout.id, facing, frameHeight);
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
      for (const modelScale of [25, 105, 200]) {
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
assert.throws(() => studioLightPosition('unknown', 45), /direction/);
assert.throws(() => studioLightPosition('E', NaN), /elevation/);
assert.throws(() => studioLightPosition('E', 45, 0), /distance/);
console.log('Studio geometry: four active layouts × six facings project to exact combat centers and 64×42 cells; centered guides remain size-independent; six light directions, elevations, and distances passed.');
