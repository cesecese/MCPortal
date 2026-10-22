# Fixtures

Datos de prueba escritos a mano para que cada pieza se pueda desarrollar sin esperar a las demás
(sección 4 del `MASTER_PROMPT_EQUIPO.md`).

| Fichero | Qué es |
|---|---|
| `trace.example.json` | Traza de exploración (contrato 6.2) con 21 pasos, 16 peticiones, 10 candidatos y 5 dependencias: los 7 de la tienda (`categories`, `search`, `products/{id}`, `cart`, `cart/{id}/items`, `cart/{id}`, `checkout`) y los 3 del restaurante (`disponibilidad`, `reserva` POST con `csrf_fields`, `reserva` GET). |
| `events.example.jsonl` | Ejecución completa con los 18 tipos de evento de la sección 6.4, en orden y con tiempos realistas. |
| `check_contract.py` | Comprueba los tres artefactos contra el contrato: `py fixtures/check_contract.py`. |

## Cosas que conviene saber

- **La traza mezcla las dos webs de demo** (tienda en 8001 y restaurante en 8002) porque el
  enunciado pide una sola traza con el carrito y la reserva. `site` es la de la tienda; los
  candidatos del restaurante llevan su propio `origin`.
- **El candidato `c9` (POST /reservar) acaba en 403 a propósito**: sin la cookie de sesión el token
  CSRF no vale. Por eso trae `csrf_fields` y receta de navegador, y es el caso que demuestra el
  cambio `http → browser` del validador.
- **En `events.example.jsonl`, `blocked` y el `warning` que lo precede son sintéticos**: sirven para
  que el panel pinte el estado de solo lectura aunque la traza sea de `localhost`. El resto de
  eventos sigue la ejecución real de la tienda.
- `c9` lleva el token CSRF como **literal** en el body (es lo que se observó), no como `{param}`:
  los campos CSRF van en `csrf_fields`, no son parámetros de la herramienta.
