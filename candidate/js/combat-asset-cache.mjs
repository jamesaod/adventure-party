// One selected asset set, shared pending loads, and safe late-completion cleanup.
export function createAssetCache(){let current=null,pending=null,revision=0,disposed=false;
 return {select(key,load){if(disposed)throw Error('Asset cache disposed');if(pending?.key===key)return pending.promise;if(!pending&&current?.key===key)return Promise.resolve(current.value);const token=++revision;
 const promise=Promise.resolve().then(load).then(value=>{if(disposed||token!==revision){value.dispose?.();return null;}const old=current;current={key,value};pending=null;old?.value.dispose?.();return value;},error=>{if(token===revision)pending=null;throw error;});pending={key,promise};return promise;},dispose(){if(disposed)return;disposed=true;revision++;current?.value.dispose?.();current=null;pending=null;}};
}
