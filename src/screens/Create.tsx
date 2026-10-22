'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CommandLine } from '../components/Code';
import { Icon } from '../components/Icon';
import type { GenerationJob, Mcp, PublishOptions } from '../data/types';
import { cx, installCommand } from '../lib/format';
import { useStore } from '../store/store';
import { useToast } from '../store/toast';
import { StepExplore } from './create/StepExplore';
import { canPublish, StepPublish } from './create/StepPublish';
import { reviewErrors, StepReview } from './create/StepReview';
import { StepUrl } from './create/StepUrl';
import '../styles/create.css';

type Step = 'url' | 'explore' | 'review' | 'publish' | 'done';

const STEPS: { id: Exclude<Step, 'done'>; label: string }[] = [
  { id: 'url', label: 'URL' },
  { id: 'explore', label: 'Generación' },
  { id: 'review', label: 'Revisión' },
  { id: 'publish', label: 'Publicación' },
];

export function Create() {
  const params = useSearchParams();
  const { byId, mcps, saveDraft, publishDraft, startGeneration, cancelGeneration, finalizeGeneration, discardDraft } = useStore();
  const router = useRouter();
  const notify = useToast();

  const editing = params.get('editar') ? byId(params.get('editar')!) : undefined;
  const [step, setStep] = useState<Step>(editing ? 'review' : 'url');
  const [draft, setDraft] = useState<Mcp | null>(editing ? structuredClone(editing) : null);
  const [job, setJob] = useState<GenerationJob | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [showErrors, setShowErrors] = useState(false);
  const [permission, setPermission] = useState(false);
  const [busy, setBusy] = useState<'draft' | 'publish' | null>(null);

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

  const publishOptions = (): PublishOptions => ({
    visibility: draft!.visibility,
    category: draft!.category,
    tags: draft!.tags,
    license: draft!.license,
    permissionConfirmed: permission,
  });

  const persist = (target: 'draft' | 'publish') => {
    if (!draft) return;
    if (!reviewOk) {
      setShowErrors(true);
      setStep('review');
      notify('Revisa los campos marcados', { icon: 'alert' });
      return;
    }
    if (target === 'publish' && !permission) {
      notify('Falta la confirmación de permiso', { detail: 'Márcala en el paso de publicación', icon: 'alert' });
      setStep('publish');
      return;
    }
    setBusy(target === 'publish' ? 'publish' : 'draft');
    window.setTimeout(() => {
      if (target === 'publish') {
        const published = publishDraft(finalMcp('published'), publishOptions());
        setBusy(null);
        if (published) {
          setDraft(published);
          setStep('done');
        }
      } else {
        saveDraft(finalMcp('draft'));
        setBusy(null);
        notify('Borrador guardado en este navegador', { detail: draft.slug, icon: 'check' });
        router.push(`/mcp/${draft.slug}`);
      }
    }, target === 'publish' ? 1100 : 450);
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
    if (id === 'explore') return Boolean(job) && step !== 'explore';
    if (id === 'publish') return reviewOk;
    return true;
  };

  if (step === 'done' && draft) {
    return (
      <div className="container create">
        <div className="done">
          <span className="done__mark">
            <Icon name="check" size={26} />
          </span>
          <p className="eyebrow">Publicado en MCPortal</p>
          <h1>
            <span className="mono">{draft.slug}</span> ya está disponible
          </h1>
          <p className="step-lede">
            {included.length} herramientas para {draft.site}.{' '}
            {draft.visibility === 'unlisted'
              ? 'Solo quien tenga el enlace podrá verlo.'
              : draft.visibility === 'private'
                ? 'Privado: solo tú puedes verlo.'
                : 'Ya aparece en el catálogo.'}
          </p>
          <div className="done__cmd">
            <CommandLine command={installCommand(draft)} />
          </div>
          <div className="done__actions">
            <Link href={`/mcp/${draft.slug}`} className="btn btn--primary btn--lg">
              Ver la página del MCP <Icon name="arrowRight" size={16} />
            </Link>
            <Link href="/biblioteca" className="btn btn--outline btn--lg">
              Ir a mi biblioteca
            </Link>
            <button
              className="btn btn--ghost btn--lg"
              onClick={() => {
                setDraft(null);
                setJob(null);
                setExcluded(new Set());
                setShowErrors(false);
                setPermission(false);
                router.replace('/crear');
                setStep('url');
              }}
            >
              Crear otro
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
            onStart={({ url, hint, maxSteps, mode }) => {
              const next = startGeneration(url, { hint, maxSteps, mode });
              // Al regenerar un borrador existente se conserva su identidad
              const generated = draft
                ? { ...next.draft, id: draft.id, slug: draft.slug, version: draft.version, createdAt: draft.createdAt }
                : next.draft;
              setDraft(generated);
              setJob({ ...next, draft: generated });
              setExcluded(new Set());
              setShowErrors(false);
              setPermission(false);
              setStep('explore');
            }}
          />
        )}

        {step === 'explore' && job && draft && (
          <StepExplore
            host={draft.site}
            icon={draft.icon}
            job={job}
            onDone={() => {
              finalizeGeneration(job.id);
              setStep('review');
            }}
            onCancel={() => {
              cancelGeneration(job.id);
              if (!editing && draft) discardDraft(draft.slug);
              setJob(null);
              setStep('url');
              if (!editing) setDraft(null);
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
            permission={permission}
            onPermissionChange={setPermission}
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
                  onClick={() => persist('publish')}
                  disabled={!canPublish(draft, permission) || busy !== null}
                >
                  {busy === 'publish' ? <span className="spinner" /> : <Icon name="upload" size={16} />}
                  {busy === 'publish' ? 'Publicando…' : 'Publicar en MCPortal'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
