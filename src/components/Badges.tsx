import type { Mcp } from '../data/types';
import { badgesFor, type McpBadge } from '../lib/catalog';
import { cx } from '../lib/format';
import { Icon, type IconName } from './Icon';

const TONE_CLASS: Record<McpBadge['tone'], string> = {
  ink: 'tag tag--ink',
  ok: 'tag tag--ok',
  warn: 'tag tag--warn',
  danger: 'tag tag--danger',
  outline: 'tag tag--outline',
};

const BADGE_ICON: Record<McpBadge['id'], IconName> = {
  recommended: 'shield',
  newest: 'clock',
  best: 'star',
  outdated: 'alert',
  reports: 'alert',
};

/** Etiquetas de clasificación calculadas contra el resto de MCPs de la misma web. */
export function McpBadges({
  mcp,
  variants,
  max,
  className,
}: {
  mcp: Mcp;
  variants: Mcp[];
  max?: number;
  className?: string;
}) {
  const badges = badgesFor(mcp, variants);
  const visible = max ? badges.slice(0, max) : badges;
  if (!visible.length) return null;
  return (
    <span className={cx('mcp-badges', className)}>
      {visible.map((badge) => (
        <span key={badge.id} className={cx(TONE_CLASS[badge.tone], 'tag--badge')}>
          <Icon name={BADGE_ICON[badge.id]} size={10} filled={badge.id === 'best'} />
          {badge.label}
        </span>
      ))}
    </span>
  );
}
