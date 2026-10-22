'use client';

import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { normalizeUrl } from '../../services/url';
import { cx } from '../../lib/format';
import type { McpMode } from '../../data/types';

const EXAMPLES = ['shop.mcportal.dev', 'reservas.latascalavapies.es', 'librosviejos.es', 'agenda.teatrocirco.es'];

export interface UrlInput {
  url: URL;
  hint: string;
  maxSteps: number;
  mode: McpMode;
}

export function StepUrl({ initialUrl, onStart }: { initialUrl: string; onStart: (input: UrlInput) => void }) {
  const [value, setValue] = useState(initialUrl);
  const [hint, setHint] = useState('');
  const [maxSteps, setMaxSteps] = useState(20);
  const [mode, setMode] = useState<McpMode>('read_only');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    const res = normalizeUrl(value);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    if (!consent) {
      setError(null);
      return;
    }
    onStart({ url: res.url, hint, maxSteps, mode });
  };

  return (
    <form className="step-url" onSubmit={submit} noValidate>
      <div className="step-url__intro">
        <h1>¿Qué web quieres convertir?</h1>
        <p>El agente la explora y registra las acciones que funcionan.</p>
      </div>

      <div className="field">
        <label className="sr-only" htmlFor="url">
          URL
        </label>
        <div className={cx('url-input', error && 'is-invalid')}>
          <span className="url-input__scheme mono">https://</span>
          <input
            id="url"
            className="url-input__field mono"
            value={value.replace(/^https?:\/\//, '')}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder="openlibrary.org"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'url-error' : undefined}
          />
          <button type="submit" className="btn btn--primary url-input__go">
            Explorar <Icon name="arrowRight" size={15} />
          </button>
        </div>
        {error && (
          <p className="field__error" id="url-error">
            <Icon name="alert" size={14} /> {error}
          </p>
        )}
        <div className="step-url__examples">
          <span className="field__hint">Ejemplos</span>
          {EXAMPLES.map((ex) => (
            <button
              type="button"
              key={ex}
              className="chip"
              onClick={() => {
                setValue(ex);
                setError(null);
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="hint">
          Pista <span className="field__hint">opcional</span>
        </label>
        <textarea
          id="hint"
          className="textarea"
          rows={2}
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="Ej.: reservas online; consultar disponibilidad y reservar."
        />
      </div>

      <div className="field">
        <label className="field__label" htmlFor="steps">
          Pasos de exploración <span className="mono">{maxSteps}</span>
        </label>
        <input
          id="steps"
          type="range"
          min={8}
          max={40}
          step={2}
          value={maxSteps}
          onChange={(e) => setMaxSteps(Number(e.target.value))}
          className="range"
        />
        <div className="step-url__limits">
          <span>
            <Icon name="check" size={13} /> Solo el mismo dominio
          </span>
          <span>
            <Icon name="check" size={13} /> URLs normalizadas (/libro/{'{id}'})
          </span>
          <span>
            <Icon name="check" size={13} /> Valores centinela (zxq_…)
          </span>
        </div>
      </div>

      <fieldset className="form-section step-url__mode">
        <legend className="form-section__title">Qué puede hacer el agente</legend>
        <div className="radio-cards">
          {(
            [
              ['read_only', 'eye', 'Solo lectura', 'Busca, filtra y consulta. Cualquier envío que modifique datos se bloquea en la red.'],
              ['read_write', 'edit', 'Lectura y escritura', 'Puede crear, añadir o reservar. Solo en webs propias o demos de práctica.'],
            ] as [McpMode, 'eye' | 'edit', string, string][]
          ).map(([id, icon, title, body]) => (
            <label key={id} className={cx('radio-card', mode === id && 'is-active')}>
              <input type="radio" name="mode" value={id} checked={mode === id} onChange={() => setMode(id)} />
              <Icon name={icon} size={18} />
              <span>
                <strong>{title}</strong>
                <span>{body}</span>
              </span>
            </label>
          ))}
        </div>
        {mode === 'read_write' && (
          <div className="notice">
            <Icon name="alert" size={16} />
            <p>
              Nunca contra webs de terceros. Si el dominio no está en la lista de permitidas, el explorador seguirá en
              solo lectura.
            </p>
          </div>
        )}
      </fieldset>

      <label className={cx('check step-url__consent', touched && !consent && 'is-invalid')}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Confirmo que puedo automatizar esta web: es pública, sin login, captchas ni pagos reales.
          {touched && !consent && <span className="field__error">Necesitamos esta confirmación.</span>}
        </span>
      </label>
    </form>
  );
}
