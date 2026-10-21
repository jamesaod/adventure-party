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

// Saturation and outline processing may never create colors outside the shared
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
  const image = quantizeRgba(gradient, 64, 64, undefined, { saturation, outline: true });
  for (let p = 0; p < image.length; p += 4) {
    assert.ok(allowed.has(`${image[p]},${image[p + 1]},${image[p + 2]}`));
    assert.equal(image[p + 3], 255);
  }
}
console.log("3D studio: six projected facings, editor palette parity, framebuffer orientation, alpha, outlines and saturation passed.");
