'use client';

import { Icon } from '../../components/Icon';
import type { Mcp, Visibility } from '../../data/types';
import { cx } from '../../lib/format';

const LICENSES = ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'Sin licencia'];

export function StepPublish({
  draft,
  onChange,
  includedCount,
  confirmed,
  onConfirm,
}: {
  draft: Mcp;
  onChange: (patch: Partial<Mcp>) => void;
  includedCount: number;
  confirmed: boolean;
  onConfirm: (value: boolean) => void;
}) {
  const versionOk = /^\d+\.\d+\.\d+$/.test(draft.version);
  const hasBrowser = draft.tools.some((t) => t.validated && t.kind === 'browser');

  const checks = [
    { ok: true, text: `Nombre: ${draft.slug}` },
    { ok: true, text: `Herramientas validadas: ${includedCount}` },
    { ok: true, text: `Web de origen: ${draft.site}` },
    { ok: versionOk, text: versionOk ? `Versión: ${draft.version}` : 'Versión con formato x.y.z' },
  ];

  return (
    <div className="step-publish">
      <div>
        <h1 className="step-title">Decide cómo publicar tu MCP.</h1>
        <p className="step-lede">Elige quién podrá encontrarlo y compartirlo. Puedes guardarlo como borrador y publicarlo más adelante.</p>
      </div>

      <div className="step-publish__grid">
        <div className="step-publish__form">
          <fieldset className="form-section">
            <legend className="form-section__title">Visibilidad</legend>
            <div className="radio-cards">
              {(
                [
                  ['public', 'globe', 'Público', 'Aparece en el catálogo y en los resultados de búsqueda de MCPortal.'],
                  ['unlisted', 'link', 'No listado', 'Solo podrán acceder quienes tengan el enlace directo.'],
                ] as [Visibility, 'globe' | 'link', string, string][]
              ).map(([id, icon, title, body]) => (
                <label key={id} className={cx('radio-card', draft.visibility === id && 'is-active')}>
                  <input
                    type="radio"
                    name="visibility"
                    value={id}
                    checked={draft.visibility === id}
                    onChange={() => onChange({ visibility: id })}
                  />
                  <Icon name={icon} size={18} />
                  <span>
                    <strong>{title}</strong>
                    <span>{body}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="form-section">
            <h2 className="form-section__title">Autor</h2>
            <div className="field">
              <label className="field__label" htmlFor="author">
                Autor o equipo <span className="field__hint">opcional</span>
              </label>
              <input
                id="author"
                className="input"
                value={draft.author}
                maxLength={40}
                onChange={(e) => onChange({ author: e.target.value })}
                placeholder="Tu nombre o el de tu equipo"
              />
              <span className="field__hint">No necesitas una cuenta. El nombre se mostrará tal como lo escribas.</span>
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section__title">Versión y licencia</h2>
            <div className="form-grid">
              <div className="field">
                <label className="field__label" htmlFor="version">
                  Versión inicial
                </label>
                <input
                  id="version"
                  className={cx('input input--mono', !versionOk && 'is-invalid')}
                  value={draft.version}
                  onChange={(e) => onChange({ version: e.target.value.trim() })}
                />
                <span className="field__hint">x.y.z</span>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="license">
                  Licencia
                </label>
                <select id="license" className="select" value={draft.license} onChange={(e) => onChange({ license: e.target.value })}>
                  {LICENSES.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {hasBrowser && (
            <div className="notice">
              <Icon name="window" size={16} />
              <p>
                Incluye herramientas de navegador: el runtime descarga Chromium la primera vez.
              </p>
            </div>
          )}

        </div>

        <aside className="checklist">
          <div className="eyebrow">Antes de publicar</div>
          <ul>
            {checks.map((c) => (
              <li key={c.text} className={cx(c.ok ? 'is-ok' : 'is-bad')}>
                <Icon name={c.ok ? 'check' : 'x'} size={14} />
                {c.text}
              </li>
            ))}
          </ul>
          <label className="check step-publish__confirm">
            <input type="checkbox" checked={confirmed} onChange={(event) => onConfirm(event.target.checked)} />
            <span>He revisado las herramientas y sus permisos antes de publicar.</span>
          </label>
        </aside>
      </div>
    </div>
  );
}

export function canPublish(draft: Mcp): boolean {
  return /^\d+\.\d+\.\d+$/.test(draft.version);
}
