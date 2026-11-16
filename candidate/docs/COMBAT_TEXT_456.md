# Local R238C456 — combat feedback

Restores original synthesized agony/hit and death cues from the existing local walk-test backup. Keeps onomatopoeia and faction-colored speech; selected voice recordings remain removed. Damage/result beats retain their timing and enqueue speech after damage categories. Death feedback remains deduplicated by the existing result/death owner.

Damage text holds fully opaque at a fixed anchor, then disappears. Both damage and talking use 14px screen-space text independent of zoom. Anchor uses authored model height (including enlargement), plus 0.9144m/three feet of clearance, follows walking and streambed presentation. Existing collision avoidance may lift crowded talking labels further. Other status/healing text retains its existing presentation.

Validation: 137/137 combat regressions passed, including damage-before-speech ordering, fixed damage position/opacity, shared 14px font, physical clearance, and restored generic audio hooks. Production Chrome check retained blue/red speech at 0.5x/1x/2x zoom and death text without voice-recording requests or runtime errors. Full workflow 128/131; the same three pre-existing unrelated failures remain.
