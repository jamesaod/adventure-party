# Item light emission

`js/item-lighting.mjs` owns the common emission contract. Catalog entries can put a `lightSource` profile in their rules, which the repository equipment pipeline copies into inventory. Runtime/custom items can provide the same `lightSource` object directly. A catalog-profile lookup also supports older saved inventory records containing only `catalogItemId` or `appearanceId`.

Profile fields: `radiusHexes`, `intensity`, `color` (three display-RGB numbers, 0–255), `heightMetres`, `flicker`, `swayMetres`, `daylightContrast`. The initial catalog profile is Flaming Sword +5; ordinary items do not emit light automatically.

An item emits when equipped, or when explicitly `lit:true` while carried. `lightEnabled:false`, `lit:false`, or zero quantity disables it. Multiple emitting items create independent stable source IDs. Owners remain attached to their units, preserving carried-light self-shadow exclusion. Player and MOB inventory use identical rules.

Daylight contrast is presentation-only: full strength at night and indoors; smooth reduction outdoors toward 4% at full daylight with the default contrast of 24. The shared render-light list applies this factor to terrain, sprites, trees and shadow sources. Gameplay illumination strength/range are unchanged. Flames remain visible as artwork.

No torch or lantern catalog assets were invented for this pass; future entries can use this contract. Ground/dropped item placement, fuel consumption, editor controls and exploration equipment integration are future work. The pre-existing automatic combat lantern remains removed.
