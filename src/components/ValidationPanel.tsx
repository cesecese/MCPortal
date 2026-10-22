import type { Mcp } from '../data/types';
import { validationOf } from '../lib/catalog';
import { cx, formatDate, relativeTime } from '../lib/format';
import { Icon } from './Icon';
import { KindTag, ValidationMeter } from './primitives';

/** Pestaña Validación: qué se ejecutó contra la web y qué pasó. */
export function ValidationPanel({ mcp }: { mcp: Mcp }) {
  const report = validationOf(mcp);
  const failed = report.results.filter((result) => !result.ok).length;
  const executed = report.results.length;
  const pending = Math.max(0, report.proposed - executed);

  return (
    <section className="detail__tab-panel" aria-labelledby="validation-title">
      <div className="section-head">
        <h2 id="validation-title">Informe del validador</h2>
        <span className="section-head__meta">
          {formatDate(report.validatedAt)} · {relativeTime(report.validatedAt)}
        </span>
      </div>

      <div className="validation-overview">
        <div className="validation-overview__score">
          <strong>{report.validated}</strong>
          <span>/ {report.proposed}</span>
          <p>herramientas validadas</p>
        </div>
        <div className="validation-overview__detail">
          <ValidationMeter validated={report.validated} proposed={report.proposed} />
          <p>
            El validador ejecutó {executed} {executed === 1 ? 'herramienta' : 'herramientas'} contra la web.
            {failed > 0 ? ` ${failed} no superaron la comprobación.` : ' Todas respondieron correctamente.'}
            {pending > 0
              ? ` ${pending} ${pending === 1 ? 'propuesta se descartó' : 'propuestas se descartaron'} antes de ejecutarse.`
              : ''}
          </p>
        </div>
      </div>

      {report.results.length ? (
        <ul className="validation-list">
          {report.results.map((result) => (
            <li key={result.name} className={cx('validation-item', !result.ok && 'is-failed')}>
              <span className="validation-item__icon">
                <Icon name={result.ok ? 'check' : 'x'} size={14} />
              </span>
              <div className="validation-item__body">
                <div className="validation-item__head">
                  <code>{result.name}</code>
                  <KindTag kind={result.kind} />
                  {result.swapped && <span className="tag tag--warn">receta alternativa</span>}
                </div>
                <p>
                  {result.ok
                    ? `Respondió ${result.status ?? '2xx'} y devolvió datos utilizables.`
                    : result.reason ?? 'No superó la comprobación contra la web.'}
                </p>
              </div>
              <div className="validation-item__end">
                <span className={cx('tag', result.ok ? 'tag--ok' : 'tag--danger')}>
                  {result.ok ? 'validada' : 'descartada'}
                </span>
                <span className="mono">{result.seconds.toFixed(1)} s</span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="detail__none">Todavía no hay resultados de validación para este MCP.</p>
      )}
    </section>
  );
}
