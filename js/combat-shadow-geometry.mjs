const geometries = new WeakMap();
export const shadowGeometryFor = geometry => geometries.get(geometry) || geometry;
export const registerShadowGeometry = (geometry, shadow) => geometries.set(geometry, shadow);
