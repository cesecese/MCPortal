'use client';

import { useState } from 'react';
import { CodeBlock, CommandLine } from '../components/Code';
import { Icon } from '../components/Icon';
import { McpCard } from '../components/McpCard';
import {
  Avatar,
  Dialog,
  EmptyState,
  KindTag,
  Menu,
  Monogram,
  Pagination,
  SiteIcon,
  Sparkline,
  Switch,
  Tabs,
  ToolSignature,
  ValidationMeter,
} from '../components/primitives';
import { SEED_MCPS } from '../data/mcps';
import type { Tool } from '../data/types';
import { useToast } from '../store/toast';
import '../styles/styleguide.css';

const TOOL: Tool = {
  name: 'search_books',
  description: 'Busca libros por título, autor o ISBN.',
  kind: 'http',
  method: 'GET',
  endpoint: '/search.json?q={query}',
  params: [
    { name: 'query', type: 'string', required: true },
    { name: 'page', type: 'integer', required: false },
  ],
  validated: true,
};

const SWATCHES = [
  ['fondo', '--bg'],
  ['superficie', '--surface'],
  ['tinta', '--ink'],
  ['secundario', '--muted'],
  ['señal', '--signal'],
  ['validado', '--ok'],
  ['http', '--http'],
  ['navegador', '--browser'],
];

