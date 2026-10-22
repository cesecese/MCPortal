# Capa de datos del portal (persona 4)

Todo lo que consume el portal pasa por aquí. Las pantallas **no** importan
`src/data/mcps.ts` directamente: piden datos a `services/` o al estado local.

## Piezas

| Archivo | Qué hace |
|---|---|
| `src/types/contract.ts` | Contrato §6: manifiesto, traza, candidato y eventos. **No cambiar sin acuerdo.** |
| `src/types/portal.ts` | Tipos del portal: `Mcp`, `Author`, versiones, informe de validación, filtros y trabajos de generación. |
| `src/data/mcps.ts` | 27 MCPs de ejemplo declarados una vez; de ahí salen manifiesto y herramientas. |
| `src/data/authors.ts` | Autores con estadísticas y actividad calculadas a partir del catálogo. |
| `src/services/mock.ts` | Lectura sin red (válida en servidor) sobre los datos de ejemplo. |
| `src/services/registry.ts` | Lectura contra el registro de la fase 3 (`NEXT_PUBLIC_REGISTRY_URL`). Si falla, cae al mock con un aviso. |
| `src/services/generation.ts` | Generación simulada: eventos §6.4, escena y borrador. |
| `src/state/storage.ts` | Persistencia en `localStorage` (solo cliente, tras montar). |

## Interfaz de lectura (`src/services/index.ts`)

```ts
services.listMcps(filters, order, page) // filters: q, category, impl, mode, verified
services.getMcp(slug)
services.getManifest(slug)
services.getRelated(slug, limit)
services.getUser(handle)
services.getCurrentUser()
```

`NEXT_PUBLIC_DATA_SOURCE=mock|registry` elige implementación sin tocar pantallas.
El mock es síncrono por dentro pero la interfaz es `async` para que el registro
encaje sin cambios.

## Escritura y estado (`useStore()`, en `src/store/store.tsx`)

Mismos nombres que pide la especificación:

```ts
listMyMcps(estado)   saveDraft(mcp)      publish(slug, opciones)
publishDraft(mcp, opciones)               unpublish(slug)
duplicate(slug)      remove(slug)         toggleStar(slug)   toggleSaved(slug)
updateProfile(datos) startGeneration(url, opciones)          cancelGeneration(id)
```

- `mcps` ya mezcla los datos de ejemplo con lo creado en el navegador; `usePublicCatalog()`
  filtra publicados y públicos.
- `listMyMcps('preparing')` devuelve los borradores de los trabajos en curso.
- `saveDraft` y `publishDraft` regeneran el manifiesto con `toManifest()` para que
  refleje los cambios de nombre, descripción y herramientas de la revisión.

## Cómo resolver en cliente un MCP creado por el usuario (para persona 3)

`McpDetail` ya usa `useStore().bySlug(slug)`, que encuentra los MCPs sembrados y
los del navegador. Por tanto:

1. El detalle **no** debe leer `SEED_MCPS` ni `services.getMcp()` para el contenido:
   usa el store. `generateStaticParams` solo prerenderiza los sembrados; con
   `dynamicParams` por defecto, un slug nuevo se renderiza en cliente.
2. `generateMetadata` solo puede conocer los sembrados. Para los creados, deja el
   título genérico y rellénalo en cliente (`document.title`) si hace falta.
3. El catálogo (`Explore`) ya usa `usePublicCatalog()`: un MCP publicado aparece
   sin recargar.
4. Los borradores se ven porque `bySlug` no filtra por estado; la página muestra
   el aviso de borrador. No los enlaces desde el catálogo público.

## Registro (fase 3) — formato acordado con persona 2

El portal espera, con CORS para el dominio de Vercel y `localhost:5180`:

- `GET /mcps?q&category&impl&mode&verified&order&page` →
  `{ items: Mcp[], total, page, pageSize }` (también se acepta un array).
- `GET /mcps/{slug}` → `Mcp` (con `manifest` incluido).
- `GET /mcps/{slug}/manifest` → `Manifest`.
- `GET /u/{handle}` y `GET /me` → `Author`.

`Mcp` es el tipo de `src/types/portal.ts`. Si el registro devuelve solo el
manifiesto, persona 2 y persona 4 tienen que acordar el envoltorio antes de
activar `NEXT_PUBLIC_DATA_SOURCE=registry`.

### JSON mínimo acordado

`validation` y `versions` son obligatorios en la ficha. El registro puede omitir
`manifest` en el listado, pero debe incluirlo en `GET /mcps/{slug}`. Ejemplo
abreviado de un elemento de listado:

```json
{
  "id": "m-openlibrary",
  "slug": "openlibrary",
  "name": "Open Library",
  "site": "openlibrary.org",
  "description": "Busca libros, autores y ediciones en Open Library.",
  "category": "libros",
  "tags": ["libros", "isbn"],
  "author": "MCPortal Labs",
  "authorHandle": "linen",
  "official": true,
  "verified": true,
  "mode": "read_only",
  "version": "1.4.0",
  "license": "MIT",
  "createdAt": "2026-06-14T16:05:00Z",
  "updatedAt": "2026-10-19T10:12:00Z",
  "status": "published",
  "visibility": "public",
  "installs": 12840,
  "weeklyInstalls": [780, 810, 798, 845],
  "stars": 312,
  "exploration": { "steps": 19, "requests": 71, "proposed": 9, "durationSec": 161 },
  "tools": [
    {
      "name": "search_books",
      "description": "Busca libros por título, autor o ISBN.",
      "kind": "http",
      "params": [{ "name": "query", "type": "string", "required": true }],
      "validated": true
    }
  ],
  "versions": [
    {
      "version": "1.4.0",
      "publishedAt": "2026-10-19T10:12:00Z",
      "notes": "Se revalida el buscador y se añade paginación tipada.",
      "tools": 6,
      "validated": 6
    }
  ],
  "validation": {
    "validatedAt": "2026-10-19T10:12:00Z",
    "proposed": 9,
    "validated": 6,
    "results": [
      {
        "name": "search_books",
        "kind": "http",
        "ok": true,
        "reason": null,
        "swapped": false,
        "status": 200,
        "seconds": 1.4,
        "preview": "{\"numFound\": 42}"
      }
    ]
  }
}
```

- `validation.validated` debe coincidir con el número de `results` con `ok: true`.
- `versions` se ordena de más reciente a más antigua en el portal.
- Los errores se devuelven como `{ "error": { "code": "not_found", "message": "..." } }`.
- Respuesta de listado: `{ "items": [Mcp], "total": 22, "page": 1, "pageSize": 24 }`.

## Verificación rápida

```bash
npm run typecheck
npm run build
npx next dev -p 5180
```

Flujos a recorrer: buscar → detalle → copiar instalación; crear de principio a
fin (incluida la generación y la cancelación); publicar; recargar y comprobar
que sigue en la biblioteca.
