// Edit the existing socket, preserving catalog shaft roll and shield mounting offsets.
export function captureFit(THREE,socket,settings,shield=false){
 const base=new THREE.Quaternion().setFromEuler(new THREE.Euler(...settings.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
 return {settings:structuredClone(settings),position:socket.position.clone(),shield,
  extra:shield?socket.quaternion.clone().multiply(base.clone().invert()):base.clone().invert().multiply(socket.quaternion)};
}
export function readFit(THREE,socket,start){
 const q=start.shield?start.extra.clone().invert().multiply(socket.quaternion):socket.quaternion.clone().multiply(start.extra.clone().invert());
 const e=new THREE.Euler().setFromQuaternion(q,'XYZ'),settings=structuredClone(start.settings);
 settings.rotation=[e.x,e.y,e.z].map(THREE.MathUtils.radToDeg);
 settings.position=settings.position.map((v,i)=>Math.max(-1,Math.min(1,v+socket.position.getComponent(i)-start.position.getComponent(i))));
 return settings;
}

// Model-specific palm calibration, composed with each weapon's own catalog grip.
export function captureHandCalibration(THREE,baseline,fitted){
 const q=s=>new THREE.Quaternion().setFromEuler(new THREE.Euler(...s.rotation.map(THREE.MathUtils.degToRad),'XYZ'));
 return {position:fitted.position.map((v,i)=>v-baseline.position[i]),quaternion:q(fitted).multiply(q(baseline).invert()).toArray()};
}
export function applyHandCalibration(THREE,baseline,calibration){
 const result=structuredClone(baseline);if(!calibration)return result;
 const q=new THREE.Quaternion().fromArray(calibration.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(...baseline.rotation.map(THREE.MathUtils.degToRad),'XYZ')));
 const e=new THREE.Euler().setFromQuaternion(q,'XYZ');result.rotation=[e.x,e.y,e.z].map(THREE.MathUtils.radToDeg);
 result.position=baseline.position.map((v,i)=>v+calibration.position[i]);return result;
}
