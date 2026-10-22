'use client';

import { useState } from 'react';
import { CodeBlock } from '../../components/Code';
import { Icon } from '../../components/Icon';
import { McpCard } from '../../components/McpCard';
import { KindTag, Switch } from '../../components/primitives';
import { CATEGORIES } from '../../data/categories';
import type { CategoryId, Mcp, Tool } from '../../data/types';
import { cx, toManifest } from '../../lib/format';

export interface ReviewErrors {
  slug?: string;
  description?: string;
  tools?: string;
  toolNames?: Record<string, string>;
}

export function reviewErrors(draft: Mcp, included: Tool[], slugTaken: boolean): ReviewErrors {
  const e: ReviewErrors = {};
  if (!draft.slug) e.slug = 'El nombre es obligatorio.';
  else if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(draft.slug)) e.slug = 'Solo minúsculas, números y guiones (2–40).';
  else if (slugTaken) e.slug = `«${draft.slug}» ya existe en MCPortal. Elige otro nombre.`;
  if (draft.description.trim().length < 20) e.description = 'Describe en al menos 20 caracteres qué permite hacer.';
  if (!included.length) e.tools = 'Incluye al menos una herramienta validada.';
  const names: Record<string, string> = {};
  const seen = new Set<string>();
  draft.tools.forEach((t, i) => {
    if (!/^[a-z][a-z0-9_]{1,47}$/.test(t.name)) names[i] = 'snake_case, empezando por letra.';
    else if (seen.has(t.name)) names[i] = 'Nombre repetido.';
    seen.add(t.name);
  });
  if (Object.keys(names).length) e.toolNames = names;
  return e;
}

