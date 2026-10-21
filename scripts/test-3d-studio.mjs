import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { CAMERA_ELEVATION, HEX_FACINGS, VGA_PALETTE, quantizeRgba } from "../js/studio-core.mjs";

// Catch mirrored facings and the common error of using screen-space 60-degree
// turns instead of projecting six equally spaced world headings onto the board.
const boardVectors = [[64, 0], [32, -31.5], [-32, -31.5], [-64, 0], [-32, 31.5], [32, 31.5]];
assert.deepEqual(HEX_FACINGS.map(facing => facing.id), ["E", "NE", "NW", "W", "SW", "SE"]);
for (let i = 0; i < HEX_FACINGS.length; i++) {
  const yaw = HEX_FACINGS[i].yawRadians;
  const projected = [Math.sin(yaw) * 64, Math.cos(yaw) * Math.sin(CAMERA_ELEVATION) * 64];
  assert.ok(projected.every((v, axis) => Math.abs(v - boardVectors[i][axis]) < 1e-10), HEX_FACINGS[i].id);
}

// The new studio must use the same palette as the existing Pixel Editor.
const game = fs.readFileSync(new URL("../js/adventure-party.js", import.meta.url), "utf8");
const start = game.indexOf("const VGA_BASE_COLORS=");
const end = game.indexOf("const VGA_256_PALETTE=buildVga256Palette();", start);
assert.ok(start >= 0 && end > start);
const editorPalette = vm.runInNewContext(game.slice(start, end) + "\nbuildVga256Palette()");
assert.equal(VGA_PALETTE.length, 256);
assert.equal(JSON.stringify(VGA_PALETTE.map(rgb => "#" + rgb.map(v => v.toString(16).padStart(2, "0")).join("").toUpperCase())), JSON.stringify(editorPalette));

// Framebuffer rows and alpha must survive readback consistently: this catches
// upside-down previews, accidental gray backgrounds in transparent exports,
// and outlines written over the subject rather than around its silhouette.
const sample = new Uint8Array(3 * 3 * 4);
sample.set([255, 0, 0, 255], 4 * 1); // top center in source memory
const rgba = quantizeRgba(sample, 3, 3, undefined, { transparent: true });
assert.deepEqual(Array.from(rgba.slice(4 * 7, 4 * 8)), [255, 0, 0, 255]);
assert.equal(rgba[4 * 1 + 3], 0);
const outlined = quantizeRgba(sample, 3, 3, undefined, { transparent: true, outline: true });
assert.deepEqual(Array.from(outlined.slice(4 * 4, 4 * 5)), [0, 0, 0, 255]);
assert.deepEqual(Array.from(outlined.slice(4 * 7, 4 * 8)), [255, 0, 0, 255]);
assert.equal(outlined[3], 0);
const opaque = quantizeRgba(sample, 3, 3);
assert.deepEqual(Array.from(opaque.slice(0, 4)), [128, 128, 128, 255]);

// Color controls operate on the subject before palette conversion. Hue follows
// the color wheel, leaves grays alone, and wraps in either direction.
const pixel = (rgb, options = {}) => Array.from(quantizeRgba(
  new Uint8Array([...rgb, 255]), 1, 1, undefined, options
)).slice(0, 3);
for (const [rgb, shifted] of [
  [[255, 0, 0], [0, 255, 0]],
  [[0, 255, 0], [0, 0, 255]],
  [[0, 0, 255], [255, 0, 0]],
]) assert.deepEqual(pixel(rgb, { hue: 120 }), shifted);
assert.deepEqual(pixel([255, 0, 0], { hue: -120 }), [0, 0, 255]);
assert.deepEqual(pixel([255, 0, 0], { hue: 480 }), [0, 255, 0]);
for (const hue of [-180, -37, 42, 180, 360]) {
  assert.deepEqual(pixel([128, 128, 128], { hue }), [128, 128, 128]);
}
assert.deepEqual(pixel([51, 0, 0], { brightness: 2 }), [102, 0, 0]);
assert.deepEqual(pixel([255, 102, 51], { brightness: 0 }), [0, 0, 0]);
assert.deepEqual(pixel([255, 102, 51], { contrast: 0 }), [128, 128, 128]);
assert.deepEqual(pixel([64, 64, 64], { contrast: 2 }), [0, 0, 0]);
assert.deepEqual(pixel([192, 192, 192], { contrast: 2 }), [255, 255, 255]);
for (const control of ["brightness", "contrast", "saturation"]) {
  for (const [input, expected] of [[-1, 0], [3, 2], [NaN, 1], [Infinity, 1]]) {
    assert.deepEqual(pixel([204, 102, 51], { [control]: input }),
      pixel([204, 102, 51], { [control]: expected }));
  }
}
assert.deepEqual(pixel([204, 102, 51], { hue: NaN }), pixel([204, 102, 51]));
assert.deepEqual(pixel([204, 102, 51], { hue: Infinity }), pixel([204, 102, 51]));
const adjusted = { brightness: 1.4, hue: 120, contrast: 1.6, saturation: 1.5, outline: true };
const adjustedTransparent = quantizeRgba(sample, 3, 3, undefined, { ...adjusted, transparent: true });
assert.deepEqual(Array.from(adjustedTransparent.slice(4 * 4, 4 * 5)), [0, 0, 0, 255]);
assert.deepEqual(Array.from(adjustedTransparent.slice(4 * 7, 4 * 8)), [0, 255, 0, 255]);
assert.deepEqual(Array.from(adjustedTransparent.slice(0, 4)), [0, 0, 0, 0]);
assert.deepEqual(Array.from(quantizeRgba(sample, 3, 3, undefined, adjusted).slice(0, 4)), [128, 128, 128, 255]);

// Color and outline processing may never create colors outside the shared
// palette, even for an arbitrary input image with partial transparency.
const gradient = new Uint8Array(64 * 64 * 4);
for (let p = 0; p < gradient.length; p += 4) {
  gradient[p] = p * 13 % 256;
  gradient[p + 1] = Math.floor(p / 7) % 256;
  gradient[p + 2] = Math.floor(p / 31) % 256;
  gradient[p + 3] = Math.floor(p / 4) % 256;
}
const allowed = new Set(VGA_PALETTE.map(rgb => rgb.join(",")));
for (const saturation of [0, 1, 1.8]) {
  assert.deepEqual(
    quantizeRgba(gradient, 64, 64, undefined, { saturation, outline: true }),
    quantizeRgba(gradient, 64, 64, undefined, { saturation, outline: true, brightness: 1, hue: 0, contrast: 1 })
  );
}
const unadjustedAlpha = quantizeRgba(gradient, 64, 64, undefined, { outline: true, transparent: true });
for (const options of [
  { saturation: 0 }, { saturation: 1 }, { saturation: 1.8 },
  { brightness: 0, contrast: 0, hue: -180 },
  { brightness: 2, contrast: 2, saturation: 2, hue: 180 },
  adjusted,
]) {
  const image = quantizeRgba(gradient, 64, 64, undefined, { ...options, outline: true });
  const transparentImage = quantizeRgba(gradient, 64, 64, undefined, { ...options, outline: true, transparent: true });
  for (let p = 0; p < image.length; p += 4) {
    assert.ok(allowed.has(`${image[p]},${image[p + 1]},${image[p + 2]}`));
    assert.equal(image[p + 3], 255);
    assert.equal(transparentImage[p + 3], unadjustedAlpha[p + 3]);
  }
}
console.log("3D studio: six projected facings, editor palette parity, framebuffer orientation, alpha, outlines and color controls passed.");
