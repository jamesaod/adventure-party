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
const colorFactor = value => Number.isFinite(value) ? Math.max(0, Math.min(2, value)) : 1;
const saturationFactor = value => Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 1;
const MAX_OUTLINE = 10;
const OUTLINE_DISTANCE_LIMIT = (MAX_OUTLINE + 1) ** 2;
let outlineWorkspace;

// Squared Euclidean distance to the nearest solid pixel, independently in each
// atlas cell. Horizontal nearest-neighbor scans and a vertical parabola envelope
// take linear time regardless of outline width. Reuse scratch space per frame.
function outlineDistances(source, width, height, tileWidth, tileHeight) {
  if (!outlineWorkspace || outlineWorkspace.distances.length !== width * height ||
      outlineWorkspace.line.length < tileHeight) {
    outlineWorkspace = {
      distances: new Uint8Array(width * height),
      line: new Uint8Array(tileHeight),
      sites: new Int32Array(tileHeight),
      breaks: new Float64Array(tileHeight + 1)
    };
  }
  const { distances, line, sites, breaks } = outlineWorkspace;
  for (let top = 0; top < height; top += tileHeight) {
    for (let left = 0; left < width; left += tileWidth) {
      for (let y = top; y < top + tileHeight; y++) {
        const row = y * width + left;
        let distance = MAX_OUTLINE + 1;
        for (let x = 0; x < tileWidth; x++) {
          distance = source[(row + x) * 4 + 3] >= 128 ? 0 : Math.min(MAX_OUTLINE + 1, distance + 1);
          distances[row + x] = distance * distance;
        }
        distance = MAX_OUTLINE + 1;
        for (let x = tileWidth - 1; x >= 0; x--) {
          distance = source[(row + x) * 4 + 3] >= 128 ? 0 : Math.min(MAX_OUTLINE + 1, distance + 1);
          distances[row + x] = Math.min(distances[row + x], distance * distance);
        }
      }
      for (let x = left; x < left + tileWidth; x++) {
        for (let y = 0; y < tileHeight; y++) line[y] = distances[(top + y) * width + x];
        let last = 0;
        sites[0] = 0;
        breaks[0] = -Infinity;
        breaks[1] = Infinity;
        for (let y = 1; y < tileHeight; y++) {
          let intersection;
          do {
            const previous = sites[last];
            intersection = (line[y] + y * y - line[previous] - previous * previous) / (2 * (y - previous));
            if (intersection > breaks[last]) break;
            last--;
          } while (last >= 0);
          sites[++last] = y;
          breaks[last] = intersection;
          breaks[last + 1] = Infinity;
        }
        last = 0;
        for (let y = 0; y < tileHeight; y++) {
          while (breaks[last + 1] < y) last++;
          const distance = y - sites[last];
          distances[(top + y) * width + x] = Math.min(OUTLINE_DISTANCE_LIMIT, distance * distance + line[sites[last]]);
        }
      }
    }
  }
  return distances;
}

/**
 * Quantize sRGB RGBA framebuffer bytes to the game's fixed VGA palette.
 * WebGL's bottom-up rows are flipped once here; preview and PNG use the same
 * pixels. An outward 0–10 pixel black outline remains palette-safe. Atlas cells
 * can be isolated with tileWidth/tileHeight; outlines never cross their edges.
 * Subject colors pass through hue, saturation, brightness, then contrast before
 * palette matching. Background, transparency, and outline are unaffected.
 */
