export function canopyFeedback(grass,diagnostics){
 if(!Number.isFinite(diagnostics?.canopyBlades))return 'The grass renderer is out of date. Reload this lab to load the update.';
 if(!grass)return 'Grass is hidden. Click Canopy grass to show the comparison.';
 if(diagnostics.canopyBlades<=0)return 'No canopy grass is visible here. Pan to eligible dry ground.';
 return `Whole-map canopy grass: ${Math.round(diagnostics.canopyBlades).toLocaleString('en-US')} blades loaded. Use Original grass to compare or Close view to inspect.`;
}

