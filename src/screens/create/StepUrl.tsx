'use client';

import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { normalizeUrl } from '../../lib/simulate';
import { cx } from '../../lib/format';

const EXAMPLES = ['shop.mcportal.dev', 'reservas.latascalavapies.es', 'librosviejos.es', 'agenda.teatrocirco.es'];

export interface UrlInput {
  url: URL;
  hint: string;
}

export function StepUrl({ initialUrl, onStart }: { initialUrl: string; onStart: (input: UrlInput) => void }) {
  const [value, setValue] = useState(initialUrl);
  const [hint, setHint] = useState('');
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
    onStart({ url: res.url, hint });
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
