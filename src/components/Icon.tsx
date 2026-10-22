/** Iconos propios: rejilla de 24, trazo de 1,75, sin relleno salvo marcas puntuales. */
const PATHS = {
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13ZM20 20l-4.6-4.6',
  plus: 'M12 5v14M5 12h14',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  arrowUpRight: 'M7 17 17 7M8 7h9v9',
  check: 'M5 12.5 10 17l9-10',
  x: 'M6 6l12 12M18 6 6 18',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  download: 'M12 4v11M7 10l5 5 5-5M5 20h14',
  upload: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  star: 'M12 3.8l2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8Z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z',
  terminal: 'M4 5h16v14H4zM8 10l2.5 2L8 14M13 15h3',
  window: 'M3.5 5h17v14h-17zM3.5 9h17M6.5 7h.01M9 7h.01',
  bolt: 'M13 3 5 13.5h6L10 21l8-10.5h-6Z',
  book: 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5v-15ZM5 19.5A1.5 1.5 0 0 0 6.5 21H19M9 7h6',
  bag: 'M5 8h14l-1 12H6L5 8ZM9 8V6.5a3 3 0 0 1 6 0V8',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  route: 'M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM8 17h7.5a3.5 3.5 0 0 0 0-7h-7a3.5 3.5 0 0 1 0-7H16',
  landmark: 'M3 21h18M5 18V10M10 18v-8M14 18v-8M19 18v-8M3 10h18L12 4 3 10Z',
  ticket: 'M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7ZM14 7v10',
  briefcase: 'M4 8h16v11H4zM9 8V5h6v3M4 13h16',
  flask: 'M9 3h6M10 3v6L4.5 19A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3M7 15h10',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  eye: 'M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7S2.5 12 2.5 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  eyeOff: 'M3 3l18 18M10.6 5.1A9.6 9.6 0 0 1 12 5c6 0 9.5 7 9.5 7a16 16 0 0 1-2.7 3.6M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 19 12 19a9 9 0 0 0 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5',
  alert: 'M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.5h.01',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  duplicate: 'M8 8h12v12H8zM4 16V4h12',
  logout: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  shield: 'M12 3l7 3v5c0 5-3.2 8.4-7 10-3.8-1.6-7-5-7-10V6l7-3ZM8.5 12l2.5 2.5 4.5-5',
  activity: 'M3 12h4l3-7 4 14 3-7h4',
  filter: 'M4 5h16l-6 8v6l-4-2v-4L4 5Z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  pause: 'M8 5v14M16 5v14',
  play: 'M7 4.5v15l12-7.5-12-7.5Z',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM15.5 8.5l-2 5-5 2 2-5 5-2Z',
  inbox: 'M3 13h5l1.5 3h5L16 13h5M5 5h14l2 8v6H3v-6l2-8Z',
  git: 'M6 3v12M6 21a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM18 9a9 9 0 0 1-9 9',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps {
  name: IconName;
  size?: number;
  className?: string;
  filled?: boolean;
  title?: string;
}

export function Icon({ name, size = 18, className, filled, title }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title && <title>{title}</title>}
      <path d={PATHS[name]} />
    </svg>
  );
}