export function StepReview({
  draft,
  onChange,
  excluded,
  onToggleTool,
  errors,
  showErrors,
}: {
  draft: Mcp;
  onChange: (patch: Partial<Mcp>) => void;
  excluded: Set<number>;
  onToggleTool: (index: number) => void;
  errors: ReviewErrors;
  showErrors: boolean;
}) {
  const [tagInput, setTagInput] = useState('');
  const [view, setView] = useState<'row' | 'manifest'>('row');
  const preview: Mcp = {
    ...draft,
    tools: draft.tools.filter((_, i) => !excluded.has(i)),
    status: 'published',
  };
  const err = (k: keyof ReviewErrors) => (showErrors ? (errors[k] as string | undefined) : undefined);

  const updateTool = (index: number, patch: Partial<Tool>) =>
    onChange({ tools: draft.tools.map((t, i) => (i === index ? { ...t, ...patch } : t)) });

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !draft.tags.includes(t) && draft.tags.length < 6) onChange({ tags: [...draft.tags, t] });
    setTagInput('');
  };

  const includedCount = preview.tools.filter((t) => t.validated).length;

  return (
    <div className="step-review">
      <div className="step-review__form">
        <div>
          <p className="eyebrow eyebrow--index" data-index="03">
            Revisión
          </p>
          <h1 className="step-title">Revisa lo que ha encontrado el agente</h1>
          <p className="step-lede">
            Los nombres y descripciones son lo que leerá el cliente MCP para decidir qué herramienta usar. Ajústalos si
            hace falta.
          </p>
        </div>

        <section className="form-section">
          <h2 className="form-section__title">Identidad</h2>
          <div className="form-grid">
            <div className="field">
              <label className="field__label" htmlFor="slug">
                Nombre del MCP
              </label>
              <input
                id="slug"
                className={cx('input input--mono', err('slug') && 'is-invalid')}
                value={draft.slug}
                onChange={(e) => onChange({ slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                aria-invalid={Boolean(err('slug'))}
              />
              {err('slug') ? (
                <span className="field__error">
                  <Icon name="alert" size={13} /> {err('slug')}
                </span>
              ) : (
                <span className="field__hint mono">mcp__{draft.slug || '…'}__herramienta</span>
              )}
            </div>
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
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="desc">
              Descripción
              <span className={cx('field__hint mono', draft.description.length > 160 && 'is-over')}>
                {draft.description.length}/160
              </span>
            </label>
            <textarea
              id="desc"
              className={cx('textarea', err('description') && 'is-invalid')}
              rows={2}
              maxLength={200}
              value={draft.description}
              onChange={(e) => onChange({ description: e.target.value })}
            />
            {err('description') && (
              <span className="field__error">
                <Icon name="alert" size={13} /> {err('description')}
              </span>
            )}
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tags">
              Etiquetas <span className="field__hint">hasta 6 · Intro para añadir</span>
            </label>
            <div className="tags-input">
              {draft.tags.map((t) => (
                <span key={t} className="tags-input__tag">
                  {t}
                  <button type="button" onClick={() => onChange({ tags: draft.tags.filter((x) => x !== t) })} aria-label={`Quitar ${t}`}>
                    <Icon name="x" size={12} />
                  </button>
                </span>
              ))}
              <input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    addTag();
                  } else if (e.key === 'Backspace' && !tagInput && draft.tags.length) {
                    onChange({ tags: draft.tags.slice(0, -1) });
                  }
                }}
                onBlur={addTag}
                placeholder={draft.tags.length < 6 ? 'añadir…' : ''}
                disabled={draft.tags.length >= 6}
              />
            </div>
          </div>
        </section>

        <section className="form-section">
          <h2 className="form-section__title">
            Herramientas
            <span className="mono">
              {includedCount} incluidas · {draft.tools.filter((t) => !t.validated).length} descartadas
            </span>
          </h2>
          {err('tools') && (
            <p className="field__error">
              <Icon name="alert" size={13} /> {err('tools')}
            </p>
          )}
          <ul className="edit-tools">
            {draft.tools.map((t, i) => {
              const on = t.validated && !excluded.has(i);
              const nameErr = showErrors ? errors.toolNames?.[i] : undefined;
              return (
                <li key={i} className={cx('edit-tool', !on && 'is-off', !t.validated && 'is-failed')}>
                  <div className="edit-tool__head">
                    <Switch
                      on={on}
                      onChange={() => onToggleTool(i)}
                      disabled={!t.validated}
                      label={on ? `Excluir ${t.name}` : `Incluir ${t.name}`}
                    />
                    <input
                      className={cx('edit-tool__name mono', nameErr && 'is-invalid')}
                      value={t.name}
                      onChange={(e) => updateTool(i, { name: e.target.value.replace(/\s+/g, '_') })}
                      aria-label="Nombre de la herramienta"
                      disabled={!t.validated}
                    />
                    <KindTag kind={t.kind} />
                    {t.validated ? (
                      <span className="tag tag--ok" title="Respondió correctamente con entradas de ejemplo">
                        <Icon name="check" size={11} /> validada
                      </span>
                    ) : (
                      <span className="tag tag--danger">
                        <Icon name="x" size={11} /> falló
                      </span>
                    )}
                  </div>
                  {nameErr && <span className="field__error edit-tool__err">{nameErr}</span>}
                  {t.validated ? (
                    <input
                      className="edit-tool__desc"
                      value={t.description}
                      onChange={(e) => updateTool(i, { description: e.target.value })}
                      aria-label={`Descripción de ${t.name}`}
                    />
                  ) : (
                    <p className="edit-tool__failure">
                      <Icon name="alert" size={13} /> {t.failure ?? 'No respondió como se esperaba'}. No se publicará.
                    </p>
                  )}
                  <div className="edit-tool__params mono">
                    {t.params.length ? (
                      t.params.map((p) => (
                        <span key={p.name}>
                          {p.name}
                          {!p.required && '?'}
                          <em>: {p.type}</em>
                        </span>
                      ))
                    ) : (
                      <span className="edit-tool__noparams">sin parámetros</span>
                    )}
                    {t.dependsOn && (
                      <span className="edit-tool__dep">
                        <Icon name="link" size={11} /> {t.dependsOn}
                      </span>
                    )}
                    <span className="edit-tool__impl">
                      {t.kind === 'http' ? `${t.method} ${t.endpoint}` : `${t.steps?.length ?? 0} pasos de navegador`}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <aside className="step-review__preview">
        <div className="preview-head">
          <span className="eyebrow">Vista previa</span>
          <div className="segmented">
            <button className={cx(view === 'row' && 'is-active')} onClick={() => setView('row')}>
              Catálogo
            </button>
            <button className={cx(view === 'manifest' && 'is-active')} onClick={() => setView('manifest')}>
              manifest.json
            </button>
          </div>
        </div>
        {view === 'row' ? (
          <div className="preview-frame" aria-hidden>
            <McpCard mcp={preview} static />
          </div>
        ) : (
          <CodeBlock code={toManifest(preview)} title="manifest.json" maxHeight={520} lineNumbers />
        )}
        <p className="field__hint">Así lo verán otros en el catálogo y así lo leerá el runtime.</p>
      </aside>
    </div>
  );
}
