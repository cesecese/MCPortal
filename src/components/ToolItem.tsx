import { useState } from 'react';
import type { Tool } from '../data/types';
import { cx } from '../lib/format';
import { Icon } from './Icon';
import { KindTag } from './primitives';
import '../styles/tool-item.css';

export function ToolItem({ tool, defaultOpen }: { tool: Tool; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const id = `tool-${tool.name}`;
  return (
    <div className={cx('tool', open && 'is-open', !tool.validated && 'is-failed')} id={id}>
      <button className="tool__head" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${id}-body`}>
        <KindTag kind={tool.kind} />
        <code className="tool__sig">
          <span className="tool__name">{tool.name}</span>
          <span className="tool__params">
            (
            {tool.params.map((p, i) => (
              <span key={p.name}>
                {i > 0 && ', '}
                {p.name}
                {!p.required && '?'}
                <span className="tool__type">: {p.type}</span>
              </span>
            ))}
            )
          </span>
        </code>
        {!tool.validated && <span className="tag tag--danger">no validada</span>}
        <Icon name="chevronDown" size={16} className="tool__chev" />
      </button>
      <p className="tool__desc">{tool.description}</p>
      {tool.dependsOn && (
        <p className="tool__dep">
          <Icon name="link" size={13} /> Usa un valor devuelto por{' '}
          <a href={`#tool-${tool.dependsOn}`} className="mono">
            {tool.dependsOn}
          </a>
        </p>
      )}
      {open && (
        <div className="tool__body" id={`${id}-body`}>
          <div className="tool__block">
            <div className="eyebrow">Parámetros</div>
            {tool.params.length ? (
              <table className="tool__table">
                <tbody>
                  {tool.params.map((p) => (
                    <tr key={p.name}>
                      <td className="mono">{p.name}</td>
                      <td className="mono tool__muted">{p.type === 'date' ? 'string (date)' : p.type}</td>
                      <td>{p.required ? <span className="tag">obligatorio</span> : <span className="tool__muted">opcional</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="tool__muted">Sin parámetros.</p>
            )}
          </div>
          <div className="tool__block">
            <div className="eyebrow">Implementación</div>
            {tool.kind === 'http' ? (
              <div className="tool__endpoint mono">
                <span className={cx('tool__method', `tool__method--${tool.method?.toLowerCase()}`)}>{tool.method}</span>
                <span>{tool.endpoint}</span>
              </div>
            ) : (
              <ol className="tool__steps mono">
                {tool.steps?.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ol>
            )}
            {tool.failure && (
              <p className="tool__failure">
                <Icon name="alert" size={14} /> {tool.failure}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