export function quantizeRgba(source, width, height, target, {
  flipY = true,
  brightness = 1,
  hue = 0,
  contrast = 1,
  saturation = 1,
  outline = 0,
  tileWidth = width,
  tileHeight = height,
  transparent = false,
  background = [128, 128, 128],
} = {}) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError("Preview dimensions must be positive integers.");
  }
  if (!Number.isInteger(tileWidth) || !Number.isInteger(tileHeight) || tileWidth < 1 || tileHeight < 1 ||
      width % tileWidth !== 0 || height % tileHeight !== 0) {
    throw new RangeError("Atlas cell dimensions must be positive integers that divide the preview dimensions.");
  }
  const length = width * height * 4;
  if (!source || source.length !== length) throw new RangeError("Unexpected framebuffer size.");
  if (!target) target = new Uint8ClampedArray(length);
  if (target.length !== length || target.buffer === source.buffer) {
    throw new RangeError("Preview output must be a separate buffer of the same size.");
  }
  const lookup = getColorLookup();
  const brightnessValue = colorFactor(brightness);
  const contrastValue = colorFactor(contrast);
  const saturationValue = saturationFactor(saturation);
  const hueShift = Number.isFinite(hue) ? ((hue % 360 + 360) % 360) / 60 : 0;
  // Boolean options remain compatible with the original on/off outline.
  const outlineWidth = outline === true ? 1 : Number.isFinite(outline) ? Math.max(0, Math.min(MAX_OUTLINE, Math.round(outline))) : 0;
  const distances = outlineWidth > 1 ? outlineDistances(source, width, height, tileWidth, tileHeight) : null;
  const backgroundIndex = (clampByte(background[0]) >> 3) << 10 |
    (clampByte(background[1]) >> 3) << 5 | (clampByte(background[2]) >> 3);
  const bg = VGA_PALETTE[lookup[backgroundIndex]];

  for (let y = 0; y < height; y++) {
    const sourceY = flipY ? height - y - 1 : y;
    const tileY = sourceY % tileHeight;
    for (let x = 0; x < width; x++) {
      const si = (sourceY * width + x) * 4;
      const ti = (y * width + x) * 4;
      if (source[si + 3] < 128) {
        const tileX = x % tileWidth;
        const edge = outlineWidth === 1 ? (
          (tileX > 0 && source[si - 1] >= 128) ||
          (tileX + 1 < tileWidth && source[si + 7] >= 128) ||
          (tileY > 0 && source[si - width * 4 + 3] >= 128) ||
          (tileY + 1 < tileHeight && source[si + width * 4 + 3] >= 128)
        ) : outlineWidth > 1 && distances[si / 4] <= outlineWidth * outlineWidth;
        target[ti] = edge || transparent ? 0 : bg[0];
        target[ti + 1] = edge || transparent ? 0 : bg[1];
        target[ti + 2] = edge || transparent ? 0 : bg[2];
        target[ti + 3] = edge || !transparent ? 255 : 0;
        continue;
      }
      let r = source[si], g = source[si + 1], b = source[si + 2];
      if (hueShift !== 0) {
        const maximum = Math.max(r, g, b), minimum = Math.min(r, g, b);
        const chroma = maximum - minimum;
        // Rotate the hue wheel while retaining the original chroma and range.
        // Gray has no hue and must remain unchanged.
        if (chroma > 0) {
          const originalHue = maximum === r ? (g - b) / chroma + (g < b ? 6 : 0)
            : maximum === g ? (b - r) / chroma + 2 : (r - g) / chroma + 4;
          const shiftedHue = (originalHue + hueShift) % 6;
          const secondary = chroma * (1 - Math.abs(shiftedHue % 2 - 1)) + minimum;
          if (shiftedHue < 1) { r = maximum; g = secondary; b = minimum; }
          else if (shiftedHue < 2) { r = secondary; g = maximum; b = minimum; }
          else if (shiftedHue < 3) { r = minimum; g = maximum; b = secondary; }
          else if (shiftedHue < 4) { r = minimum; g = secondary; b = maximum; }
          else if (shiftedHue < 5) { r = secondary; g = minimum; b = maximum; }
          else { r = maximum; g = minimum; b = secondary; }
        }
      }
      if (saturationValue !== 1) {
        const gray = r * 0.2126 + g * 0.7152 + b * 0.0722;
        r = clampByte(gray + (r - gray) * saturationValue);
        g = clampByte(gray + (g - gray) * saturationValue);
        b = clampByte(gray + (b - gray) * saturationValue);
      }
      if (hueShift !== 0 || brightnessValue !== 1 || contrastValue !== 1) {
        r = clampByte((r * brightnessValue - 127.5) * contrastValue + 127.5);
        g = clampByte((g * brightnessValue - 127.5) * contrastValue + 127.5);
        b = clampByte((b * brightnessValue - 127.5) * contrastValue + 127.5);
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
