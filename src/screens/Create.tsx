'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CommandLine } from '../components/Code';
import { Icon } from '../components/Icon';
import type { Mcp } from '../data/types';
import { cx, installCommand } from '../lib/format';
import { generate, type TraceEvent } from '../lib/simulate';
import { useStore } from '../store/store';
import { useToast } from '../store/toast';
import { StepExplore } from './create/StepExplore';
import { canPublish, StepPublish } from './create/StepPublish';
import { reviewErrors, StepReview } from './create/StepReview';
import { StepUrl } from './create/StepUrl';
import '../styles/create.css';

type Step = 'url' | 'explore' | 'review' | 'publish' | 'done' | 'saved';

const STEPS: { id: Exclude<Step, 'done'>; label: string }[] = [
  { id: 'url', label: 'URL' },
  { id: 'explore', label: 'Generación' },
  { id: 'review', label: 'Revisión' },
  { id: 'publish', label: 'Publicación' },
];

export function Create() {
  const params = useSearchParams();
  const { byId, mcps, save } = useStore();
  const router = useRouter();
  const notify = useToast();

  const editing = params.get('editar') ? byId(params.get('editar')!) : undefined;
  const [step, setStep] = useState<Step>(editing ? 'review' : 'url');
  const [draft, setDraft] = useState<Mcp | null>(editing ? structuredClone(editing) : null);
  const [trace, setTrace] = useState<TraceEvent[]>([]);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [showErrors, setShowErrors] = useState(false);
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);
  const [publishConfirmed, setPublishConfirmed] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const included = useMemo(
    () => (draft ? draft.tools.filter((t, i) => t.validated && !excluded.has(i)) : []),
    [draft, excluded],
  );
  const slugTaken = Boolean(draft && mcps.some((m) => m.slug === draft.slug && m.id !== draft.id));
  const errors = draft ? reviewErrors(draft, included, slugTaken) : {};
  const reviewOk = Object.keys(errors).length === 0;
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  const patch = (p: Partial<Mcp>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const finalMcp = (status: Mcp['status']): Mcp => ({
    ...draft!,
    tools: draft!.tools.filter((_, i) => !excluded.has(i)),
    status,
  });

  const persist = (status: Mcp['status']) => {
    if (!draft) return;
    if (status === 'published' && !publishConfirmed) return;
    if (!reviewOk) {
      setShowErrors(true);
      setStep('review');
      notify('Revisa los campos marcados', { icon: 'alert' });
      return;
    }
    setBusy(status === 'published' ? 'publish' : 'draft');
    window.setTimeout(() => {
      save(finalMcp(status));
      setBusy(null);
      if (status === 'published') {
        setStep('done');
      } else {
        setStep('saved');
      }
    }, status === 'published' ? 1100 : 500);
  };

  const goReviewNext = () => {
    if (!reviewOk) {
      setShowErrors(true);
      document.querySelector('.is-invalid')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setStep('publish');
  };

  const canVisit = (id: Step) => {
    if (!draft) return id === 'url';
    if (id === 'explore') return trace.length > 0 && step !== 'explore';
    if (id === 'publish') return reviewOk;
    return true;
  };

  if (step === 'saved' && draft) {
    return (
      <div className="container create">
        <div className="done">
          <span className="done__mark">
            <Icon name="check" size={26} />
          </span>
          <h1>Borrador guardado.</h1>
          <p className="step-lede">
            Puedes volver a editar {draft.name || draft.slug} antes de publicarlo.
          </p>
          <div className="done__actions">
            <Link href={`/crear?editar=${draft.id}`} className="btn btn--primary btn--lg">
              Continuar edición
            </Link>
            <Link href="/" className="btn btn--outline btn--lg">
              Volver al catálogo
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'done' && draft) {
    return (
      <div className="container create">
        <div className="done">
          <span className="done__mark">
            <Icon name="check" size={26} />
          </span>
          <h1>Tu MCP ya está publicado.</h1>
          <p className="step-lede">
            {draft.name || draft.slug} ya está disponible con {included.length} herramientas para {draft.site}.
          </p>
          <div className="done__cmd">
            <CommandLine command={installCommand(draft)} />
          </div>
          <div className="done__actions">
            <Link href={`/mcp/${draft.slug}`} className="btn btn--primary btn--lg">
              Ver mi MCP <Icon name="arrowRight" size={16} />
            </Link>
            <Link href="/" className="btn btn--outline btn--lg">
              Explorar catálogo
            </Link>
            <button
              className="btn btn--ghost btn--lg"
              onClick={() => {
                setDraft(null);
                setTrace([]);
                setExcluded(new Set());
                setShowErrors(false);
                router.replace('/crear');
                setStep('url');
              }}
            >
              Crear otro MCP
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="create">
      <div className="create__bar">
        <div className="container create__bar-inner">
          <ol className="stepper" aria-label="Pasos">
            {STEPS.map((s, i) => {
              const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'todo';
              const clickable = state !== 'active' && canVisit(s.id) && step !== 'explore';
              return (
                <li key={s.id} className={cx('stepper__item', `is-${state}`)}>
                  <button
                    disabled={!clickable}
                    onClick={() => setStep(s.id)}
                    aria-current={state === 'active' ? 'step' : undefined}
                  >
                    <span className="stepper__n mono">{state === 'done' ? <Icon name="check" size={12} /> : `0${i + 1}`}</span>
                    <span className="stepper__label">{s.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
          {editing && <span className="create__editing mono">editando {editing.slug}</span>}
        </div>
      </div>

      <div className="container create__body">
        {step === 'url' && (
          <StepUrl
            initialUrl={params.get('url') ?? draft?.site ?? ''}
            onStart={({ url, hint }) => {
              const res = generate(url, hint);
              // Al regenerar un borrador existente se conserva su identidad
              const next = draft ? { ...res.draft, id: draft.id, slug: draft.slug, version: draft.version } : res.draft;
              setDraft(next);
              setTrace(res.trace);
              setExcluded(new Set());
              setShowErrors(false);
              setStep('explore');
            }}
          />
        )}

        {step === 'explore' && draft && (
          <StepExplore
            host={draft.site}
            icon={draft.icon}
            trace={trace}
            onDone={() => setStep('review')}
            onCancel={() => {
              setStep('url');
              if (!editing) setDraft(null);
              setTrace([]);
            }}
          />
        )}

        {step === 'review' && draft && (
          <StepReview
            draft={draft}
            onChange={patch}
            excluded={excluded}
            onToggleTool={(i) =>
              setExcluded((s) => {
                const n = new Set(s);
                n.has(i) ? n.delete(i) : n.add(i);
                return n;
              })
            }
            errors={errors}
            showErrors={showErrors}
          />
        )}

        {step === 'publish' && draft && (
          <StepPublish
            draft={draft}
            onChange={patch}
            includedCount={included.length}
            confirmed={publishConfirmed}
            onConfirm={setPublishConfirmed}
          />
        )}
      </div>

      {(step === 'review' || step === 'publish') && draft && (
        <div className="create__footer">
          <div className="container create__footer-inner">
            <button className="btn btn--ghost" onClick={() => setStep(step === 'publish' ? 'review' : 'url')}>
              <Icon name="arrowLeft" size={16} />
              {step === 'publish' ? 'Revisión' : 'Volver a explorar'}
            </button>
            <div className="create__footer-actions">
              <button className={cx('btn btn--outline', busy === 'draft' && 'is-loading')} onClick={() => persist('draft')} disabled={busy !== null}>
                {busy === 'draft' && <span className="spinner" />}
                Guardar borrador
              </button>
              {step === 'review' ? (
                <button className="btn btn--primary" onClick={goReviewNext}>
                  Continuar <Icon name="arrowRight" size={16} />
                </button>
              ) : (
                <button
                  className={cx('btn btn--primary', busy === 'publish' && 'is-loading')}
                  onClick={() => persist('published')}
                  disabled={!canPublish(draft) || !publishConfirmed || busy !== null}
                >
                  {busy === 'publish' ? <span className="spinner" /> : <Icon name="upload" size={16} />}
                  {busy === 'publish' ? 'Publicando…' : 'Publicar MCP'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
