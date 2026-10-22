'use client';

import { Icon } from '../../components/Icon';
import { CATEGORIES } from '../../data/categories';
import type { CategoryId, Mcp, Visibility } from '../../data/types';
import { cx } from '../../lib/format';

const LICENSES = ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'Sin licencia'];

export function StepPublish({
  draft,
  onChange,
  includedCount,
  permission,
  onPermissionChange,
}: {
  draft: Mcp;
  onChange: (patch: Partial<Mcp>) => void;
  includedCount: number;
  permission: boolean;
  onPermissionChange: (value: boolean) => void;
}) {
  const versionOk = /^\d+\.\d+\.\d+$/.test(draft.version);
  const hasBrowser = draft.tools.some((t) => t.validated && t.kind === 'browser');

  const checks = [
    { ok: true, text: `Nombre: ${draft.slug}` },
    { ok: true, text: `${includedCount} ${includedCount === 1 ? 'herramienta validada' : 'herramientas validadas'}` },
    { ok: true, text: 'Sin login, captchas ni pagos reales' },
    { ok: versionOk, text: versionOk ? `Versión ${draft.version}` : 'Versión con formato x.y.z' },
    { ok: draft.category !== undefined, text: 'Categoría elegida' },
    { ok: permission, text: 'Permiso para automatizar la web confirmado' },
  ];

  return (
    <div className="step-publish">
      <div>
        <p className="eyebrow eyebrow--index" data-index="04">
          Publicación
        </p>
        <h1 className="step-title">¿Cómo quieres compartirlo?</h1>
        <p className="step-lede">
          Si aún no está listo, guárdalo como borrador: se queda en este navegador y podrás retomarlo desde la biblioteca.
        </p>
      </div>

      <div className="step-publish__grid">
        <div className="step-publish__form">
          <fieldset className="form-section">
            <legend className="form-section__title">Visibilidad</legend>
            <div className="radio-cards radio-cards--three">
              {(
                [
                  ['public', 'globe', 'Público', 'Aparece en el catálogo y en las búsquedas de MCPortal.'],
                  ['unlisted', 'link', 'No listado', 'Solo quien tenga el enlace puede verlo e instalarlo.'],
                  ['private', 'eyeOff', 'Privado', 'Solo tú puedes verlo. No se comparte ni se instala.'],
                ] as [Visibility, 'globe' | 'link' | 'eyeOff', string, string][]
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
            <h2 className="form-section__title">Clasificación</h2>
            <div className="form-grid">
              <div className="field">
                <label className="field__label" htmlFor="category">
                  Categoría
                </label>
                <select
                  id="category"
                  className="select"
                  value={draft.category}
                  onChange={(e) => onChange({ category: e.target.value as CategoryId })}
                >
                  {CATEGORIES.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="license">
                  Licencia del manifiesto
                </label>
                <select id="license" className="select" value={draft.license} onChange={(e) => onChange({ license: e.target.value })}>
                  {LICENSES.map((license) => (
                    <option key={license}>{license}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="publish-tags">
                Etiquetas <span className="field__hint">separadas por comas · máximo 6</span>
              </label>
              <input
                id="publish-tags"
                className="input"
                value={draft.tags.join(', ')}
                onChange={(e) =>
                  onChange({
                    tags: e.target.value
                      .split(',')
                      .map((tag) => tag.trim().toLowerCase())
                      .filter(Boolean)
                      .slice(0, 6),
                  })
                }
                placeholder="libros, carrito, demo"
              />
            </div>
          </div>

          <div className="form-section">
            <h2 className="form-section__title">Firma y versión</h2>
            <div className="form-grid">
              <div className="field">
                <label className="field__label" htmlFor="version">
                  Versión
                </label>
                <input
                  id="version"
                  className={cx('input input--mono', !versionOk && 'is-invalid')}
                  value={draft.version}
                  onChange={(e) => onChange({ version: e.target.value.trim() })}
                />
                <span className="field__hint">Semver. Súbela cada vez que regeneres.</span>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="author">
                  Autor
                </label>
                <input
                  id="author"
                  className="input"
                  value={draft.author}
                  readOnly
                  aria-readonly="true"
                />
                <span className="field__hint mono">@{draft.authorHandle}</span>
              </div>
            </div>
          </div>

          {hasBrowser && (
            <div className="notice">
              <Icon name="window" size={16} />
              <p>
                Incluye herramientas de navegador: quien lo instale necesitará Chromium (el runtime lo descarga la
                primera vez).
              </p>
            </div>
          )}

          <label className={cx('check step-publish__permission', !permission && 'is-required')}>
            <input type="checkbox" checked={permission} onChange={(e) => onPermissionChange(e.target.checked)} />
            <span>
              Confirmo que tengo permiso para automatizar esta web y publicar estas herramientas. En webs de terceros,
              solo se publican MCPs de solo lectura.
            </span>
          </label>
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
          <p className="field__hint">
            Al publicar aceptas que el MCP lo usen otras personas. Si la web cambia, el validador lo marcará y te
            avisaremos.
          </p>
        </aside>
      </div>
    </div>
  );
}

export function canPublish(draft: Mcp, permission: boolean): boolean {
  return permission && /^\d+\.\d+\.\d+$/.test(draft.version);
}
