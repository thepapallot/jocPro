# Image Assets Migration Plan

Objetivo: ordenar imágenes por dominio sin romper el juego ni las escenas.

## Estado actual (auditoría)

Fuente: `python3 scripts/audit_image_assets.py`  
Salida: `docs/image_assets_audit.json`

- Total imágenes en `static/images`: `145`
- Buckets más grandes: `shared` (`38`), `puzzle7` (`23`), `puzzleFinal` (`20`), `puzzle2` (`18`), `puzzle1` (`11`)
- Referencias más usadas: `/static/images/puzzle1/tarjeta.png` (`49`), `/static/images/puzzle1/intro/custom_subtitles/37.png` (`37`), `/static/images/puzzle1/caixa.png` (`20`), `/static/images/puzzle1/intro/custom_subtitles/39.png` (`13`), `/static/images/shared/terminal_3d/buttons_panel_front.png` (`13`)

Conclusión: hay assets claramente compartidos que todavía están bajo `puzzle1`.

## Estructura objetivo

```text
static/images/
  shared/
    terminal_3d/
    gameplay/
    warnings/
    branding/
  puzzles/
    puzzle1/
      gameplay/
      intro/
    puzzle2/
      gameplay/
      intro/
      symbols/
    ...
  scenes/
    intro/
    outro/
```

## Mapeo recomendado (fase 2)

Estos son los movimientos prioritarios porque hoy se usan como recursos cross-puzzle:

- `/static/images/puzzle1/tarjeta.png` -> `/static/images/shared/gameplay/token_card.png`
- `/static/images/puzzle1/caixa.png` -> `/static/images/shared/gameplay/terminal_box.png`
- `/static/images/puzzle1/intro/custom_subtitles/37.png` -> `/static/images/shared/warnings/restart_button.png`
- `/static/images/puzzle1/intro/custom_subtitles/38.png` -> `/static/images/shared/warnings/repeated_operation.png`
- `/static/images/puzzle1/intro/custom_subtitles/39.png` -> `/static/images/shared/warnings/operation_error.png`
- `/static/images/puzzle1/intro/custom_subtitles/40.png` -> `/static/images/shared/warnings/timeout.png`

Mover más cosas solo si realmente se reutilizan fuera de su puzzle.

## Plan de migración seguro

### Paso 1: preparar carpetas y duplicar (sin borrar legacy)

- Crear rutas nuevas en `static/images/shared/...`.
- Copiar assets candidatos a shared a su nueva ruta.
- Mantener de momento también los ficheros legacy para compatibilidad.

### Paso 2: actualizar runtime y plantillas

Archivos clave a actualizar:

- `player/main.js`
- `player/styles.css`
- `static/js/test.js`
- `scenes/catalog/intro_catalog.json`
- `scenes/templates/intro/puzzle_intro_template.json`
- `scenes/source/intropuzzles/*.json`
- `scenes/source/cierre/*.json`

Nota: `scenes/generated/intro/*.json` no debe editarse a mano.

### Paso 3: regenerar escenas generadas

```bash
python3 scripts/generate_intro_scene.py --force
```

### Paso 4: validación rápida

- Buscar rutas antiguas:

```bash
rg -n '/static/images/puzzle1/(tarjeta\.png|caixa\.png|intro/custom_subtitles/(37|38|39|40)\.png)' -S
```

- Ejecutar app y abrir player para validar intros.

### Paso 5: limpieza final

- Cuando todo esté validado, eliminar/copiar legacy restante.
- Mantener `scripts/audit_image_assets.py` como chequeo de regresión.

## Convenciones de nombres

- Todo en `snake_case`.
- Evitar nombres opacos tipo `37.png` o `xxxLaberint.png`.
- Usar nombres semánticos: `terminal_box`, `token_card`, `warning_timeout`.
