# Asset Attribution

This file documents third-party game art attribution requirements for the frontend build.

## Approved

### PixelOffice by 2dPig
- Path: public/PixelOffice
- License: CC0 1.0
- Attribution required: No
- Source notice: public/PixelOffice/README.txt

### Free Office Pixel Art by arlantr
- Path: public/free-office-pixel-art
- License: Custom permissive statement ("Free to use any way you want")
- Attribution required: Not explicitly required
- Source notice: public/free-office-pixel-art/Readme.txt
- Source page: https://arlantr.itch.io/

### Indoor Office Appliances by semtex99 (OpenGameArt)
- Path: public/pixel-assets/oga/office/office-tilemap.png
- License: CC0
- Attribution required: No
- Source page: https://opengameart.org/content/indoor-office-appliances

### 2D Pixel Office Supplies 32x32 by Natural_Privateer (OpenGameArt)
- Path: public/pixel-assets/oga/office
- License: CC0
- Attribution required: No
- Source page: https://opengameart.org/content/2d-pixel-office-supplies-32x32

### glTF Sample Models by KhronosGroup
- Path: public/models/cc-by/khronos
- License: CC-BY 4.0
- Attribution required: Yes
- Source page: https://github.com/KhronosGroup/glTF-Sample-Models
- Included files: BoomBox.glb, Lantern.glb

## Blocked

### Sprout Lands Basic Pack by Cup Nooble
- Path: public/Sprout Lands - Sprites - Basic pack
- License: Non-commercial only
- Attribution required: Yes
- Runtime use: Blocked for product release
- Source notice: public/Sprout Lands - Sprites - Basic pack/read_me.txt

## Release Gate

Before production release, every asset directory used by runtime rendering must have:
1. A verified license category in public/licenses/ASSET_MANIFEST.json.
2. A source URL and local evidence file.
3. Usage status set to approved or approved-with-review.
