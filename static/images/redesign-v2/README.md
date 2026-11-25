# Recursos v2 — Arquitectura de luz

25 noviembre 2026. **Integrados en el frontend del juego.**

Materiales satinados, biseles finos y luz contenida, siguiendo el acabado aprobado
de las letras tridimensionales. Solo recursos existentes; sin iconos nuevos de
la reserva ni cambios de mecánicas o audios.

## Inventario activo

| Recurso | Archivo dentro de esta carpeta | Uso |
| --- | --- | --- |
| Token | `objects/token_card.png` | Presentaciones, tableros y ayudas |
| Terminal | `objects/terminal_box.png` | Presentaciones y ayudas |
| Botonera | `objects/buttons_panel_front.png` | Seis botones: rojo/blanco, verde/azul, negro/amarillo |
| Espera | `objects/wait.png` | Marco triangular y centro reservado al contador |
| Puntos | `objects/points-medallion.svg` | Moneda, mismo trazado de P |
| Memoria | `memory-3d/{letra}-{color}.png` | 60 imágenes: diez letras en seis colores |
| Ejemplo de Memoria | `memory-3d/alpha-red-pedestal.png` | Único pedestal, solo en la presentación |
| Serpientes | `snakes/symbol_0.svg` a `symbol_9.svg` | Diez patrones de nueve casillas |

Las diez máscaras de `memory/*.svg` se conservan como estudio vectorial anterior,
solo para comparación. El juego usa los PNG 3D, incluyendo el simulador del GM.
Los originales siguen referenciados en las galerías comparativas y no se borran.
No son copias sincronizadas. La pirámide maestra se conserva en
`static/branding/piramide-vector.svg`, fuera de esta colección.

## Objetos y procedencia

Ilustraciones creadas con **image_gen**, usando los objetos existentes como
referencias. No son fotografías ni planos exactos del equipo físico.

- Token, terminal y botonera: PNG RGBA de 1024 × 1024, refinados con el material
  satinado de las letras, limpieza de alfa y encuadre común. Se conservan lector,
  barra, símbolos y distribución de los seis colores de la botonera.
- Marco de espera: PNG RGB de 1672 × 941, fondo oscuro y centro vacío.
- Moneda: SVG nativo de 128 × 128, sin imágenes incrustadas ni fuentes externas.
- [Prompts iniciales](prompts.json) y [refinamiento de materiales](objects/material-prompts.json).
- [Generación, colores y transparencia de las letras](memory-3d/README.md).

## Pistas

**Memoria:** las diez piezas 3D conservan la identificación de las letras aprobadas.
Las seis variantes de cada una comparten exactamente el canal alfa. El color se
selecciona mediante el nombre del PNG; no usar máscaras CSS que borren el material.
El negro recibe un contorno neutro fino en el tablero para su lectura sobre grafito.

**Serpientes:** nueve rectángulos por patrón, con el lienzo original de 64 × 64,
las mismas posiciones y medidas, y colores centrales **#9811F2 / #1AE6EC**.
El bisel y el reflejo satinado son interiores; no hay perspectiva ni cambios de
orientación. Las rutas dinámicas de presentación, tablero y GM usan `.svg`.
El acabado actual ya no es idéntico píxel a píxel al PNG original.

[Geometría original y hashes](geometry-report.json): registro del primer estudio
plano, anterior a los biseles. Los resultados de igualdad de píxeles de aquella
fase no describen el acabado actual.

## Revisión y comprobaciones

- [Objetos y serpientes comparados con sus originales](../../previews/recursos-v2.html).
- [Colección activa de letras y único pedestal](../../previews/memory-3d.html).
- Frontend real en fixture aislado, sin MQTT ni hardware: 312 comprobaciones de
  presentaciones y tableros a 1920 × 1080 y 1280 × 720 en los tres idiomas.
- Memoria: 36 comprobaciones de fases, reintentos y respuestas confirmadas, con
  los PNG nuevos decodificados. No hay imágenes ausentes en estas verificaciones.
- Geometría de los 42 bloques de la pirámide y las nueve casillas por patrón
  conservada. Lectura física en sala pendiente; sin despliegue.

Informe de implementación: `docs/REDISENO_UNIFICADO.md`. Capturas e informes
locales: `output/arquitectura-unificada/` desde la raíz del repositorio.
