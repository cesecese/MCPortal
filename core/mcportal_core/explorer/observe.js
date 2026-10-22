// Observación compacta: elementos interactivos visibles con data-agent-id, agrupando repetidos.
// Devuelve { url, title, text, has_main, elements: [...], forms: [...] }.
() => {
  const SEL = 'a[href], button, input, select, textarea, [role=button], [role=link], [onclick]';
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const quote = s => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const visible = el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0';
  };
  const isField = el => ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
  const labelOf = el => {
    const aria = el.getAttribute('aria-label');
    if (aria) return clean(aria);
    if (isField(el)) {
      if (el.labels && el.labels.length) {
        const lab = el.labels[0];
        const own = clean([...lab.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' '));
        return (own || clean(lab.innerText)).slice(0, 60);
      }
      return clean(el.placeholder || el.getAttribute('name') || el.title || el.id);
    }
    return clean(el.innerText || el.value || el.title || el.getAttribute('alt') || '').slice(0, 60);
  };
  const normHref = href => {
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return '#';
    try {
      const u = new URL(href, location.href);
      if (u.origin !== location.origin) return u.href;
      // /works/OL45883W/Foundation → /works/{id}: lo que sigue al primer id suele ser un slug
      const path = u.pathname.replace(/\/[^/]*\d[^/]*(?=\/|$)/g, '/{id}').replace(/(\{id\}).*$/, '$1');
      return path + (u.search ? '?…' : '') + (u.hash && u.pathname === location.pathname ? u.hash : '');
    } catch (e) { return href; }
  };
  const forms = [...document.forms];
  const formInfo = forms.map((f, i) => ({
    index: i + 1,
    method: (f.getAttribute('method') || 'GET').toUpperCase(),
    action: f.getAttribute('action') || location.pathname,
    hidden: [...f.querySelectorAll('input[type=hidden]')].map(h => ({ name: h.name, value: h.value })),
  }));
  const scopeOf = el => {
    const f = el.form;
    if (!f) return '';
    if (f.id) return `form#${CSS.escape(f.id)} `;
    if (f.getAttribute('action')) return `form[action="${quote(f.getAttribute('action'))}"] `;
    return `form:nth-of-type(${forms.indexOf(f) + 1}) `;
  };
  const selectorOf = (el, label) => {
    const tag = el.tagName.toLowerCase();
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const scope = scopeOf(el);
    const name = el.getAttribute('name');
    if (name) return `${scope}${tag}[name="${quote(name)}"]`;
    if (tag === 'button' && el.getAttribute('type') === 'submit') return `${scope}button[type="submit"]`;
    for (const attr of ['aria-label', 'placeholder', 'title']) {
      const v = el.getAttribute(attr);
      if (v) return `${scope}${tag}[${attr}="${quote(v)}"]`;
    }
    if (label && !isField(el)) return `${scope}${tag}:has-text("${quote(label.slice(0, 40))}")`;
    return null;
  };

  let next = window.__agentNextId || 1;
  const groups = new Map();
  const elements = [];
  // Recorre también los shadow roots abiertos (web components); los locators de Playwright los atraviesan.
  const deepQuery = (root, sel, out = []) => {
    out.push(...root.querySelectorAll(sel));
    for (const host of root.querySelectorAll('*')) if (host.shadowRoot) deepQuery(host.shadowRoot, sel, out);
    return out;
  };
  for (const el of deepQuery(document, SEL)) {
    if (el.type === 'hidden' || el.disabled || el.closest('[data-agent-skip]') || !visible(el)) continue;
    let id = el.getAttribute('data-agent-id');
    if (!id) { id = String(next++); el.setAttribute('data-agent-id', id); }
    const tag = el.tagName.toLowerCase();
    const label = labelOf(el);
    const href = tag === 'a' ? normHref(el.getAttribute('href')) : null;
    const kind = tag === 'a' ? 'link' : (el.getAttribute('role') || tag);
    // enlaces a fichas (/works/{id}) se agrupan por patrón aunque el texto cambie
    const key = href && href.includes('{id}') ? `link|${href}`
      : [kind, el.type || '', label, href || '', el.getAttribute('name') || ''].join('|');
    if (groups.has(key)) { groups.get(key).similar++; continue; }
    const info = {
      id: Number(id), tag, kind, label, href,
      raw_href: tag === 'a' ? el.href : null,
      type: isField(el) ? (el.type || tag) : (el.getAttribute('type') || null),
      name: el.getAttribute('name'),
      value: isField(el) ? el.value : null,
      required: !!el.required,
      min: el.getAttribute('min'), max: el.getAttribute('max'),
      options: tag === 'select' ? [...el.options].map(o => ({ value: o.value, label: clean(o.text) })).slice(0, 12) : null,
      form: el.form ? forms.indexOf(el.form) + 1 : null,
      selector: selectorOf(el, label),
      similar: 0,
    };
    groups.set(key, info);
    elements.push(info);
  }
  window.__agentNextId = next;
  const main = document.querySelector('main') || document.body;
  return {
    url: location.href,
    title: document.title,
    text: clean(main.innerText).slice(0, 400),
    has_main: !!document.querySelector('main'),
    // límite: primero campos y botones, después enlaces; se mantiene el orden del documento
    elements: (() => {
      const links = elements.filter(e => e.kind === 'link').slice(0, 50);
      const rest = elements.filter(e => e.kind !== 'link').slice(0, 90);
      const keep = new Set([...links, ...rest]);
      return elements.filter(e => keep.has(e));
    })(),
    forms: formInfo,
  };
}
