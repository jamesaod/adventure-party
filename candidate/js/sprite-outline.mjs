/**
 * Outline measurements shared by the Studio and combat sprite pipelines.
 *
 * Studio saves a physical outline in inches and (for older workspaces) a
 * pixel width for its supersampled source frame. Combat must never reuse
 * source pixels unscaled on the smaller native battlefield frame.
 */
export const BATTLEFIELD_PIXELS_PER_INCH = 64 / (10 * 12);

/**
 * @param {object} style - Studio palette/outline settings.
 * @param {number} targetWidth - The frame to draw the outline into.
 * @param {number} battlefieldWidth - Native battlefield sprite frame width.
 * @param {number} sourceWidth - High-resolution Studio capture frame width
 *   used for legacy outline values without outlineInches.
 */
export function spriteOutlinePixels(style, targetWidth, battlefieldWidth, sourceWidth = targetWidth) {
  if (![targetWidth, battlefieldWidth, sourceWidth].every(n => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Sprite outline frame widths must be positive.');
  }
  if (Number.isFinite(style?.outlineInches)) {
    return Math.max(0, style.outlineInches) * BATTLEFIELD_PIXELS_PER_INCH *
      targetWidth / battlefieldWidth;
  }
  // Legacy captures stored outline as source-frame pixels rather than inches.
  // This is a conversion between resolutions, not a new physical outline.
  return Math.max(0, Number.isFinite(style?.outline) ? style.outline : 0) *
    targetWidth / sourceWidth;
}
