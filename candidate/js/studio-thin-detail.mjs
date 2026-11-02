/**
 * Coverage-aware rescue for narrow opaque equipment after supersampled rendering.
 * Canvas high-quality downscaling can give a one-pixel sword edge alpha < 128;
 * VGA quantization would then erase it entirely. Rescue only destination pixels
 * intersecting a source texel with substantial opacity, before palette mapping.
 *
 * Both buffers use TOP-DOWN rows, arranged as identical 3x2 facing atlases.
 * The original full-resolution atlas and source data are never modified.
 */
export function preserveThinSpriteDetails(source, sourceFrameWidth, sourceFrameHeight,
  destination, targetFrameWidth, targetFrameHeight, columns = 3, rows = 2) {
  for (const dimension of [sourceFrameWidth,sourceFrameHeight,targetFrameWidth,targetFrameHeight,columns,rows]) {
    if (!Number.isInteger(dimension) || dimension < 1) throw new RangeError('Invalid sprite frame dimension.');
  }
  const sourceStride = sourceFrameWidth * columns;
  const targetStride = targetFrameWidth * columns;
  if (source.length !== sourceStride * sourceFrameHeight * rows * 4 ||
      destination.length !== targetStride * targetFrameHeight * rows * 4) {
    throw new RangeError('Sprite coverage buffers do not match atlas dimensions.');
  }
  for (let facingRow = 0; facingRow < rows; facingRow++) {
    for (let facingCol = 0; facingCol < columns; facingCol++) {
      for (let y = 0; y < targetFrameHeight; y++) {
        const yStart = Math.floor(y * sourceFrameHeight / targetFrameHeight);
        const yStop = Math.min(sourceFrameHeight,
          Math.ceil((y+1) * sourceFrameHeight / targetFrameHeight));
        for (let x = 0; x < targetFrameWidth; x++) {
          const targetIndex = ((facingRow*targetFrameHeight+y)*targetStride +
            facingCol*targetFrameWidth+x)*4;
          if (destination[targetIndex+3] >= 128) continue;
          const xStart = Math.floor(x * sourceFrameWidth / targetFrameWidth);
          const xStop = Math.min(sourceFrameWidth,
            Math.ceil((x+1) * sourceFrameWidth / targetFrameWidth));
          let bestAlpha = 0, bestIndex = -1;
          for(let sy=yStart;sy<yStop;sy++){
            const start=((facingRow*sourceFrameHeight+sy)*sourceStride+facingCol*sourceFrameWidth)*4;
            for(let sx=xStart;sx<xStop;sx++){
              const offset=start+sx*4, alpha=source[offset+3];
              if(alpha>bestAlpha){bestAlpha=alpha;bestIndex=offset;}
            }
          }
          // Ignore faint antialiasing haze. One real opaque source pixel can
          // represent a thin sword blade that would otherwise be erased.
          if(bestAlpha<192)continue;
          destination[targetIndex]=source[bestIndex];
          destination[targetIndex+1]=source[bestIndex+1];
          destination[targetIndex+2]=source[bestIndex+2];
          destination[targetIndex+3]=Math.max(192,destination[targetIndex+3]);
        }
      }
    }
  }
  return destination;
}
