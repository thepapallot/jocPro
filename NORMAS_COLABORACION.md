# Normas de Colaboracion

Documento breve para trasladar al nuevo repositorio unificado.

## Roles

- `Pep`: programador principal, responsable de la base del proyecto, arquitectura general y backend
- `Agusti`: frontend
- `Olalla`: frontend

## Alcance del equipo frontend

Cuando el trabajo lo haga `Agusti` u `Olalla`, el alcance normal debe quedarse en:

- `templates/`
- `static/css/`
- `static/js/`
- documentacion de apoyo

No se deben tocar archivos de backend salvo acuerdo expreso.

Por backend entendemos especialmente:

- `app.py`
- `config.py`
- `mqtt/**`
- cualquier archivo `.py` con logica real, estados, timers o integracion

## Regla de coordinacion

Si durante el trabajo aparece la necesidad de tocar backend:

- no se debe aplicar el cambio directamente
- primero se debe avisar y confirmar

## Registro de cambios de backend

Si excepcionalmente se toca backend, debe quedar registrado en:

- [BACKEND_TOUCHES.md](./BACKEND_TOUCHES.md)

Ese documento sirve para dejar constancia de:

- que archivo se toco
- que parte se añadio o modifico
- por que se hizo
- que impacto funcional puede tener
- que deberia revisar Pep
