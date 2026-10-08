# Celebración común · prueba e integración

Piloto solicitado el 8 octubre 2026. La prueba muestra el último objetivo de
Cálculo Extremo y una celebración única: pirámide, construcción del progreso,
un pulso y «HO HEU ACONSEGUIT!». Después mantiene el progreso estable.

## Abrir y repetir

Desde la raíz del repositorio:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Abrir <http://127.0.0.1:8765/static/previews/victoria-calcul.html> y pulsar
«Viure la victòria». El primer clic activa el sonido. Permite pantalla completa,
tres idiomas, silencio y movimiento reducido. Esc vuelve a los controles;
«Tornar a provar» aparece al terminar. Al ocultar la pestaña se detiene el audio.
El panel incluye un reproductor de la música real del juego. Se puede dejar
sonando y elegir un punto de la canción antes de iniciar la celebración.
«Viure la victòria» conserva esa posición y la reproducción. Repetir mantiene
la música; Esc y ocultar la pestaña detienen ambos audios. «Amb so» utiliza
la base al 22 % y los efectos al 65 %, sin silencio en los reproductores.

La previsualización reutiliza los estilos de la superficie real de Sumas y el
componente maestro de la pirámide. El tablero representa 15 de 16 objetivos
resueltos y simula el último encert. El progreso ilustrativo pasa de 1 a 2 retos
de 8, que en el maestro corresponden a seis nuevos bloques. No registra logros,
no abre rutas de juego, no escribe sesiones y no conecta con MQTT ni hardware.
La versión aprobada está integrada en los doce puzzles. El GM mantiene la pantalla
estable al terminar y abre la próxima presentación cuando el grupo está preparado.

## Sonido original

Efectos vigentes: `static/audios/effects/victory-celebration.wav`.
PCM estéreo, 48 kHz, 16 bits, 8,4 s; pico normalizado a −6 dBFS.
El usuario descarta la segunda fanfarria por no encajar con la base. La tercera
versión contiene únicamente un barrido de entrada, un ascenso de energía
continuo y un impacto con cola de aire al llegar el mensaje. Ruido filtrado y
reflexiones breves, sin notas, acordes, batería ni pulsos en los seis bloques.
La música procede exclusivamente de `static/audios/musica_ambient/musica_piramide.mp3`.
Los WAV anteriores se conservan como versiones de evaluación; no se cargan.

El reloj del WAV gobierna la animación. Los seis bloques entran a 1,05; 1,49;
1,93; 2,37; 2,81 y 3,25 s; el pulso y el mensaje llegan a 3,80 s.
La música continúa sin pausa ni salto. Su volumen crece del 22 % al 28 % durante
la construcción, llega al 42 % con el clímax y vuelve al 22 % entre 4,8 y 7,5 s.
Si los efectos o la música fallan, se muestra un aviso y se puede reintentar o elegir
la prueba sin sonido. Los controles de ensayo están fuera de la composición.

Todos los audios permanecen ignorados por Git y se distribuyen por USB.
El generador original queda versionado para reproducir el archivo:

```sh
node docs/audio/render-victory-calcul.cjs
```

## Verificación

```sh
node tests/victory_preview_browser.cjs http://127.0.0.1:8765
```

Auditoría con Chrome, sin servidor de juego: reproducción y final natural del
WAV, sincronización, continuidad sin pausas ni saltos de la base, subida y
recuperación de volumen, repetición conservando la música, Esc, silencio,
movimiento reducido, catalán/castellano/inglés a 1920 × 1080 y 1280 × 720.
Resultados y capturas en `output/victoria-calcul/`.
Solo simulación: la calidad percibida del sonido, su volumen y la reacción del
grupo quedan pendientes de escucha y ensayo en sala.

## Integración en el juego

`level-victory.js` recibe la confirmación `puzzle_solved` de cada puzzle después
de su limpieza de temporizadores y audio. Registra el logro una sola vez en el
reproductor exterior y dibuja el progreso anterior y actual. No modifica backend,
reglas, tiempos de resolución ni señales de hardware.

- Los doce puzzles usan el mismo efecto aprobado y el renderer compartido.
- El simulacro y las pruebas 7, 9 y 10 no aumentan los ocho retos puntuables.
- La música persistente sigue su posición, también al repetir desde el GM.
- El GM puede avanzar a la siguiente presentación al acabar los 8,4 segundos.
- Carga Final en castellano abre `/final?charge=1` tras registrar el logro. Su
  secuencia propia reúne llenado, efecto de diez segundos, mensaje y foto con
  ADN Games; no reproduce primero el efecto común. Catalán e inglés conservan
  `/final?celebrated=1` después de su celebración y entran en la foto.
- Si el audio falta o el navegador lo bloquea, el cierre visual termina igualmente
  y se ofrece repetir con sonido. El progreso no se duplica.
- Las páginas de logro abiertas desde el selector muestran el progreso estable.

Comprobación de integración sin MQTT ni hardware:

```sh
venv/bin/python tests/victory_runtime_fixture.py
node tests/victory_runtime_browser.cjs
node --test tests/*.test.cjs
```

El fixture carga las rutas y plantillas reales con eventos y peticiones de juego
simulados. Chrome comprueba reproducción, continuidad musical, doce confirmaciones,
progreso, repetición, control del GM, paso a foto y distribución a 1920 × 1080 y
1280 × 720. Capturas e informe: `output/victoria-integrada/`. Chrome se ejecuta
sin salida de audio: comprueba el reproductor, no la escucha física en altavoces.

Para trasladarlo al equipo de juego hay que copiar también
`static/audios/effects/victory-celebration.wav` por USB: Git no transporta audios.
