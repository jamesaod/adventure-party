# Visibility QA and manual solar control, Rev272

## Sealed areas

Presentation connectivity no longer treats every unmatched polygon edge as an entrance. Curved floor pieces split shared square boundaries into partial spans. These are joined by actual collinear overlap, with authored wall/window spans blocking them. An unmatched interior span stays sealed; an actual open floor/void edge can seed exterior floor. Authored start/entrances and the current party location remain valid roots. Exit-only records and enclosed outdoor cells at the map border do not grant entry. Doors remain potential access even when closed; windows do not. The shared accessibility result drives black floors/inward faces/caps and keeps exterior masonry visible. CPU movement and combat rules are unchanged.

## Wall/floor LOS

GPU wall faces retain their existing hex fragments, but each fragment now queries the same cached friendly visibility polygons as the floor. Samples move 2.5cm outward from a face to avoid testing inside the wall itself. One visible wall segment can no longer brighten another fragment around a hidden corner. Torch flicker and spell radiance follow fragment visibility; broad exposure stays cached. Enemy initiative never becomes an observer. The default renderer is still the Rev270 CPU-reference lighting path on WebGL meshes, not the removed Rev269 shadow or UV-lightmap experiment.

## Doorway strip

Exploration ceiling slabs previously extended .12m above the wall height. Their exposed dark edges could appear as a horizontal strip above a doorway viewed from outdoors. Slabs now end flush with wall tops. Wall heights, door width/depth, texture scale and combat geometry stay unchanged.

## Manual solar dial

The right combat panel places a small astronomical-clock-inspired wheel directly above the compass. Brass rings, Roman hour numerals, a gold solar pointer and blue/twilight/night regions take inspiration from Prague's Orloj, not a literal reconstruction. The crescent is decorative; no Moon phase is inferred from the equinox date.

The model is geometric spring equinox at latitude 38N, using local apparent solar time. Sunrise is 06:00 east, noon is 12:00 due south at 52 degrees altitude, and sunset is 18:00 west. It excludes atmospheric refraction, civil timezone/longitude and DST. A noon-initialized manual test setting is retained within the page session across combat entries; it does not advance game turns or the campaign clock.

Drag the sun/ring around the circle, or focus the dial and use arrows for ten-minute steps, Shift+arrows for hours, PageUp/PageDown for hours, and Home/End for midnight/end of day. The dial follows the pointer immediately. Lighting changes only after 250ms of rest or on release/key-up. There is no continuous solar animation or additional rendering loop.

The solar field is presentation-only: outdoor ambient intensity/color and wall-normal response vary with the Sun; outdoor light carried through portals fades toward night. Explicit indoor ambient and torch/lantern/spell strengths are preserved. Tactical illumination and LOS/targeting still use the original rules field. Noon reuses the original daylight field. Other times cache a visual field with distinct cache keys. No dynamic shadow maps, extra GPU passes or UV wall lightmaps are introduced. Directional face shading/portal transport is an approximation; this does not add moving 3D cast sunlight shadows.

References: https://prague.eu/en/objevujte/old-town-hall-with-astronomical-clock-staromestska-radnice-s-orlojem and https://aa.usno.navy.mil/faq/equinoxes .

## Verification

New regression cases cover enclosed mixed geometry and outdoor map borders, exit-only records, true partial-span connectivity, openable doors, solar elevation/azimuth, pointer wrap, noon parity, indoor ambient preservation, night portal suppression and fragment LOS. Existing sealed, curved-wall, portal, renderer, startup and armor checks remain required. Visual QA uses both main-menu Combat Test and an exploration-authored encounter, plus an outdoor view of an indoor doorway.

Dawn/dusk color test: shared solarPalette blends amber morning light, rose-orange evening light and blue-violet twilight indirect light. Floors/walls through solarAmbient, portal daylight and fir hemisphere/direct sunlight share the palette. Noon base colors and geometric/tactical solar rules retain parity. Day Test toggle near the clock repeats 24 solar hours in 60 seconds, starting from current time; stopping holds the time. It uses the existing ten-minute solar quantization, commits only changed values, and stops on manual dial/setHour, page hiding or combat-control disappearance. This timer requests existing solar presentation updates; it does not advance combat rounds. Browser check verified advance and toggle-off stability; dawn/dusk screens inspected.

Day Test cadence adjustment: advance in one-real-second steps, each exactly 24 solar minutes, retaining the 60-second full-day cycle. Manual dial quantization is unchanged. Timer aligns to the next elapsed-second boundary and computes time from elapsed duration rather than accumulating timer drift.
