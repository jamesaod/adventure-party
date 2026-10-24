// Initial combat-relevant AD&D 2e standard Cleric repertoire, levels 1–3.
// Scope: actual priest spell IDs/spheres; no druid-only entries.
const priest=(id,name,level,spheres,targetMode,kind,detail)=>({
 id,name,spellGroup:'Priest',level,spheres,targetMode,kind,
 combatImplemented:true,components:['V','S'],castingTime:1,
 description:detail,damageSummary:detail,range:{fixedHexes:6},
});
const PRIEST_SPELLS=Object.freeze({
 'priest-cure-light-wounds':priest('priest-cure-light-wounds','Cure Light Wounds',1,['Healing'],'touch-creature','heal','Restore 1d8 HP'),
 'priest-bless':priest('priest-bless','Bless',1,['All'],'self','buff','Allied attack and morale blessing'),
 'priest-command':priest('priest-command','Command',1,['Charm'],'hostile-creature','command','Stop one hostile creature for one round'),
 'priest-remove-fear':priest('priest-remove-fear','Remove Fear',1,['Charm'],'creature','remove-fear','Remove fear or panic'),
 'priest-protection-from-evil':priest('priest-protection-from-evil','Protection from Evil',1,['Protection'],'creature','buff','Protection from evil'),
 'priest-light':priest('priest-light','Light',1,['Sun'],'creature','light','Illumination'),
 'priest-sanctuary':priest('priest-sanctuary','Sanctuary',1,['Protection'],'self','buff','Sanctuary protection'),
 'priest-aid':priest('priest-aid','Aid',2,['Necromantic'],'touch-creature','aid','Blessing and temporary hit points'),
 'priest-chant':priest('priest-chant','Chant',2,['Combat'],'self','buff','Allied combat bonus'),
 'priest-hold-person':priest('priest-hold-person','Hold Person',2,['Charm'],'hostile-creature','hold','Paralyze humanoid target'),
 'priest-resist-fire':priest('priest-resist-fire','Resist Fire',2,['Protection'],'touch-creature','buff','Resistance to fire'),
 'priest-resist-cold':priest('priest-resist-cold','Resist Cold',2,['Protection'],'touch-creature','buff','Resistance to cold'),
 'priest-silence':priest('priest-silence','Silence 15-foot Radius',2,['Guardian'],'creature','silence','Silence spells with verbal components'),
 'priest-spiritual-hammer':priest('priest-spiritual-hammer','Spiritual Hammer',2,['Combat'],'hostile-creature','hammer','Summoned hammer attack'),
 'priest-prayer':priest('priest-prayer','Prayer',3,['Combat'],'self','buff','Divine allied combat bonus'),
 'priest-dispel-magic':priest('priest-dispel-magic','Dispel Magic',3,['Protection'],'creature','dispel','Dispel magical effects'),
 'priest-remove-paralysis':priest('priest-remove-paralysis','Remove Paralysis',3,['Healing'],'creature','remove-paralysis','Remove paralysis'),
 'priest-protection-from-fire':priest('priest-protection-from-fire','Protection from Fire',3,['Protection'],'touch-creature','buff','Protection from fire'),
 'priest-magical-vestment':priest('priest-magical-vestment','Magical Vestment',3,['Protection'],'touch-creature','buff','Improve armor defense'),
 'priest-continual-light':priest('priest-continual-light','Continual Light',3,['Sun'],'creature','light','Lasting illumination')
});

window.AdventurePartyPriestSpells=PRIEST_SPELLS;
