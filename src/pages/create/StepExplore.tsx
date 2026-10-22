import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { KindTag } from '../../components/primitives';
import { cx } from '../../lib/format';
import type { Phase, TraceEvent } from '../../lib/simulate';

const PHASES: { id: Phase; label: string; sub: string }[] = [
  { id: 'explore', label: 'Explorador', sub: 'observar · decidir · actuar' },
  { id: 'synth', label: 'Sintetizador', sub: 'traza → manifest.json' },
  { id: 'validate', label: 'Validador', sub: 'ejecutar cada herramienta' },
];

const DELAY: Record<TraceEvent['type'], number> = {
  info: 520,
  obs: 130,
  act: 620,
  req: 380,
  tool: 260,
  pass: 300,
  fail: 420,
};

export function StepExplore({
  host,
  trace,
  onDone,
  onCancel,
}: {
  host: string;
  trace: TraceEvent[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [cursor, setCursor] = useState(0);
  const [paused, setPaused] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);
  const done = cursor >= trace.length;

  useEffect(() => {
    if (done || paused) return;
    const id = window.setTimeout(() => setCursor((c) => c + 1), DELAY[trace[cursor].type]);
    return () => window.clearTimeout(id);
  }, [cursor, done, paused, trace]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cursor]);

  const seen = trace.slice(0, cursor);
  const current = seen[seen.length - 1];
  const phase: Phase = current?.phase ?? 'explore';
  const phaseIndex = PHASES.findIndex((p) => p.id === phase);

  const counts = useMemo(
    () => ({
      acts: seen.filter((e) => e.type === 'act').length,
      reqs: seen.filter((e) => e.type === 'req').length,
      proposed: seen.filter((e) => e.type === 'tool').length,
      passed: seen.filter((e) => e.type === 'pass').length,
      failed: seen.filter((e) => e.type === 'fail').length,
    }),
    [seen],
  );

  const phaseProgress = (p: Phase) => {
    const all = trace.filter((e) => e.phase === p).length;
    const got = seen.filter((e) => e.phase === p).length;
    return all ? got / all : 0;
  };

  // Lo que "ve" el navegador: la última página y su observación compacta
  const lastPath = [...seen].reverse().find((e) => e.path)?.path ?? '/';
  const observation = seen.filter((e) => e.type === 'obs' && e.path === lastPath).map((e) => e.text);
  const lastAct = [...seen].reverse().find((e) => e.type === 'act');
  const activeId = lastAct?.text.match(/\[(\d+)\]/)?.[1];
  const tools = trace.filter((e) => e.type === 'tool');
  const verdict = (name: string) => seen.find((e) => (e.type === 'pass' || e.type === 'fail') && e.text === name);

  return (
    <div className="step-explore">
      <div className="step-explore__top">
        <div>
          <p className="eyebrow eyebrow--index" data-index="02">
            Generación en curso
          </p>
          <h1 className="step-explore__title">
            {done ? (
              <>
                Listo: <span className="mono">{counts.passed}</span> de {counts.proposed} herramientas funcionan
              </>
            ) : (
              <>
                Explorando <span className="mono">{host}</span>
              </>
            )}
          </h1>
        </div>
        <div className="step-explore__controls">
          {!done && (
            <>
              <button className="btn btn--ghost btn--sm" onClick={() => setPaused((p) => !p)}>
                <Icon name={paused ? 'play' : 'pause'} size={14} /> {paused ? 'Reanudar' : 'Pausar'}
              </button>
              <button className="btn btn--outline btn--sm" onClick={() => setCursor(trace.length)}>
                Saltar al resultado
              </button>
            </>
          )}
          <button className="btn btn--ghost btn--sm" onClick={onCancel}>
            {done ? 'Descartar' : 'Cancelar'}
          </button>
        </div>
      </div>

      <ol className="phases">
        {PHASES.map((p, i) => {
          const prog = done ? 1 : phaseProgress(p.id);
          const state = done || i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : 'todo';
          return (
            <li key={p.id} className={cx('phase', `is-${state}`)}>
              <div className="phase__bar">
                <span style={{ transform: `scaleX(${prog})` }} />
              </div>
              <div className="phase__label">
                <span className="phase__icon">
                  {state === 'done' ? <Icon name="check" size={12} /> : state === 'active' ? <span className="dot dot--live" /> : i + 1}
                </span>
                <strong>{p.label}</strong>
                <span className="phase__sub mono">{p.sub}</span>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="step-explore__grid">
        <div className="browser" aria-label="Navegador del explorador">
          <div className="browser__bar">
            <span className="browser__dots" aria-hidden>
              <i />
              <i />
              <i />
            </span>
            <span className="browser__url mono">
              <Icon name="globe" size={12} />
              {host}
              <span className="browser__path">{lastPath}</span>
            </span>
            <span className="browser__badge mono">{phase === 'explore' && !done ? 'agente' : 'cerrado'}</span>
          </div>
          <div className="browser__body">
            <div className="eyebrow">Observación compacta</div>
            <ul className="obs mono">
              {observation.map((o) => {
                const id = o.match(/\[(\d+)\]/)?.[1];
                return (
                  <li key={o} className={cx(id && id === activeId && phase === 'explore' && 'is-active')}>
                    {o}
                  </li>
                );
              })}
              {!observation.length && <li className="obs__empty">Cargando página…</li>}
            </ul>
            {lastAct && (
              <div className="browser__act mono">
                <span>acción</span> {lastAct.text}
              </div>
            )}
          </div>
        </div>

        <div className="log">
          <dl className="log__counters">
            <div>
              <dt>Acciones</dt>
              <dd>{counts.acts}</dd>
            </div>
            <div>
              <dt>Peticiones</dt>
              <dd>{counts.reqs}</dd>
            </div>
            <div>
              <dt>Propuestas</dt>
              <dd>{counts.proposed}</dd>
            </div>
            <div>
              <dt>Validadas</dt>
              <dd className={cx(counts.passed > 0 && 'is-ok')}>{counts.passed}</dd>
            </div>
          </dl>
          <ol className="log__feed mono" ref={logRef} aria-live="polite">
            {seen
              .filter((e) => e.type !== 'obs')
              .map((e, i) => (
                <li key={i} className={`log__line log__line--${e.type}`}>
                  <span className="log__glyph">
                    {{ info: '·', act: '›', req: '⇄', tool: '+', pass: '✓', fail: '✕', obs: '' }[e.type]}
                  </span>
                  <span className="log__text">{e.text}</span>
                  {e.meta && <span className="log__meta">{e.meta}</span>}
                </li>
              ))}
            {!done && !paused && (
              <li className="log__line log__line--cursor">
                <span className="log__glyph" />
                <span className="log__caret" />
              </li>
            )}
          </ol>
        </div>
      </div>

      <div className="step-explore__tools">
        <div className="eyebrow">Herramientas</div>
        <ul>
          {tools.map((t) => {
            const appeared = seen.includes(t);
            const v = verdict(t.text);
            return (
              <li key={t.text} className={cx(appeared && 'is-in', v?.type === 'fail' && 'is-failed')}>
                <KindTag kind={t.meta === 'browser' ? 'browser' : 'http'} />
                <code>{t.text}</code>
                <span className="step-explore__verdict">
                  {v ? (
                    v.type === 'pass' ? (
                      <span className="tag tag--ok">
                        <Icon name="check" size={11} /> validada
                      </span>
                    ) : (
                      <span className="tag tag--danger" title={v.meta}>
                        <Icon name="x" size={11} /> falló
                      </span>
                    )
                  ) : appeared ? (
                    <span className="tag">pendiente</span>
                  ) : null}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {done && (
        <div className="step-footer">
          <span className="step-footer__note">
            {counts.failed > 0
              ? `${counts.failed} ${counts.failed === 1 ? 'herramienta no pasó' : 'herramientas no pasaron'} la validación y no se publicarán.`
              : 'Todas las herramientas pasaron la validación.'}
          </span>
          <button className="btn btn--primary btn--lg" onClick={onDone} autoFocus>
            Revisar el MCP <Icon name="arrowRight" size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
