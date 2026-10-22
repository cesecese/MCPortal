'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../components/Icon';
import { KindTag, SiteIcon } from '../../components/primitives';
import { cx } from '../../lib/format';
import { EVENT_DELAY } from '../../services/generation';
import type { GenerationJob } from '../../data/types';
import type { PipelineEvent } from '../../types/contract';

type Phase = 'explore' | 'synth' | 'validate';

const PHASES: { id: Phase; label: string; sub: string }[] = [
  { id: 'explore', label: 'Explorador', sub: 'observar · decidir · actuar' },
  { id: 'synth', label: 'Sintetizador', sub: 'traza → manifest.json' },
  { id: 'validate', label: 'Validador', sub: 'ejecutar cada herramienta' },
];

const PHASE_OF: Record<PipelineEvent['type'], Phase> = {
  run_started: 'explore',
  explore_started: 'explore',
  mode: 'explore',
  warning: 'explore',
  thought: 'explore',
  step: 'explore',
  request: 'explore',
  blocked: 'explore',
  finish: 'explore',
  candidate: 'explore',
  explore_done: 'explore',
  tool_proposed: 'synth',
  candidate_discarded: 'synth',
  synth_done: 'synth',
  validate_retry: 'validate',
  validated: 'validate',
  validate_done: 'validate',
  done: 'validate',
};

const TONE: Partial<Record<PipelineEvent['type'], string>> = {
  thought: 'info',
  step: 'act',
  request: 'req',
  blocked: 'fail',
  tool_proposed: 'tool',
  candidate_discarded: 'fail',
  validate_retry: 'fail',
  warning: 'fail',
};

function describe(event: PipelineEvent): { text: string; meta?: string } {
  switch (event.type) {
    case 'run_started':
      return { text: `Ejecución iniciada · ${event.url}`, meta: event.cached ? 'caché' : 'en vivo' };
    case 'explore_started':
      return { text: `Explorando con política ${event.policy}`, meta: `máx ${event.max_steps} pasos` };
    case 'mode':
      return { text: event.read_only ? 'Modo solo lectura activo' : 'Modo lectura y escritura', meta: event.site };
    case 'warning':
      return { text: event.text };
    case 'thought':
      return { text: event.text };
    case 'step':
      return { text: `${event.i + 1}. ${event.action}`, meta: new URL(event.url).pathname };
    case 'request': {
      const path = (() => {
        try {
          return new URL(event.url).pathname;
        } catch {
          return event.url;
        }
      })();
      return { text: `${event.method} ${path}`, meta: `${event.status} · ${event.kind}` };
    }
    case 'blocked':
      return { text: `BLOQUEADO ${event.method} ${event.url}`, meta: 'solo lectura' };
    case 'finish':
      return { text: event.summary };
    case 'candidate':
      return {
        text: `Candidato ${event.id}: ${event.method} ${event.url}`,
        meta: [event.browser ? 'navegador' : 'http', ...(event.csrf.length ? ['csrf'] : [])].join(' · '),
      };
    case 'explore_done':
      return {
        text: `Exploración cerrada: ${event.steps} pasos, ${event.requests} peticiones`,
        meta: `${event.candidates} candidatos · ${event.dependencies} dependencias`,
      };
    case 'tool_proposed':
      return { text: event.name, meta: event.kind };
    case 'candidate_discarded':
      return { text: `Descartado ${event.candidate_id}`, meta: event.reason };
    case 'synth_done':
      return { text: `Síntesis terminada (${event.mode})`, meta: `${event.proposed} propuestas · ${event.discarded} descartadas` };
    case 'validate_retry':
      return { text: `${event.name}: ${event.reason}`, meta: `reintento en ${event.kind}` };
    case 'validated':
      return { text: event.name, meta: event.ok ? (event.swapped ? 'ok · cambiada a navegador' : '2xx') : (event.reason ?? 'falló') };
    case 'validate_done':
      return { text: `Validación terminada: ${event.validated}/${event.proposed}`, meta: 'solo se sirve lo validado' };
    case 'done':
      return { text: `Listo → ${event.manifest}`, meta: `${event.validated} herramientas` };
  }
}

