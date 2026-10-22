/**
 * Wordmark oficial de MCPortal (imagen de marca/mcportal.svg). La «o» es un
 * círculo macizo: el portal. Se pinta con currentColor para servir en claro y
 * en oscuro sin duplicar el archivo.
 */
export function Logo({ height = 18 }: { height?: number }) {
  return (
    <svg
      className="logo"
      viewBox="0 0 8389 1493"
      height={height}
      width={(height * 8389) / 1493}
      role="img"
      aria-label="MCPortal"
    >
      <g fill="currentColor" transform="matrix(1 0 0 -1 -120 1468)">
        <path d="M120 0H389V976H397L787 0H977L1366 976H1375V0H1644V1443H1295L885 406H879L469 1443H120Z" />
        <path d="M2506 -25C2855 -25 3108 194 3136 501L3137 512H2843L2841 502C2802 331 2680 231 2506 231C2275 231 2127 419 2127 723V724C2127 1026 2275 1212 2506 1212C2686 1212 2804 1108 2838 949L2842 932H3136L3135 941C3107 1247 2856 1468 2506 1468C2085 1468 1819 1188 1819 723V722C1819 257 2084 -25 2506 -25Z" />
        <path d="M3303 0H3605V455H3883C4187 455 4390 651 4390 948V950C4390 1247 4187 1443 3883 1443H3303ZM3809 1204C3982 1204 4084 1113 4084 949V947C4084 783 3982 691 3809 691H3605V1204Z" />
        <circle className="logo__portal" cx="5015" cy="536" r="558" />
        <path d="M5676 0H5968V600C5968 756 6052 842 6196 842C6238 842 6278 836 6302 826V1083C6280 1089 6250 1094 6218 1094C6093 1094 6006 1017 5974 885H5968V1072H5676Z" />
        <path d="M6827 -22C6888 -22 6935 -16 6968 -11V203C6950 201 6931 198 6905 198C6817 198 6772 232 6772 332V852H6968V1072H6772V1334H6477V1072H6328V852H6477V300C6477 70 6589 -22 6827 -22Z" />
        <path d="M7428 -17C7569 -17 7683 50 7744 160H7750V0H8042V735C8042 951 7863 1094 7586 1094C7303 1094 7133 952 7117 754L7116 742H7383L7385 751C7399 820 7465 871 7574 871C7688 871 7750 812 7750 717V651L7485 635C7219 618 7068 504 7068 309V307C7068 118 7213 -17 7428 -17ZM7357 322V324C7357 400 7416 448 7529 455L7750 469V392C7750 280 7654 196 7523 196C7422 196 7357 243 7357 322Z" />
        <path d="M8217 0H8509V1443H8217Z" />
      </g>
    </svg>
  );
}

/** Wordmark de Linen (imagen de marca/linen.svg), para el pie. */
export function LinenMark({ height = 11 }: { height?: number }) {
  return (
    <svg viewBox="0 0 1164 302" height={height} width={(height * 1164) / 302} role="img" aria-label="Linen">
      <g fill="currentColor">
        <path d="M0 0H64V252H209V302H0Z" />
        <path d="M244 0H308V302H244Z" />
        <path d="M346 0H429L543 225V0H607V302H524L410 77V302H346Z" />
        <path d="M657 0H849V50H657Z" />
        <path d="M657 126H831V176H657Z" />
        <path d="M657 252H859V302H657Z" />
        <path d="M903 0H986L1100 225V0H1164V302H1081L967 77V302H903Z" />
      </g>
    </svg>
  );
}

/** El portal suelto: el círculo de la «o», como marca mínima. */
export function PortalDot({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-hidden className={className}>
      <circle cx="5" cy="5" r="5" fill="currentColor" />
    </svg>
  );
}
