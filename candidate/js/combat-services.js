/* Explicit, ordered extension boundary for legacy combat services.
 * Public function identity stays stable after its first registration. Each stage
 * captures the previous implementation via current(), never the live facade.
 * Names/order are inspectable; installing a duplicate stage is an error. */
(function(scope){
 if(scope.AdventurePartyCombatServices)return;
 const services=new Map();
 scope.AdventurePartyCombatServices={
  current(name){return services.get(name)?.implementation||scope[name];},
  register(name,stage,implementation){
   if(typeof implementation!=='function')throw Error('Invalid combat service '+name+' at '+stage);
   let entry=services.get(name);
   if(!entry){
    entry={implementation:scope[name],stages:[],facade:function(...args){return entry.implementation.apply(this,args);}};
    services.set(name,entry);scope[name]=entry.facade;
   }
   if(entry.stages.includes(stage))throw Error('Duplicate combat service stage '+stage);
   entry.implementation=implementation;entry.stages.push(stage);
   return entry.facade;
  },
  inspect(){return [...services].map(([name,entry])=>({name,stages:[...entry.stages]}));}
 };
})(globalThis);
