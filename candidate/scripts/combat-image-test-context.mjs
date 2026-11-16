// Browser image decode and its change notification, for isolated VM fixtures.
export function installCombatImageTestServices(context){
 context.Image=class{decode(){return Promise.resolve();}};
 context.Event=class{constructor(type){this.type=type;}};
 context.window={dispatchEvent(){},...context.window};return context;
}
