/** Shared projection and palette rules for the 3D studio. No WebGL dependency. */

// The combat board projects a pointy hex to 64 by 42 pixels. With Three's +Z
// toward the viewer, these rotations make a +Z-forward model face each neighbor.
export const CAMERA_ELEVATION = Math.asin(42 * Math.sqrt(3) / 128);
export const HEX_FACINGS = Object.freeze([
  { id: "E",  label: "East",       yawRadians: Math.PI / 2,     screenVector: [64, 0] },
  { id: "NE", label: "Northeast",  yawRadians: Math.PI * 5 / 6, screenVector: [32, -31.5] },
  { id: "NW", label: "Northwest",  yawRadians: Math.PI * 7 / 6, screenVector: [-32, -31.5] },
  { id: "W",  label: "West",       yawRadians: Math.PI * 3 / 2, screenVector: [-64, 0] },
  { id: "SW", label: "Southwest",  yawRadians: Math.PI * 11 / 6, screenVector: [-32, 31.5] },
  { id: "SE", label: "Southeast",  yawRadians: Math.PI / 6,     screenVector: [32, 31.5] },
].map(facing => Object.freeze({ ...facing, screenVector: Object.freeze(facing.screenVector) })));

// Match the existing Pixel Editor palette exactly: 16 RGBI entries, the
// 6x6x6 color cube, and 24 gray entries. All previews share this one palette.
const baseColors = [
  0x000000, 0x0000aa, 0x00aa00, 0x00aaaa, 0xaa0000, 0xaa00aa, 0xaa5500, 0xaaaaaa,
  0x555555, 0x5555ff, 0x55ff55, 0x55ffff, 0xff5555, 0xff55ff, 0xffff55, 0xffffff,
];
const palette = baseColors.map(color => [color >> 16, (color >> 8) & 255, color & 255]);
for (const r of [0, 51, 102, 153, 204, 255]) {
  for (const g of [0, 51, 102, 153, 204, 255]) {
    for (const b of [0, 51, 102, 153, 204, 255]) palette.push([r, g, b]);
  }
}
for (let i = 0; i < 24; i++) palette.push([8 + i * 10, 8 + i * 10, 8 + i * 10]);
export const VGA_PALETTE = Object.freeze(palette.map(color => Object.freeze(color)));

let colorLookup;
function getColorLookup() {
  if (colorLookup) return colorLookup;
  colorLookup = new Uint8Array(32 * 32 * 32);
  for (let r5 = 0; r5 < 32; r5++) {
    const r = r5 * 8 + 4;
    for (let g5 = 0; g5 < 32; g5++) {
      const g = g5 * 8 + 4;
      for (let b5 = 0; b5 < 32; b5++) {
        const b = b5 * 8 + 4;
        let best = 0;
        let distance = Infinity;
        for (let p = 0; p < VGA_PALETTE.length; p++) {
          const rgb = VGA_PALETTE[p];
          const dr = r - rgb[0], dg = g - rgb[1], db = b - rgb[2];
          const d = dr * dr + dg * dg + db * db;
          if (d < distance) { distance = d; best = p; }
        }
        colorLookup[(r5 << 10) | (g5 << 5) | b5] = best;
      }
    }
  }
  return colorLookup;
}

const clampByte = value => Math.max(0, Math.min(255, Math.round(value)));

/**
 * Quantize sRGB RGBA framebuffer bytes to the game's fixed VGA palette.
 * WebGL's bottom-up rows are flipped once here; preview and PNG use the same
 * pixels. A hard silhouette and optional 1-pixel outline remain palette-safe.
 */
export function quantizeRgba(source, width, height, target, {
  flipY = true,
  saturation = 1,
  outline = false,
  transparent = false,
  background = [128, 128, 128],
} = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError("Preview dimensions must be positive integers.");
  }
  const length = width * height * 4;
  if (!source || source.length !== length) throw new RangeError("Unexpected framebuffer size.");
  if (!target) target = new Uint8ClampedArray(length);
  if (target.length !== length || target.buffer === source.buffer) {
    throw new RangeError("Preview output must be a separate buffer of the same size.");
  }
  const lookup = getColorLookup();
  const saturationValue = Number.isFinite(saturation) ? Math.max(0, Math.min(2, saturation)) : 1;
  const backgroundIndex = (clampByte(background[0]) >> 3) << 10 |
    (clampByte(background[1]) >> 3) << 5 | (clampByte(background[2]) >> 3);
  const bg = VGA_PALETTE[lookup[backgroundIndex]];

  for (let y = 0; y < height; y++) {
    const sourceY = flipY ? height - y - 1 : y;
    for (let x = 0; x < width; x++) {
      const si = (sourceY * width + x) * 4;
      const ti = (y * width + x) * 4;
      if (source[si + 3] < 128) {
        const edge = outline && (
          (x > 0 && source[si - 1] >= 128) ||
          (x + 1 < width && source[si + 7] >= 128) ||
          (sourceY > 0 && source[si - width * 4 + 3] >= 128) ||
          (sourceY + 1 < height && source[si + width * 4 + 3] >= 128)
        );
        target[ti] = edge || transparent ? 0 : bg[0];
        target[ti + 1] = edge || transparent ? 0 : bg[1];
        target[ti + 2] = edge || transparent ? 0 : bg[2];
        target[ti + 3] = edge || !transparent ? 255 : 0;
        continue;
      }
      let r = source[si], g = source[si + 1], b = source[si + 2];
      if (saturationValue !== 1) {
        const gray = r * 0.2126 + g * 0.7152 + b * 0.0722;
        r = clampByte(gray + (r - gray) * saturationValue);
        g = clampByte(gray + (g - gray) * saturationValue);
        b = clampByte(gray + (b - gray) * saturationValue);
      }
      const rgb = VGA_PALETTE[lookup[(r >> 3) << 10 | (g >> 3) << 5 | (b >> 3)]];
      target[ti] = rgb[0];
      target[ti + 1] = rgb[1];
      target[ti + 2] = rgb[2];
      target[ti + 3] = 255;
    }
  }
  return target;
}