export function StepExplore({
  host,
  icon,
  job,
  complete = true,
  onDone,
  onCancel,
}: {
  host: string;
  icon?: string;
  job: GenerationJob;
  complete?: boolean;
  onDone: () => void;
  onCancel: () => void;
}) {
  const events = job.events;
  const [cursor, setCursor] = useState(0);
  const [paused, setPaused] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);
  const done = cursor >= events.length;
  const finished = done && complete;

  useEffect(() => {
    setCursor(0);
    setPaused(false);
  }, [job.id]);

  useEffect(() => {
    if (done || paused) return;
    const id = window.setTimeout(() => setCursor((c) => c + 1), EVENT_DELAY[events[cursor].type] ?? 300);
    return () => window.clearTimeout(id);
  }, [cursor, done, paused, events]);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cursor]);

  const seen = useMemo(() => events.slice(0, cursor), [events, cursor]);
  const current = seen[seen.length - 1];
  const phase: Phase = current ? PHASE_OF[current.type] : 'explore';
  const phaseIndex = PHASES.findIndex((p) => p.id === phase);

  const counts = useMemo(
    () => ({
      acts: seen.filter((e) => e.type === 'step').length,
      reqs: seen.filter((e) => e.type === 'request').length,
      proposed: seen.filter((e) => e.type === 'tool_proposed').length,
      passed: seen.filter((e) => e.type === 'validated' && e.ok).length,
      failed: seen.filter((e) => e.type === 'validated' && !e.ok).length,
    }),
    [seen],
  );

  const phaseProgress = (p: Phase) => {
    const all = events.filter((e) => PHASE_OF[e.type] === p).length;
    const got = seen.filter((e) => PHASE_OF[e.type] === p).length;
    return all ? got / all : 0;
  };

  // Lo que «ve» el navegador simulado: última página y su observación compacta
  const lastStep = [...seen].reverse().find((e): e is Extract<PipelineEvent, { type: 'step' }> => e.type === 'step');
  const frame =
    job.scene.find((f) => f.step === lastStep?.i) ?? job.scene[job.scene.length - 1] ?? { step: 0, path: '/', observation: [] };
  const activeId = lastStep?.action.match(/\[(\d+)\]/)?.[1];
  const tools = events.filter((e): e is Extract<PipelineEvent, { type: 'tool_proposed' }> => e.type === 'tool_proposed');
  const verdict = (name: string) =>
    seen.find((e): e is Extract<PipelineEvent, { type: 'validated' }> => e.type === 'validated' && e.name === name);

  return (
    <div className="step-explore">
      <div className="step-explore__top">
        <div>
          <h1 className="step-explore__title">
            {finished ? (
              <>
                Listo: <span className="mono">{counts.passed}</span> de {counts.proposed} herramientas funcionan
              </>
            ) : done ? (
              <>Esperando al core…</>
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
              <button className="btn btn--outline btn--sm" onClick={() => setCursor(events.length)}>
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
          const prog = finished ? 1 : phaseProgress(p.id);
          const state = finished || i < phaseIndex ? 'done' : i === phaseIndex ? 'active' : 'todo';
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
              <SiteIcon mcp={{ name: host, icon }} size={14} />
              {host}
              <span className="browser__path">{frame.path}</span>
            </span>
            <span className="browser__badge mono">{phase === 'explore' && !finished ? 'agente' : 'cerrado'}</span>
          </div>
          <div className="browser__body">
            <div className="eyebrow">Observación compacta</div>
            <ul className="obs mono">
              {frame.observation.map((o) => {
                const id = o.match(/\[(\d+)\]/)?.[1];
                return (
                  <li key={o} className={cx(id && id === activeId && phase === 'explore' && 'is-active')}>
                    {o}
                  </li>
                );
              })}
              {!frame.observation.length && <li className="obs__empty">Cargando página…</li>}
            </ul>
            {lastStep && (
              <div className="browser__act mono">
                <span>acción</span> {lastStep.action}
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
            {seen.map((event, i) => {
              const { text, meta } = describe(event);
              const tone = event.type === 'validated' ? (event.ok ? 'pass' : 'fail') : (TONE[event.type] ?? 'info');
              return (
                <li key={i} className={`log__line log__line--${tone}`}>
                  <span className="log__glyph">{{ pass: '✓', fail: '✕', tool: '+', act: '›', req: '⇄', info: '·' }[tone]}</span>
                  <span className="log__text">{text}</span>
                  {meta && <span className="log__meta">{meta}</span>}
                </li>
              );
            })}
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
          {tools.map((tool) => {
            const appeared = seen.includes(tool);
            const v = verdict(tool.name);
            return (
              <li key={tool.name} className={cx(appeared && 'is-in', v && !v.ok && 'is-failed')}>
                <KindTag kind={tool.kind} />
                <code>{tool.name}</code>
                <span className="step-explore__verdict">
                  {v ? (
                    v.ok ? (
                      <span className="tag tag--ok">
                        <Icon name="check" size={11} /> validada
                      </span>
                    ) : (
                      <span className="tag tag--danger" title={v.reason ?? undefined}>
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

      {finished && (
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
