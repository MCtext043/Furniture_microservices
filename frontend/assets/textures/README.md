PBR texture folders live here.

Expected structure:

- `wood/dark-oak/`
- `wood/light-oak/`
- `board/black-board/`
- `board/white-board/`
- `fabric/gray-weave/`
- `metal/graphite-brush/`
- `mdf/matte-soft/`
- `laminate/gray-laminate/`
- `stone/countertop-sand/`
- `room/oak-floor/`
- `room/plaster-wall/`

External maps are loaded only when their exact names are declared in
`frontend/textures3d.js`. This avoids probing missing files and filling the
browser console with 404 responses. A bundle can contain:

- `basecolor.jpg|png|webp`
- `normal.jpg|png|webp`
- `roughness.jpg|png|webp`
- `ao.jpg|png|webp`
- `metalness.jpg|png|webp`

The frontend first renders with procedural fallback maps, then swaps to the
declared external maps. Missing technical maps keep their procedural fallback.
