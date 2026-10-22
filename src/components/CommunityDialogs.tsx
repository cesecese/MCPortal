'use client';

import { useState } from 'react';
import type { Mcp, ReportKind } from '../data/types';
import { cx, formatDate } from '../lib/format';
import { useStore } from '../store/store';
import { useToast } from '../store/toast';
import { Icon } from './Icon';
import { Dialog } from './primitives';

const REPORT_KINDS: { id: ReportKind; label: string; description: string }[] = [
  {
    id: 'broken',
    label: 'No funciona',
    description: 'El MCP no conecta o todas las herramientas fallan.',
  },
  {
    id: 'tool',
    label: 'Una herramienta falla',
    description: 'Un endpoint concreto devuelve error o datos vacíos.',
  },
  {
    id: 'outdated',
    label: 'La web ha cambiado',
    description: 'La web original ya no coincide con el MCP publicado.',
  },
  {
    id: 'other',
    label: 'Otro problema',
    description: 'Documentación incorrecta, permisos, comportamiento extraño…',
  },
];

/** Informe de errores o de desactualización. Queda abierto en la ficha. */
export function ReportDialog({
  mcp,
  open,
  onClose,
}: {
  mcp: Mcp;
  open: boolean;
  onClose: () => void;
}) {
  const { report } = useStore();
  const notify = useToast();
  const [kind, setKind] = useState<ReportKind>('broken');
  const [detail, setDetail] = useState('');
  const [sending, setSending] = useState(false);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    window.setTimeout(() => {
      report(mcp.id, kind, detail.trim() || REPORT_KINDS.find((item) => item.id === kind)?.label || 'Problema');
      setSending(false);
      setDetail('');
      setKind('broken');
      onClose();
      notify('Informe enviado', {
        detail: `${mcp.name} · queda abierto para revisión`,
        icon: 'alert',
      });
    }, 450);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Informar de un problema"
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button className={cx('btn btn--primary', sending && 'is-loading')} type="submit" form="report-form">
            {sending ? <span className="spinner" /> : <Icon name="alert" size={15} />}
            Enviar informe
          </button>
        </>
      }
    >
      <form id="report-form" className="dialog-form" onSubmit={submit}>
        <p className="dialog-form__intro">
          Cuéntanos qué falla en <strong>{mcp.name}</strong>. El informe será visible para el autor y para el resto de
          usuarios.
        </p>
        <fieldset className="choice-group">
          <legend className="field__label">Tipo de problema</legend>
          {REPORT_KINDS.map((item) => (
            <label key={item.id} className={cx('choice', kind === item.id && 'is-selected')}>
              <input
                type="radio"
                name="report-kind"
                value={item.id}
                checked={kind === item.id}
                onChange={() => setKind(item.id)}
              />
              <span>
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="field">
          <span className="field__label">
            Detalle <span className="field__hint">opcional</span>
          </span>
          <textarea
            className="textarea"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="¿Qué herramienta has usado? ¿Qué versión tienes instalada? ¿Qué error aparece?"
          />
        </label>
      </form>
    </Dialog>
  );
}

function nextPatch(version: string): string {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  return `${major}.${minor}.${patch + 1}`;
}

/** Publicación de un parche comunitario desde la ficha del MCP. */
export function PatchDialog({
  mcp,
  open,
  onClose,
}: {
  mcp: Mcp;
  open: boolean;
  onClose: () => void;
}) {
  const { publishPatch } = useStore();
  const notify = useToast();
  const [summary, setSummary] = useState('');
  const [fileName, setFileName] = useState('');
  const [sending, setSending] = useState(false);
  const version = nextPatch(mcp.version);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (summary.trim().length < 12) return;
    setSending(true);
    const changes = summary
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    window.setTimeout(() => {
      publishPatch(mcp.id, changes);
      setSending(false);
      setSummary('');
      setFileName('');
      onClose();
      notify(`v${version} publicada`, {
        detail: `${mcp.name} · parche comunitario añadido al historial`,
        icon: 'git',
      });
    }, 600);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Proponer un parche · v${version}`}
      footer={
        <>
          <button className="btn btn--ghost" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className={cx('btn btn--primary', sending && 'is-loading')}
            type="submit"
            form="patch-form"
            disabled={summary.trim().length < 12}
          >
            {sending ? <span className="spinner" /> : <Icon name="upload" size={15} />}
            Publicar versión
          </button>
        </>
      }
    >
      <form id="patch-form" className="dialog-form" onSubmit={submit}>
        <p className="dialog-form__intro">
          Vas a publicar una nueva versión de <strong>{mcp.name}</strong>, la v{mcp.version} actual. El autor aparecerá
          en el historial y el cambio quedará abierto a comentarios.
        </p>
        <div className="patch-flow" aria-hidden>
          <span className="mono">v{mcp.version}</span>
          <Icon name="arrowRight" size={14} />
          <span className="mono">v{version}</span>
          <span className="tag tag--outline">patch</span>
        </div>
        <label className="field">
          <span className="field__label">
            Qué cambia <span className="field__hint">una línea por cambio</span>
          </span>
          <textarea
            className="textarea"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={'Corrige el selector del formulario de reserva.\nAñade reintento cuando la web responde 503.'}
            required
            minLength={12}
          />
        </label>
        <label className="field">
          <span className="field__label">
            Manifest revisado <span className="field__hint">opcional en la demo</span>
          </span>
          <span className="file-field">
            <Icon name="upload" size={15} />
            <span>{fileName || 'Adjuntar manifest.json'}</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={(event) => setFileName(event.target.files?.[0]?.name ?? '')}
            />
          </span>
        </label>
        <p className="dialog-form__footnote">
          Última publicación: {formatDate(mcp.updatedAt)}. La versión nueva aparecerá arriba en el historial y podrá
          descargarse por separado.
        </p>
      </form>
    </Dialog>
  );
}
