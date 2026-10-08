## Terminal 3D Shared Assets

This folder stores shared renders exported from the original 3D source files used to build the old intro videos.

Purpose:

- reusable support art for intro scenes
- visual reference for recreating terminals and puzzle UI
- isolated pieces for buttons, number strips, symbol plates, scanner bars, and token parts

Origin:

- imported from `/home/agusti/Descargas/imatges caixes 3d(1)/`

Naming note:

- the first semantic rename was inaccurate in several cases
- the current filenames were reviewed again manually against the real image content
- names now describe what the PNG actually shows, not what we initially assumed it was

Practical rule:

- keep using this folder as a shared source library
- if one asset becomes puzzle-specific, copy it into that puzzle's own image folder with a local name

Useful examples:

- `buttons_panel_front.png`: only the six colored arcade buttons
- `numbers_strip_1_to_6.png`: the colored `1 2 3 4 5 6` strip
- `terminal_box_front_full.png`: full terminal with token, scanner bar, and buttons
- `terminal_box_token_lightbar_empty_buttons.png`: full terminal with token and lit scanner bar, but empty button holes
- `token_pyramid_neon.png`: stylized neon pyramid hero render

Notes:

- these are support assets, not runtime replacements for the real puzzle art
- several of these images match real 3D-printed pieces mounted on the physical terminals
