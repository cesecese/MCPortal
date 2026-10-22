'use client';

import { useState } from 'react';
import { Icon } from '../../components/Icon';
import { normalizeUrl } from '../../lib/simulate';
import { cx } from '../../lib/format';

const EXAMPLES = ['shop.mcportal.dev', 'reservas.latascalavapies.es', 'librosviejos.es', 'agenda.teatrocirco.es'];

export interface UrlInput {
  url: URL;
  hint: string;
  maxSteps: number;
}

export function StepUrl({ initialUrl, onStart }: { initialUrl: string; onStart: (input: UrlInput) => void }) {
  const [value, setValue] = useState(initialUrl);
  const [hint, setHint] = useState('');
  const [maxSteps, setMaxSteps] = useState(20);
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
    onStart({ url: res.url, hint, maxSteps });
  };

  return (
    <form className="step-url" onSubmit={submit} noValidate>
      <div className="step-url__intro">
        <p className="eyebrow eyebrow--index" data-index="01">
          URL de origen
        </p>
        <h1>¿Qué web quieres convertir en herramientas?</h1>
        <p>
          El explorador abrirá la web en un navegador, probará cada formulario y botón una vez y registrará las
          peticiones que generan. No guarda contenido: busca acciones.
        </p>
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
          <button type="submit" className="btn btn--primary btn--lg url-input__go">
            Explorar <Icon name="arrowRight" size={16} />
          </button>
        </div>
        {error && (
          <p className="field__error" id="url-error">
            <Icon name="alert" size={14} /> {error}
          </p>
        )}
        <div className="step-url__examples">
          <span className="field__hint">Prueba con</span>
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

      <div className="step-url__options">
        <div className="field">
          <label className="field__label" htmlFor="hint">
            Pista del dominio <span className="field__hint">opcional</span>
          </label>
          <textarea
            id="hint"
            className="textarea"
            rows={3}
            value={hint}
            onChange={(e) => setHint(e.target.value)}
            placeholder="Ej.: restaurante con reservas online; interesa consultar disponibilidad y reservar."
          />
          <span className="field__hint">Ayuda al agente a priorizar qué acciones probar primero.</span>
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
      </div>

      <label className={cx('check step-url__consent', touched && !consent && 'is-invalid')}>
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>
          Confirmo que puedo automatizar esta web: es pública, no requiere iniciar sesión, no tiene captchas ni
          mueve dinero real, y sus términos lo permiten.
          {touched && !consent && <span className="field__error">Necesitamos esta confirmación para explorar.</span>}
        </span>
      </label>
    </form>
  );
}
