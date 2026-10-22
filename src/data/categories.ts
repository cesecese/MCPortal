import type { CategoryId } from './types';
import type { IconName } from '../components/Icon';

export interface Category {
  id: CategoryId;
  label: string;
  icon: IconName;
}

export const CATEGORIES: Category[] = [
  { id: 'libros', label: 'Libros y lectura', icon: 'book' },
  { id: 'comercio', label: 'Comercio', icon: 'bag' },
  { id: 'reservas', label: 'Reservas', icon: 'calendar' },
  { id: 'transporte', label: 'Transporte', icon: 'route' },
  { id: 'datos', label: 'Datos públicos', icon: 'landmark' },
  { id: 'eventos', label: 'Eventos', icon: 'ticket' },
  { id: 'empleo', label: 'Empleo', icon: 'briefcase' },
  { id: 'ciencia', label: 'Ciencia', icon: 'flask' },
  { id: 'desarrollo', label: 'Desarrollo', icon: 'code' },
];

export function categoryOf(id: CategoryId): Category {
  return CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
}
