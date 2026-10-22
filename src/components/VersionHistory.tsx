'use client';

import { useState } from 'react';
import type { Mcp } from '../data/types';
import { versionsOf } from '../lib/catalog';
import { cx, formatDate, formatNumber, relativeTime } from '../lib/format';
import { useToast } from '../store/toast';
import { Icon } from './Icon';

/** Cronología de publicaciones y descarga de cada versión. */
export function VersionHistory({ mcp }: { mcp: Mcp }) {
  const versions = versionsOf(mcp);
  const notify = useToast();
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = (version: string) => {
    setDownloading(version);
    window.setTimeout(() => {
      setDownloading(null);
      notify(`Manifest v${version} descargado`, {
        detail: `${mcp.slug} · versión histórica · simulado`,
        icon: 'download',
      });
    }, 550);
  };

  return (
    <ol className="version-list">
      {versions.map((entry) => {
        const current = entry.version === mcp.version;
        return (
          <li key={`${entry.version}-${entry.publishedAt}`} className={cx('version-item', current && 'is-current')}>
            <div className="version-item__version">
              <span className="mono">v{entry.version}</span>
              {current && <span className="tag tag--ok">Actual</span>}
              {entry.author === 'Tú' && <span className="tag tag--ink">Tu parche</span>}
            </div>
            <div className="version-item__body">
              <p className="version-item__meta">
                <span>{formatDate(entry.publishedAt)}</span>
                <span aria-hidden>·</span>
                <span>{relativeTime(entry.publishedAt)}</span>
                <span aria-hidden>·</span>
                <span>por {entry.author}</span>
                <span aria-hidden>·</span>
                <span>{formatNumber(entry.downloads)} descargas</span>
              </p>
              <ul className="version-item__changes">
                {entry.changes.map((change) => (
                  <li key={change}>{change}</li>
                ))}
              </ul>
            </div>
            <button
              className={cx('btn btn--outline btn--sm version-item__download', downloading === entry.version && 'is-loading')}
              onClick={() => download(entry.version)}
              aria-label={`Descargar manifest de la versión ${entry.version}`}
            >
              {downloading === entry.version ? <span className="spinner" /> : <Icon name="download" size={14} />}
              <span>Manifest</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
