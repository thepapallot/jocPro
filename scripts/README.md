# Scripts Python

Este directorio contiene utilidades de mantenimiento para escenas y assets.

## Requisitos

- Ejecutar desde la raiz del repo (`jocPro`).
- Python 3 disponible como `python3`.

## Scripts disponibles

### `generate_intro_scene.py`

Genera escenas intro (`_v2`) a partir de:

- una plantilla (`scenes/templates/intro/scene_intro_template.json`)
- un catalogo (`scenes/catalog/intro_catalog.json`)
- un catalogo de media (`scenes/catalog/media_catalog.json`)
- un catalogo semantico de imagenes (`scenes/catalog/image_semantics.json`)
- escenas base legacy (`scenes/source/intropuzzles/...`)

Que hace:

- crea `config.json` en `scenes/source/intropuzzles/<scene_id>/`
- inyecta titulos, audio, assets y subtitulos
- sincroniza timings con la escena legacy (si esta activado en catalogo)
- selecciona clips de Cero segun intencion narrativa (intro/briefing/warning/close), con variedad entre escenas
- prioriza assets de intro segun semantica por puzzle (`puzzleX > shared > desconocido > desaconsejado para ese puzzle`)

Control de casting en `intro_catalog.json`:

- `defaults.character_intents` define la intencion por etiqueta de segmento (`intro_estable`, `bloque_estable`, `cierre_suave`)
- cada `entry` puede sobrescribir con `character_intents` propio
- `media_catalog` indica de donde leer roles y duraciones de clips
- `image_semantics_path` define el catalogo semantico para priorizar imagenes correctas por puzzle
- `defaults.lock_opening_character=true` mantiene fija la primera aparicion de Cero para todas las intros
- `defaults.lock_closing_character=false` por defecto: el clip final de Cero puede variar; la cuenta atras (`3,2,1`) sigue fija por plantilla
- `defaults.auto_fullscreen_from_subtitles=false` por defecto (modo texto desactivado)

Uso:

```bash
python3 scripts/generate_intro_scene.py
```

Forzar regeneracion de todas:

```bash
python3 scripts/generate_intro_scene.py --force
```

Opciones utiles:

- `--catalog <ruta>`
- `--template <ruta>`
- `--output-root <ruta>`

### `audit_image_assets.py`

Audita imagenes y referencias de imagen en el proyecto.

Que hace:

- recorre `static/images`
- busca referencias `/static/images/...` en codigo/escenas/templates
- detecta referencias faltantes
- reporta conteos por bucket/subcarpeta y top de uso

Salida por defecto:

- `docs/image_assets_audit.json`

Uso:

```bash
python3 scripts/audit_image_assets.py
```

Salida personalizada:

```bash
python3 scripts/audit_image_assets.py --output docs/mi_auditoria_imagenes.json
```

### `audit_video_assets.py`

Audita videos y referencias de video en el proyecto.

Que hace:

- recorre `static/videos`
- busca referencias `/static/videos/...` en codigo/escenas/templates
- detecta referencias faltantes
- reporta conteos por bucket/subcarpeta y top de uso

Salida por defecto:

- `docs/video_assets_audit.json`

Uso:

```bash
python3 scripts/audit_video_assets.py
```

Salida personalizada:

```bash
python3 scripts/audit_video_assets.py --output docs/mi_auditoria_videos.json
```

## Flujo recomendado

1. Cambiar rutas/orden de assets.
2. Ejecutar auditorias:

```bash
python3 scripts/audit_image_assets.py
python3 scripts/audit_video_assets.py
```

3. Si cambias plantilla/catalogo de intros, regenerar:

```bash
python3 scripts/generate_intro_scene.py --force
```
