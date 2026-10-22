'use client';

import { useState } from 'react';
import type { Mcp } from '../data/types';
import { ratingOf } from '../lib/catalog';
import { cx, formatNumber } from '../lib/format';
import { Icon } from './Icon';

/** Estrellas de 1 a 5. Interactivas cuando se pasa onChange. */
export function RatingStars({
  value,
  onChange,
  size = 17,
  label = 'Valoración',
}: {
  value: number;
  onChange?: (score: number) => void;
  size?: number;
  label?: string;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  if (!onChange) {
    return (
      <span className="stars stars--static" role="img" aria-label={`${value} de 5 estrellas`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Icon key={star} name="star" size={size} filled={star <= Math.round(value)} className={star <= Math.round(value) ? 'is-on' : ''} />
        ))}
      </span>
    );
  }

  return (
    <span className="stars" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} ${star === 1 ? 'estrella' : 'estrellas'}`}
          className={cx('stars__button', star <= active && 'is-on')}
          onMouseEnter={() => setHover(star)}
          onFocus={() => setHover(star)}
          onBlur={() => setHover(0)}
          onClick={() => onChange(star)}
        >
          <Icon name="star" size={size} filled={star <= active} />
        </button>
      ))}
    </span>
  );
}

/** Resumen de valoración y acción para votar desde la ficha del MCP. */
export function RatingPanel({ mcp, onRate }: { mcp: Mcp; onRate: (score: number) => void }) {
  const rating = ratingOf(mcp);
  const myRating = mcp.myRating;

  return (
    <section className="health-card rating-panel" aria-labelledby="rating-title">
      <div className="health-card__head">
        <h2 id="rating-title">Valoración</h2>
        <span className="section-head__meta">{formatNumber(rating.count)} votos</span>
      </div>
      <div className="rating-panel__body">
        <div className="rating-panel__score">
          <strong>{rating.average.toFixed(1)}</strong>
          <span>/ 5</span>
          <RatingStars value={rating.average} size={12} />
        </div>
        <div className="rating-panel__action">
          <span className="rating-panel__label">Tu voto</span>
          <RatingStars value={myRating ?? 0} onChange={onRate} label="Valora este MCP" />
          <p>{myRating ? `Has valorado con ${myRating} de 5. Puedes cambiarlo.` : 'Pulsa una estrella para valorarlo.'}</p>
        </div>
      </div>
      <div className="rating-panel__note">
        <Icon name="user" size={13} />
        <span>La media incluye solo valoraciones de usuarios, no instalaciones.</span>
      </div>
    </section>
  );
}
