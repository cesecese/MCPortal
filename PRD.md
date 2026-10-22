# MCPortal — PRD

> Documento vivo. Se rellena pregunta a pregunta con el equipo. Lo que no está decidido aparece como _Pendiente_.
> Contexto técnico de partida: `contexto.txt` (brief de Auto-MCP).

## 1. Qué es

MCPortal es el registro de servidores MCP generados a partir de webs sin API. Pegas una URL, un agente explora la web, descubre sus acciones y publica un MCP con herramientas tipadas que cualquier cliente MCP puede instalar y usar.

## 2. Usuarios y objetivo

- Es un **registro público**: cualquiera puede explorar, buscar e instalar MCPs de otros, además de crear los suyos.

## 3. Alcance para la demo

- En el pitch, la web es un **extra**: lo central es el cliente MCP y el panel en vivo. MCPortal se enseña un momento como el sitio donde acaban los MCPs.
- Es una **maqueta con datos falsos**: todo sale de `src/data/`, sin conexión con el explorador, el validador ni el runtime.

## 4. Pantallas

Tres pantallas: **Inicio + catálogo**, **Ficha de un MCP** y **Crear MCP**. No hay página de perfil.

### 4.1 Inicio + catálogo

- Solo un **buscador** y la lista de resultados. Sin chips de categoría, sin selector de orden, sin filtros.
- Cada MCP es una **tarjeta en rejilla**: favicon o inicial de la web, nombre del sitio, descripción corta, número de herramientas e instalaciones.

## 5. Flujo de creación de un MCP

_Pendiente_

## 6. Ficha de un MCP

_Pendiente_

## 7. Instalación y uso desde un cliente MCP

_Pendiente_

## 8. Cuentas, perfiles y social

- Web **anónima**: nadie inicia sesión. El autor de cada MCP se muestra como texto, sin enlace a perfil.

## 9. Diseño visual

Ya decidido en el código: tipografía Geist y Geist Mono, color de fondo `#F4F3EE`, interfaz en español.
Dirección y sistema de diseño en `DESIGN.md`; componentes y estados en `/_styleguide`.

_Pendiente el resto._

## 10. Backend y datos

Ya decidido en el código: Next.js 15 + React 19 + TypeScript, datos de prueba en `src/data/`.

_Pendiente_

## 11. Fuera de alcance

_Pendiente_

## 12. Preguntas abiertas

_Pendiente_
