# Armor and movement — Candidate Rev 204

The shared Equipment Library contains all 14 basic PHB armor types. MOB Creator's **Worn armor** selector assigns one to each generated individual; **Always has** remains carried inventory. Armor has no Studio model. Existing models, weapon poses and captures are unaffected.

`js/armor-rules.mjs` is the single source for armor cost, pounds, AC and engine aliases. `chain-mail` and the older engine IDs remain stable. Full plate preserves the printed 4,000–10,000 gp price range. Variants inherit these rules through the existing equipment library and portable MOB snapshots. Explicit item rules override base armor rules.

Sources: user-supplied AD&D 2E Player's Handbook, printed p.69 equipment prices/weights; p.75 Table 46 AC; pp.76–78 armor sizes and Tables 47–48 encumbrance. The source PDF is not distributed. This replaces old fixed armor speed caps and several incorrect legacy prices/weights.

The engine uses optional **specific encumbrance**, Table 48, for movement only. Sum known inventory weights (equipped or carried, including quantities) plus 5 lb. clothing. `clothingWeightLb:0` supports an unclothed unit. Armor weights assume Medium; Small is half and Large is 1.5 times. An item's `armorSize` overrides the wearer's size. Legacy ammunition catalog weights are per dozen; explicit item weights are per piece. Inventory displays carried weight, current/base Move and a warning count for missing weights; unknown weights are not invented. Add weights to custom items for accurate results.

Movement is recalculated when equipment is synchronized; removing armor without dropping it changes AC but does not remove its weight. Stable `authoredMove`/`unencumberedMove` prevents cumulative reductions. Loads at the maximum stagger at Move 1; exceeding it yields Move 0. Table 47 maxima govern its normal Strength rows (including discrepancies with Table 1). Threshold equality uses the listed column, consistent with Table 47's inclusive unencumbered allowance.

The printed movement table covers base speeds 6 and 12 and Strength 2–18/00. Other base speeds scale proportionally and round down, minimum 1 while mobile. Strength 1 and 19–25 use a documented game extension: twelve proportional steps between Table 1 weight allowance and maximum press. This extension is not a printed Table 48 rule. Encumbrance attack/defense penalties, container volume, armor donning time and other class-specific armor restrictions are outside this movement change.

Run `node scripts/test-armor-rules.mjs` plus repository validation. Tests cover the Handbook's Strength 17/140 lb. example, threshold boundaries, overloaded movement, exceptional Strength, size, carried armor, repeat synchronization and MOB export/generation.
