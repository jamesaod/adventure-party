import { CAMERA_ELEVATION, HEX_FACINGS } from './studio-core.mjs?v=R238C54';
import { spriteLayout, spriteLayoutOffsets } from './sprite-layouts.mjs?v=R238C54';

// Match TACTICAL_FEET_PER_HEX and HEX_W in the combat renderer. Native model
// units are normalized on import; the battlefield hex is the scale reference.
export const STUDIO_FEET_PER_HEX = 10;
export const STUDIO_HEIGHT_RULER_FEET = 75;

export function studioWorldUnitsPerFoot(layoutId, baseFrameHeight) {
  if (!Number.isFinite(baseFrameHeight) || baseFrameHeight <= 0) {
    throw new RangeError('The studio base frame height must be positive and finite.');
  }
  return 64 * baseFrameHeight / (spriteLayout(layoutId).renderHeight * STUDIO_FEET_PER_HEX);
}

/** World height already includes the model-size transform; apply it only once. */
export function studioModelHeightFeet(worldHeight, layoutId, baseFrameHeight) {
  if (!Number.isFinite(worldHeight) || worldHeight < 0) {
    throw new RangeError('The model height must be nonnegative and finite.');
  }
  return worldHeight / studioWorldUnitsPerFoot(layoutId, baseFrameHeight);
}

// Combat's pointy hex, in screen pixels relative to its center.
const HEX_VERTICES = Object.freeze([
  [0, -21], [32, -10.5], [32, 10.5], [0, 21], [-32, 10.5], [-32, -10.5]
].map(vertex => Object.freeze(vertex)));

/**
 * Ground-plane cells for the selected tactical footprint. Facing rotation is
 * already applied; place these in world space without a second turntable yaw.
 * Use the unscaled framing height so changing model size leaves the guide fixed.
 */
export function studioFootprintGuide(layoutId, facingHex, baseFrameHeight) {
  if (!Number.isFinite(baseFrameHeight) || baseFrameHeight <= 0) {
    throw new RangeError('The studio base frame height must be positive and finite.');
  }
  const layout = spriteLayout(layoutId);
  const centers = spriteLayoutOffsets(layoutId, facingHex).map(({ x, y }) => ({
    x: 64 * (x + y / 2), y: 31.5 * y
  }));
  const centroid = centers.reduce((sum, center) => ({
    x: sum.x + center.x / centers.length,
    y: sum.y + center.y / centers.length
  }), { x: 0, y: 0 });
  const unitsPerPixel = baseFrameHeight / layout.renderHeight;
  const groundDepthPerPixel = unitsPerPixel / Math.sin(CAMERA_ELEVATION);
  const projectToGround = (x, y) => ({
    x: (x - centroid.x) * unitsPerPixel,
    z: (y - centroid.y) * groundDepthPerPixel
  });
  return centers.map(center => ({
    ...projectToGround(center.x, center.y),
    vertices: HEX_VERTICES.map(([x, y]) => projectToGround(center.x + x, center.y + y))
  }));
}

/** Position a directional light using the same compass yaw as the sprite views. */
export function studioLightPosition(directionId, elevationDegrees, distance = 10) {
  const direction = HEX_FACINGS.find(facing => facing.id === directionId);
  if (!direction) throw new RangeError(`Unknown studio light direction: ${String(directionId)}.`);
  if (!Number.isFinite(elevationDegrees)) throw new RangeError('Light elevation must be finite.');
  if (!Number.isFinite(distance) || distance <= 0) throw new RangeError('Light distance must be positive and finite.');
  const elevation = elevationDegrees * Math.PI / 180;
  const horizontalDistance = Math.cos(elevation) * distance;
  return {
    x: Math.sin(direction.yawRadians) * horizontalDistance,
    y: Math.sin(elevation) * distance,
    z: Math.cos(direction.yawRadians) * horizontalDistance
  };
}
