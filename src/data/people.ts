/** Personas del catálogo de ejemplo. El autor de cada MCP se referencia por `handle`. */
export interface Person {
  handle: string;
  name: string;
  bio: string;
  location?: string;
  joinedAt: string;
  links?: { label: string; href: string }[];
}

export const PEOPLE: Record<string, Person> = {
  davidpargaa: {
    handle: 'davidpargaa',
    name: 'David Parga',
    bio: 'Automatizo webs internas que nadie documentó. Si tiene formularios, tiene API.',
    location: 'A Coruña',
    joinedAt: '2026-03-12T10:00:00Z',
    links: [{ label: 'GitHub', href: 'https://github.com/davidpargaa' }],
  },
  nadia: {
    handle: 'nadia',
    name: 'Nadia Benali',
    bio: 'Datos públicos y administración. Me interesa que la información oficial sea consultable por un agente.',
    location: 'Madrid',
    joinedAt: '2025-11-04T09:30:00Z',
    links: [{ label: 'Web', href: 'https://nadiabenali.dev' }],
  },
  lucia: {
    handle: 'lucia',
    name: 'Lucía Ferrer',
    bio: 'Reservas, agendas y cultura. Convierto formularios con CSRF en herramientas que no fallan.',
    location: 'Valencia',
    joinedAt: '2026-01-19T18:20:00Z',
  },
  marcos: {
    handle: 'marcos',
    name: 'Marcos Ibáñez',
    bio: 'Desarrollo y transporte. Colecciono APIs internas que solo existen en el tráfico del navegador.',
    location: 'Zaragoza',
    joinedAt: '2025-12-02T08:15:00Z',
    links: [{ label: 'GitHub', href: 'https://github.com/marcosibanez' }],
  },
  pere: {
    handle: 'pere',
    name: 'Pere Soler',
    bio: 'Catálogos y bibliotecas. Si un OPAC se puede buscar a mano, se puede buscar por MCP.',
    location: 'Barcelona',
    joinedAt: '2026-02-23T12:40:00Z',
  },
  linen: {
    handle: 'linen',
    name: 'Linen',
    bio: 'Equipo que mantiene MCPortal y publica los MCPs de referencia.',
    location: 'Madrid',
    joinedAt: '2025-09-01T00:00:00Z',
    links: [{ label: 'MCPortal', href: 'https://mcportal.dev' }],
  },
  sofia: {
    handle: 'sofia',
    name: 'Sofía Marín',
    bio: 'Viajes y horarios. Odio las apps que solo funcionan con su propia interfaz.',
    location: 'Sevilla',
    joinedAt: '2026-04-08T16:05:00Z',
  },
};

/** Usuario de la sesión simulada. */
export const CURRENT_USER_HANDLE = 'davidpargaa';
