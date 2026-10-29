// Editor-only relative roll; persist the resulting existing XYZ rotation, not a new field.
export function createWeaponShaftRoll(THREE) {
  let key = null, expected = null, base = null, angle = 0;
  const fingerprint = rotation => JSON.stringify(rotation);
  return {
    reset() { key = null; },
    sync(modelId, settings) {
      const nextKey = `${modelId}:${settings.rightHand}`;
      if (nextKey !== key || fingerprint(settings.rotation) !== expected) {
        key = nextKey; base = [...settings.rotation]; angle = 0;
        expected = fingerprint(settings.rotation);
      }
      return angle;
    },
    apply(modelId, settings, axis, degrees) {
      this.sync(modelId, settings);
      const direction = new THREE.Vector3(...axis).normalize();
      if (!direction.lengthSq()) throw new Error('Weapon shaft axis must be nonzero');
      angle = Math.max(-180, Math.min(180, Number(degrees) || 0));
      const rotation = angle === 0 ? [...base] : new THREE.Euler().setFromQuaternion(
        new THREE.Quaternion().setFromEuler(new THREE.Euler(...base.map(THREE.MathUtils.degToRad), 'XYZ'))
          .multiply(new THREE.Quaternion().setFromAxisAngle(direction, THREE.MathUtils.degToRad(angle))), 'XYZ'
      ).toArray().slice(0, 3).map(THREE.MathUtils.radToDeg);
      expected = fingerprint(rotation);
      return {...settings, rotation};
    }
  };
}
