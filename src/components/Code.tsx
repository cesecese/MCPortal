import { useState, type ReactNode } from 'react';
import { useToast } from '../store/toast';
import { Icon } from './Icon';
import '../styles/code.css';

function highlightJson(src: string): ReactNode[] {
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|(-?\d+(?:\.\d+)?)|([{}[\],])/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push(src.slice(last, m.index));
    if (m[1]) {
      out.push(
        <span key={i++} className={m[2] ? 'tok-key' : 'tok-str'}>
          {m[1]}
        </span>,
      );
      if (m[2]) out.push(m[2]);
    } else if (m[3]) {
      out.push(
        <span key={i++} className="tok-num">
          {m[3]}
        </span>,
      );
    } else {
      out.push(
        <span key={i++} className="tok-punc">
          {m[4]}
        </span>,
      );
    }
    last = re.lastIndex;
  }
  out.push(src.slice(last));
  return out;
}

export function useCopy() {
  const notify = useToast();
  const [copied, setCopied] = useState(false);
  const copy = (text: string, what = 'Copiado al portapapeles') => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    notify(what, { icon: 'copy' });
    window.setTimeout(() => setCopied(false), 1600);
  };
  return { copied, copy };
}

export function CodeBlock({
  code,
  lang = 'json',
  title,
  maxHeight,
  lineNumbers,
}: {
  code: string;
  lang?: 'json' | 'shell' | 'text';
  title?: string;
  maxHeight?: number;
  lineNumbers?: boolean;
}) {
  const { copied, copy } = useCopy();
  const lines = code.split('\n');
  return (
    <div className="code">
      <div className="code__bar">
        <span className="code__title">{title ?? lang}</span>
        <button className="code__copy" onClick={() => copy(code)} aria-label="Copiar código">
          <Icon name={copied ? 'check' : 'copy'} size={14} />
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
      <pre style={{ maxHeight }} className={lineNumbers ? 'has-lines' : undefined}>
        {lineNumbers && (
          <span className="code__gutter" aria-hidden>
            {lines.map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </span>
        )}
        <code>
          {lang === 'json'
            ? highlightJson(code)
            : lang === 'shell'
              ? lines.map((l, i) => (
                  <span key={i}>
                    {l.startsWith('#') ? (
                      <span className="tok-punc">{l}</span>
                    ) : (
                      <>
                        <span className="tok-prompt">$ </span>
                        {l}
                      </>
                    )}
                    {i < lines.length - 1 && '\n'}
                  </span>
                ))
              : code}
        </code>
      </pre>
    </div>
  );
}

/** Comando de una línea con botón de copiar, para instalar desde la terminal. */
export function CommandLine({ command, label = 'Comando copiado' }: { command: string; label?: string }) {
  const { copied, copy } = useCopy();
  return (
    <div className="cmdline">
      <span className="cmdline__prompt" aria-hidden>
        $
      </span>
      <code className="cmdline__text">{command}</code>
      <button className="cmdline__copy" onClick={() => copy(command, label)} aria-label="Copiar comando">
        <Icon name={copied ? 'check' : 'copy'} size={15} />
      </button>
    </div>
  );
}
