import type { CategoryId } from './types';
import type { IconName } from '../components/Icon';

export interface Category {
  id: CategoryId;
  label: string;
  icon: IconName;
}

/** Categorías del catálogo (§8 del master prompt). */
export const CATEGORIES: Category[] = [
  { id: 'comercio', label: 'Comercio', icon: 'bag' },
  { id: 'reservas', label: 'Reservas', icon: 'calendar' },
  { id: 'datos', label: 'Datos abiertos', icon: 'landmark' },
  { id: 'desarrollo', label: 'Desarrollo', icon: 'code' },
  { id: 'cultura', label: 'Música y cultura', icon: 'ticket' },
  { id: 'administracion', label: 'Administración pública', icon: 'shield' },
  { id: 'internas', label: 'Herramientas internas', icon: 'inbox' },
  { id: 'viajes', label: 'Viajes', icon: 'compass' },
  { id: 'libros', label: 'Libros y lectura', icon: 'book' },
  { id: 'transporte', label: 'Transporte', icon: 'route' },
  { id: 'eventos', label: 'Eventos', icon: 'calendar' },
  { id: 'empleo', label: 'Empleo', icon: 'briefcase' },
  { id: 'ciencia', label: 'Ciencia', icon: 'flask' },
];

export function categoryOf(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}
