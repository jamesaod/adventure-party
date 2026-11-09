// Studio builds these records. Combat only reads them and records missing recipes.
const scope=typeof location==='undefined'?'/':new URL('.',location.href).pathname;
let connection;
async function db(){
  return connection ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open(`adventure-party-prepared-models:${scope}`,1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('assets');request.result.createObjectStore('requests');};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function operation(store,mode,action){
  const database=await db();return new Promise((resolve,reject)=>{
    const transaction=database.transaction(store,mode),request=action(transaction.objectStore(store));
    transaction.oncomplete=()=>resolve(request.result);transaction.onerror=()=>reject(transaction.error);transaction.onabort=()=>reject(transaction.error);
  });
}
export const readPreparedAsset=key=>operation('assets','readonly',store=>store.get(key));
export const writePreparedAsset=(key,value)=>operation('assets','readwrite',store=>store.put(value,key));
export const requestPreparedAsset=(key,recipe)=>operation('requests','readwrite',store=>store.put(recipe,key));
export const pendingPreparedAssets=()=>operation('requests','readonly',store=>store.getAll());
export const finishPreparedAsset=key=>operation('requests','readwrite',store=>store.delete(key));

export const listPreparedAssets=()=>operation('assets','readonly',store=>store.getAll());
