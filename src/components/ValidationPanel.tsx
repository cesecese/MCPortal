import type { Mcp } from '../data/types';
import { validationOf } from '../lib/catalog';
import { cx, formatDate, relativeTime } from '../lib/format';
import { Icon } from './Icon';
import { KindTag, ValidationMeter } from './primitives';

/** Pestaña Validación: qué se ejecutó contra la web y qué pasó. */
export function ValidationPanel({ mcp }: { mcp: Mcp }) {
  const report = validationOf(mcp);
  const allValidated = report.validated >= report.proposed;
  const noneValidated = report.validated === 0;
  const resultText = allValidated
    ? 'Todas las herramientas publicadas han superado las comprobaciones realizadas contra la web.'
    : noneValidated
      ? 'Ninguna herramienta ha superado la validación necesaria para publicarse.'
      : 'Algunas herramientas no han superado las comprobaciones. Consulta los resultados para conocer los detalles.';

  return (
    <section className="detail__tab-panel" aria-labelledby="validation-title">
      <div className="section-head">
        <h2 id="validation-title">Resultados de la validación</h2>
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
          <p>{resultText}</p>
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
                  {result.swapped && <span className="tag tag--warn">Alternativa disponible</span>}
                </div>
                <p>
                  {result.ok
                    ? `Respondió ${result.status ?? '2xx'} y devolvió datos utilizables.`
                    : result.reason ?? 'No superó la comprobación contra la web.'}
                </p>
              </div>
              <div className="validation-item__end">
                <span className={cx('tag', result.ok ? 'tag--ok' : 'tag--danger')}>
                  {result.ok ? 'Validada' : 'No validada'}
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