export function StyleGuide() {
  const notify = useToast();
  const [tab, setTab] = useState('tools');
  const [page, setPage] = useState(2);
  const [on, setOn] = useState(true);
  const [open, setOpen] = useState(false);
  const mcp = SEED_MCPS[0];

  return (
    <div className="container sg">
      <header className="sg__head">
        <p className="eyebrow">Desarrollo</p>
        <h1>Styleguide</h1>
        <p className="sg__lede">Todos los componentes y sus estados. Ruta interna, fuera del catálogo.</p>
      </header>

      <section className="sg__section">
        <h2>Color</h2>
        <div className="sg__swatches">
          {SWATCHES.map(([name, token]) => (
            <div key={token} className="sg__swatch">
              <span style={{ background: `var(${token})` }} />
              <div>
                <strong>{name}</strong>
                <span className="mono">{token}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sg__section">
        <h2>Tipografía</h2>
        <div className="sg__type">
          <div>
            <span className="sg__label mono">h1 · 40/1</span>
            <p className="sg__h1">Convierte cualquier web en un MCP.</p>
          </div>
          <div>
            <span className="sg__label mono">h2 · 20/1.1</span>
            <p className="sg__h2">Catálogo</p>
          </div>
          <div>
            <span className="sg__label mono">cuerpo · 14/1.55</span>
            <p>El agente explora la web y publica herramientas validadas.</p>
          </div>
          <div>
            <span className="sg__label mono">mono · 12.5</span>
            <p className="mono">mcp__openlibrary__search_books</p>
          </div>
        </div>
      </section>

      <section className="sg__section">
        <h2>Botones</h2>
        <div className="sg__row">
          <button className="btn btn--primary">Primario</button>
          <button className="btn btn--outline">Contorno</button>
          <button className="btn btn--ghost">Fantasma</button>
          <button className="btn btn--signal">Señal</button>
          <button className="btn btn--danger">Peligro</button>
          <button className="btn btn--outline" disabled>
            Deshabilitado
          </button>
          <button className="btn btn--primary is-loading">
            <span className="spinner" /> Cargando
          </button>
        </div>
        <div className="sg__row">
          <button className="btn btn--primary btn--sm">Pequeño</button>
          <button className="btn btn--primary">Medio</button>
          <button className="btn btn--primary btn--lg">Grande</button>
          <button className="btn btn--outline btn--icon" aria-label="Más">
            <Icon name="more" size={16} />
          </button>
        </div>
      </section>

      <section className="sg__section">
        <h2>Campos</h2>
        <div className="sg__grid2">
          <div className="field">
            <label className="field__label" htmlFor="sg-input">
              Texto <span className="field__hint">opcional</span>
            </label>
            <input id="sg-input" className="input" placeholder="openlibrary.org" />
            <span className="field__hint">Un campo normal.</span>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sg-error">
              Error
            </label>
            <input id="sg-error" className="input is-invalid" defaultValue="no-es-una-url" aria-invalid />
            <span className="field__error">
              <Icon name="alert" size={13} /> Introduce una URL válida.
            </span>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sg-select">
              Selector
            </label>
            <select id="sg-select" className="select" defaultValue="libros">
              <option value="libros">Libros</option>
              <option value="comercio">Comercio</option>
              <option value="reservas">Reservas</option>
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sg-textarea">
              Texto largo
            </label>
            <textarea id="sg-textarea" className="textarea" rows={2} placeholder="Pista para el agente…" />
          </div>
        </div>
        <div className="sg__row sg__row--top">
          <label className="check">
            <input type="checkbox" defaultChecked /> Casilla marcada
          </label>
          <label className="check">
            <input type="checkbox" /> Casilla vacía
          </label>
          <label className="check">
            <input type="checkbox" disabled /> Deshabilitada
          </label>
          <span className="sg__switch">
            <Switch on={on} onChange={setOn} label="Interruptor" />
            <span className="field__hint">{on ? 'on' : 'off'}</span>
          </span>
        </div>
      </section>

      <section className="sg__section">
        <h2>Etiquetas y estados</h2>
        <div className="sg__row">
          <span className="tag">neutra</span>
          <span className="tag tag--outline">contorno</span>
          <span className="tag tag--ink">tinta</span>
          <KindTag kind="http" count={6} />
          <KindTag kind="browser" count={1} />
          <KindTag kind="mixed" />
          <span className="tag tag--ok">
            <Icon name="check" size={11} /> validada
          </span>
          <span className="tag tag--warn">borrador</span>
          <span className="tag tag--danger">
            <Icon name="x" size={11} /> falló
          </span>
          <span className="tag">
            <span className="dot dot--live" /> en vivo
          </span>
        </div>
        <div className="sg__row">
          <span className="mono sg__label">validación 6/9</span>
          <ValidationMeter validated={6} proposed={9} />
          <span className="mono sg__label">sparkline</span>
          <Sparkline data={[4, 7, 5, 9, 8, 12, 11, 14]} />
        </div>
      </section>

      <section className="sg__section">
        <h2>Pestañas y menú</h2>
        <Tabs
          items={[
            { id: 'tools', label: 'Herramientas', count: 6 },
            { id: 'manifest', label: 'Manifiesto' },
            { id: 'validation', label: 'Validación', count: 6 },
          ]}
          value={tab}
          onChange={setTab}
        />
        <div className="sg__row sg__row--top">
          <Menu
            label="Acciones"
            trigger={({ toggle, open: isOpen }) => (
              <button className="btn btn--outline" onClick={toggle} aria-expanded={isOpen}>
                Menú <Icon name="chevronDown" size={14} />
              </button>
            )}
            items={[
              { label: 'Copiar enlace', icon: 'link', onSelect: () => notify('Enlace copiado') },
              { label: 'Descargar', icon: 'download', onSelect: () => notify('Descarga simulada') },
              { label: 'Eliminar', icon: 'trash', danger: true, separatorBefore: true, onSelect: () => {} },
            ]}
          />
          <button className="btn btn--outline" onClick={() => setOpen(true)}>
            Abrir diálogo
          </button>
          <button className="btn btn--outline" onClick={() => notify('Borrador guardado', { detail: 'tienda-demo', icon: 'check' })}>
            Lanzar aviso
          </button>
        </div>
      </section>

      <section className="sg__section">
        <h2>Identidad</h2>
        <div className="sg__row">
          <Monogram mcp={{ name: 'Open Library' }} size={40} />
          <Avatar name="Ada Lovelace" size={32} />
          <SiteIcon mcp={{ name: 'Open Library', icon: '/favicons/openlibrary.org.png' }} size={34} />
          <span className="mono sg__label">openlibrary.org</span>
        </div>
        <div className="sg__signature">
          <ToolSignature tool={TOOL} />
          <ToolSignature tool={{ ...TOOL, name: 'book_table', kind: 'browser', params: [{ name: 'date', type: 'date', required: true }] }} />
        </div>
      </section>

      <section className="sg__section">
        <h2>Terminal</h2>
        <div className="sg__stack">
          <CommandLine command="npx -y mcportal add openlibrary" />
          <CodeBlock
            code={'{\n  "site": "openlibrary.org",\n  "tools": 6\n}'}
            title="manifest.json"
            lineNumbers
          />
        </div>
      </section>

      <section className="sg__section">
        <h2>Índice, vacío y paginación</h2>
        {mcp && <div className="mcp-index">{<McpCard mcp={mcp} />}</div>}
        <EmptyState icon="inbox" title="Sin resultados" actions={<button className="btn btn--outline">Limpiar</button>}>
          No hay MCPs que coincidan.
        </EmptyState>
        <Pagination page={page} pages={8} onChange={setPage} />
      </section>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Regenerar MCP"
        footer={
          <>
            <button className="btn btn--ghost" onClick={() => setOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn btn--primary"
              onClick={() => {
                setOpen(false);
                notify('Regeneración iniciada', { icon: 'git' });
              }}
            >
              Regenerar
            </button>
          </>
        }
      >
        Se volverá a explorar <span className="mono">openlibrary.org</span> y se sustituirán las herramientas. El MCP
        seguirá publicado hasta que termine.
      </Dialog>
    </div>
  );
}
