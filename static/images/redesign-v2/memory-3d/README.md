# Letras con volumen — 60 sprites y un pedestal

25 noviembre 2026. **Colección integrada en el tablero, la presentación y el simulador del GM.**

[Abrir la galería](../../../previews/memory-3d.html): diez letras, selector de
seis colores, fondos claro/oscuro, colección completa y descarga de cada PNG.
Funciona como archivo HTML local o con un servidor estático, sin Flask ni MQTT.

## Archivos

- Diez letras: `alpha`, `beta`, `gamma`, `delta`, `epsilon`, `lambda`, `mu`,
  `omega`, `pi`, `sigma`.
- Seis colores por letra: `white`, `black`, `red`, `yellow`, `green`, `blue`.
- Nombre de cada sprite: `{letra}-{color}.png`, por ejemplo `alpha-blue.png`.
- **Solo un pedestal:** `alpha-red-pedestal.png`, para la presentación.
- Los 61 archivos son PNG RGBA de **1024 × 1024**, con transparencia real.
  Encuadre centrado, con el objeto dentro de 840 × 840 y proporciones conservadas.

Los colores corresponden a las categorías funcionales existentes. Los materiales
tienen sombras y reflejos; no son rellenos uniformes de los códigos HEX.
Las seis variantes de cada letra tienen un canal alfa idéntico, sin desplazamiento
al cambiar de color. La versión negra añade una arista interior neutra y fina
para conservar su lectura sobre un fondo oscuro, sin halo exterior.

## Preparación

Las diez bases rojas se crearon mediante **image_gen**, tomando como referencia
las siluetas vigentes de `static/images/puzzle8/` y el acabado de la alfa aprobada.
Mantienen la identidad visual, pero la perspectiva y el volumen no equivalen
a un trazado exacto de las máscaras originales.

El usuario autorizó expresamente la edición programática de los colores y la
limpieza de bordes. Se descartaron las variantes de color generadas por separado
por sus pequeñas manchas de transparencia. Los PNG finales se preparan desde
cada maestro rojo: eliminación de partículas aisladas, suavizado del contorno,
encuadre común y transferencia de color conservando el relieve. El pedestal se
limpia y encuadra sin alterar sus materiales.

- [Prompts de alfa y pedestal](prompts.json).
- [Prompts y fuentes de las otras nueve letras](generation-manifest.json).
- [Hashes de fuentes, resultados y transparencia](preparation-report.json).
- Script de preparación: `docs/artwork/prepare_memory_variants.py`, desde la raíz
  del repositorio. Requiere Pillow y los originales de generación registrados;
  `--source-dir` permite indicar otra carpeta con esos mismos archivos.
  Los PNG finales están guardados directamente y no necesitan regenerarse.

## Verificación y uso

- 60 sprites y exactamente un pedestal; sin archivos ausentes.
- Igualdad exacta del canal alfa en los seis colores de cada letra.
- Una sola componente opaca por letra, sin partículas opacas aisladas.
- Huecos verificados: alfa, delta y sigma, uno; beta, dos; demás letras, ninguno.
- Galería comprobada en Chrome a **1920 × 1080 y 1280 × 720**: los seis colores
  sobre ambos fondos, sin desbordamiento horizontal ni imágenes ausentes.
  Las diez letras de la selección caben en ambas ventanas.
- Revisión visual de la colección y de los bordes sobre fondos claro y oscuro.

Capturas de la colección en `output/memory-3d/`. Integración comprobada mediante
fixture aislado en `output/arquitectura-unificada/`: tres idiomas, 1920 × 1080 y
1280 × 720. El test de Memoria verifica 36 combinaciones de fase, idioma y
resolución, incluidos los reintentos y la conservación de respuestas confirmadas.
Solo simulación; lectura en sala pendiente.

Los archivos se muestran como imágenes normales en `puzzle8.js`,
`presentation-briefing.js`, `presentation-visuals.js` y el simulador del GM.
La ruta se resuelve por letra y color; no se usan máscaras CSS. La alfa con
pedestal se reserva para la explicación previa. El tablero añade un contorno
neutro fino por CSS a las piezas negras, sin cambiar sus PNG. Los originales
siguen referenciados en las galerías comparativas y se conservan.
