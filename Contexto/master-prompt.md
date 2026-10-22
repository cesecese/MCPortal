Desarrolla MCPortal, la capa de aplicación de nuestro proyecto de creación y distribución de MCPs.

Antes de empezar, lee contexto.txt para comprender qué es nuestro software, cómo funciona y qué problema resuelve. Utiliza esa información para diseñar una interfaz coherente con el producto.

1. Contexto del proyecto

El proyecto consta de dos componentes diferenciados:

* Core del software: herramienta capaz de explorar una página web, comprender su estructura y generar automáticamente un MCP para interactuar con ella. Su funcionamiento se explica en contexto.txt.
* MCPortal: plataforma web que permite descubrir, descargar, crear y publicar MCPs generados por nuestro software.

Tu tarea consiste exclusivamente en desarrollar la interfaz de MCPortal. No implementes el funcionamiento interno del generador, las integraciones con MCP ni la lógica de publicación o descarga.

2. Objetivo del producto

MCPortal debe funcionar como un punto de encuentro entre quienes necesitan MCPs y quienes los crean.

Un usuario debe poder:

* Explorar un catálogo de MCPs publicados por la comunidad.
* Buscar MCPs por nombre, servicio, categoría o palabras clave.
* Consultar la información de cada MCP, incluyendo su descripción, la web para la que está diseñado y sus herramientas disponibles.
* Acceder a una interfaz para crear un MCP a partir de una página web.
* Revisar el MCP generado y acceder a las opciones de publicación.
* Gestionar visualmente sus MCPs creados, publicados o guardados como borradores.

Estas funcionalidades deben estar representadas mediante interfaces y datos de ejemplo. No es necesario que ejecuten operaciones reales.

3. Branding y dirección visual

El branding es una prioridad. No quiero una interfaz genérica de dashboard, sino un producto con identidad visual propia, reconocible y cuidado hasta el último detalle.

Diseña MCPortal como una herramienta moderna para desarrolladores, con una estética profesional, tecnológica y minimalista.

Principios visuales:

* Jerarquía visual clara y excelente legibilidad.
* Tipografía cuidadosamente seleccionada.
* Paleta cromática coherente con la identidad del producto.
* Espaciado consistente, alineaciones precisas y composición equilibrada.
* Componentes visuales reutilizables y estados de interacción bien definidos.
* Iconografía consistente y funcional.
* Microinteracciones y transiciones sutiles cuando aporten valor.
* Diseño responsive para escritorio, tablet y móvil.

Evita los degradados decorativos gratuitos, las tarjetas innecesarias, los efectos de cristal, los elementos flotantes sin propósito y cualquier recurso visual que haga que el producto parezca una plantilla genérica de SaaS.

La interfaz debe transmitir que MCPortal es una herramienta real, útil y fiable para el ecosistema de desarrolladores.

Toma decisiones de diseño propias. No te limites a aplicar un tema predeterminado.

4. Pantallas principales

Desarrolla las siguientes vistas, manteniendo una identidad visual consistente en toda la aplicación.

A. Página principal y explorador

Será el núcleo de MCPortal.

Debe incluir:

* Navegación principal con el logotipo de MCPortal.
* Una propuesta de valor clara que explique el producto en pocos segundos.
* Un buscador destacado.
* Acceso directo a la creación de nuevos MCPs.
* Un catálogo visual de MCPs publicados.
* Filtros por categoría y otros criterios relevantes.
* Información resumida de cada MCP: nombre, servicio asociado, descripción, herramientas disponibles y autor.
* Indicadores visuales de popularidad, actividad o calidad cuando resulte apropiado.

El catálogo debe parecer real y estar poblado con datos de ejemplo variados y creíbles.

B. Detalle de un MCP

Diseña una vista dedicada a cada MCP que incluya:

* Nombre, descripción y servicio asociado.
* Información del autor.
* Herramientas o capacidades que ofrece.
* Información técnica relevante.
* Botones de descarga o instalación, representados visualmente.
* Elementos para explorar otros MCPs relacionados.

Prioriza la claridad de la información técnica sin renunciar a una buena presentación visual.

C. Crear un MCP

Diseña un flujo de creación sencillo e intuitivo.

Debe contemplar:

1. Introducir la URL de la página web que se quiere explorar.
2. Mostrar un estado visual de preparación o generación.
3. Presentar una vista previa del MCP generado.
4. Permitir revisar su nombre, descripción y herramientas.
5. Mostrar las opciones para publicarlo o guardarlo como borrador.

Todos los pasos deben ser navegables dentro de la interfaz, aunque la generación sea simulada.

D. Biblioteca personal

Diseña una sección donde el usuario pueda consultar sus propios MCPs.

Organiza visualmente los MCPs según su estado:

* Publicados.
* Borradores.
* En preparación, si resulta relevante para el flujo de diseño.

Incluye acciones visuales para abrir, editar o gestionar cada elemento.

E. Perfil y navegación

Incorpora las vistas y componentes adicionales necesarios para que la experiencia resulte completa, incluyendo el perfil del usuario y los estados vacíos pertinentes.

No añadas pantallas por añadir: cada vista debe responder a una necesidad concreta.

5. Alcance técnico

Implementa únicamente la capa de presentación.

Esto significa:

* No desarrolles el motor que explora páginas web.
* No implementes la generación real de MCPs.
* No conectes servicios externos ni APIs.
* No implementes una base de datos ni un sistema real de autenticación.
* No implementes descargas o publicaciones reales.
* No desarrolles lógica de negocio compleja.

Puedes utilizar datos mock y estado local para simular las interacciones necesarias.

Sin embargo, la interfaz no debe ser una colección de pantallas estáticas. Los botones, filtros, buscadores, menús, formularios y flujos principales deben responder de forma coherente cuando el usuario interactúe con ellos.

Si una operación no está implementada, simula su resultado de manera convincente.

Respeta la arquitectura y las tecnologías que ya existan en el proyecto. Antes de modificar archivos, inspecciona la estructura y reutiliza los componentes y dependencias disponibles siempre que tenga sentido.

6. Criterios de calidad

El resultado debe cumplir estas prioridades, por orden:

1. Identidad de marca: MCPortal debe tener una personalidad visual reconocible.
2. Calidad estética: el resultado debe parecer un producto terminado, no un prototipo improvisado.
3. Experiencia de usuario: navegar, descubrir y crear MCPs debe resultar intuitivo.
4. Coherencia: todas las pantallas deben compartir un mismo sistema de diseño.
5. Interactividad: los flujos principales deben funcionar mediante simulaciones locales.
6. Responsive: la aplicación debe adaptarse correctamente a diferentes tamaños de pantalla.
7. Calidad técnica: código organizado, componentes reutilizables y ausencia de errores evidentes.

7. Instrucciones de ejecución

1. Inspecciona el proyecto y lee contexto.txt.
2. Identifica las tecnologías, dependencias y convenciones existentes.
3. Define una dirección visual coherente para MCPortal.
4. Implementa las pantallas y los componentes necesarios.
5. Añade datos de ejemplo realistas y las interacciones locales.
6. Ejecuta la aplicación y comprueba visualmente las principales vistas.
7. Corrige los problemas de diseño, navegación, responsive y funcionamiento que detectes.

No te limites a describir lo que harías ni entregues un plan: implementa directamente la aplicación.

El objetivo final es conseguir una primera versión visualmente sólida y navegable de MCPortal, lista para conectar con el software real en una fase posterior.
