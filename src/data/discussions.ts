import type { DiscussionComment, Mcp } from './types';
import { NOW } from '../lib/format';

const HOUR = 3_600_000;
const DAY = 86_400_000;

function hash(value: string): number {
  let result = 0;
  for (let i = 0; i < value.length; i += 1) result = (result * 31 + value.charCodeAt(i)) >>> 0;
  return result;
}

function previousVersion(version: string): string {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  if (patch > 0) return `${major}.${minor}.${patch - 1}`;
  if (minor > 0) return `${major}.${minor - 1}.0`;
  return major > 0 ? `${major - 1}.9.0` : '0.1.0';
}

function isoFrom(base: number, offset: number): string {
  return new Date(Math.min(base + offset, NOW)).toISOString();
}

/**
 * Tres hilos ficticios para la demo. Se elige uno de forma estable a partir del slug
 * y se sustituyen el autor y las versiones por los del MCP abierto.
 */
export function discussionFor(mcp: Mcp): DiscussionComment[] {
  const base = +new Date(mcp.updatedAt);
  const previous = previousVersion(mcp.version);
  const variant = mcp.official ? 0 : hash(mcp.slug) % 3;
  const owner = mcp.author;
  const prefix = `${mcp.id}-demo`;

  const threads: DiscussionComment[][] = [
    [
      {
        id: `${prefix}-a1`,
        author: 'Diego M.',
        createdAt: isoFrom(base, -2 * DAY),
        body: `He probado la v${previous} siguiendo la documentación y el buscador de la web ya no devuelve resultados. Desde Claude Code la herramienta termina en timeout. Tiene pinta de que el MCP se ha quedado atrás respecto a la web.`,
      },
      {
        id: `${prefix}-a2`,
        author: owner,
        role: 'owner',
        createdAt: isoFrom(base, 0),
        body: `Gracias por el aviso, Diego. Acabo de publicar la v${mcp.version}: he revalidado las herramientas contra la web y corregido el parámetro que había cambiado. Ya está disponible desde esta misma ficha.`,
        replies: [
          {
            id: `${prefix}-a3`,
            author: 'Nadia B.',
            role: 'contributor',
            createdAt: isoFrom(base, 3 * HOUR),
            body: `Confirmo que la v${mcp.version} ya responde bien en mi entorno. La instalación limpia también ha funcionado sin tocar la configuración anterior.`,
          },
        ],
      },
    ],
    [
      {
        id: `${prefix}-b1`,
        author: 'Marta R.',
        createdAt: isoFrom(base, -5 * DAY),
        body: '¿Este MCP necesita lanzar un navegador para todas las herramientas o solo para las que usan formularios? Quiero montarlo en un contenedor pequeño y no sé cuánto espacio reservar.',
      },
      {
        id: `${prefix}-b2`,
        author: owner,
        role: 'owner',
        createdAt: isoFrom(base, -4 * DAY),
        body: 'Solo las herramientas marcadas como NAV necesitan Chromium. Las de tipo HTTP van directas contra la web, así que puedes usar este MCP sin navegador si tu caso no toca formularios.',
        replies: [
          {
            id: `${prefix}-b3`,
            author: 'Pere S.',
            createdAt: isoFrom(base, -2 * DAY),
            body: 'A mí me ha ido bien en una imagen alpine con Chromium headless. Añadí un par de segundos al arranque y ya está.',
          },
        ],
      },
    ],
    [
      {
        id: `${prefix}-c1`,
        author: 'Pere S.',
        createdAt: isoFrom(base, -9 * DAY),
        body: `Después del último rediseño de la web, algunas llamadas devuelven 403 y el resultado llega vacío. Lo reproduzco con la v${previous} tanto en local como desde Claude Code.`,
      },
      {
        id: `${prefix}-c2`,
        author: 'Lucía F.',
        role: 'contributor',
        createdAt: isoFrom(base, -4 * DAY),
        body: 'He preparado un parche que actualiza las cabeceras y añade un reintento cuando la web responde con un formulario de mantenimiento. Está publicado como nueva versión para que lo podáis probar.',
        replies: [
          {
            id: `${prefix}-c3`,
            author: owner,
            role: 'owner',
            createdAt: isoFrom(base, 0),
            body: `Revisado y publicado. Gracias por la contribución, Lucía: la v${mcp.version} ya incorpora el parche y el historial queda registrado en la ficha.`,
          },
        ],
      },
    ],
  ];

  return threads[variant];
}
