# Scripts Python

Este directorio contiene utilidades de mantenimiento para auditar recursos gráficos y audiovisuales.

## Requisitos

- Ejecutar desde la raiz del repo (`jocPro`).
- Python 3 disponible como `python3`.

## Scripts disponibles

### `audit_image_assets.py`

Audita imagenes y referencias de imagen en el proyecto.

Que hace:

- recorre los recursos activos de `static/images`, excluyendo `no_usadas/`
- busca referencias `/static/images/...` en código, templates y visores
- detecta referencias faltantes
- detecta recursos retirados que reaparecen en sus antiguas rutas, incluso sin añadir a Git
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

Comprobación antes de un commit, sin modificar el informe versionado:

```bash
python3 scripts/audit_image_assets.py --check --output /tmp/piramide-images-check.json
```

Devuelve un código de error si encuentra referencias literales ausentes o archivos
retirados que han vuelto a aparecer. GitHub Actions ejecuta la misma comprobación
en cada push y pull request. No necesita audios, reserva local, MQTT ni hardware.

Las rutas retiradas se mantienen en `docs/retired_image_assets.json`; `old_pics/`
se comprueba completa para detectar también archivos nuevos dentro de ella.
El manifiesto no sustituye la revisión manual de rutas dinámicas. Si se reutiliza
deliberadamente un recurso autorizado por la guía, moverlo desde `no_usadas/`,
actualizar sus referencias y retirar su ruta de la lista en el mismo cambio.
No añadir excepciones a `.gitignore` ni mantener dos copias sincronizadas.

### `audit_video_assets.py`

Audita videos y referencias de video en el proyecto.

Que hace:

- recorre `static/videos`
- busca referencias `/static/videos/...` en código, templates y visores
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

Los generadores y catálogos del reproductor antiguo se retiraron el 5 de octubre de 2026.
Las presentaciones actuales se mantienen en `templates/` y `static/js/presentation-*.js`.
Los informes detectan referencias literales; revisar también las rutas dinámicas antes de borrar recursos.
