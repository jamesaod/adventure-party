# Local build R238C425: weather panel and grass footstep level

- Weather controls now occupy the bottom of the left battlefield box, below the canvas. Separate 0–100% snow, rain, cloudiness and wind sliders can be combined. Existing snow pause, clear, depth adjustment and flake visibility controls move with snowfall. Solar time and compass controls stay in their existing panel.
- Rain amount controls rain density and the existing wet-ground/puddle simulation. Cloudiness affects solar lighting, wind controls rain drift, wind effects and grass sway; snow retains its existing deposit system and 12-inch cap. The legacy weather cycling API remains for existing diagnostic fixtures.
- Grass footsteps use gain 0.96 instead of 0.24 (four times amplitude, approximately +12 dB). Mud remains 0.15; dirt and water remain unchanged. Existing foot-plant cadence and samples are preserved.
- Validation: 124/124 combat regressions passed. Headless production browser checked concurrent slider values, solar response, weather placement below the canvas, moved snow controls, grass gain and preserved mud gain. Listening/visual QA remains with the user. Local only; not published.
