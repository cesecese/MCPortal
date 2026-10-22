"""Conversión de HTML a texto para las previsualizaciones de la traza.

Es la misma lógica que `runtime/executor.html_to_text`; el analizador la usa solo
para el `response_preview` de los candidatos HTML. Se mantiene aquí para que el
explorador no dependa del runtime (que construye otra persona).
"""

from __future__ import annotations

import re

from bs4 import BeautifulSoup

BOILERPLATE = re.compile(
    r"(^|[-_ ])(header|nav|navbar|menu|footer|breadcrumbs?|sidebar|cookie\w*|banner)($|[-_ ])", re.I)
BLOCK = {"p", "div", "br", "li", "tr", "h1", "h2", "h3", "h4", "section", "article",
         "table", "form", "label"}


def html_to_text(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    root = (soup.find("main") or soup.find(attrs={"role": "main"})
            or soup.find(id=re.compile(r"^(content|main|main-content|page-content)$", re.I))
            or soup.body or soup)
    for el in root.find_all(["script", "style", "noscript", "svg", "nav", "header", "footer", "template"]):
        el.decompose()
    for el in root.find_all(True):
        if el.decomposed:
            continue
        marker = " ".join(el.get("class") or []) + " " + (el.get("id") or "")
        if BOILERPLATE.search(marker):
            el.decompose()
    for a in root.find_all("a", href=True):
        if not a["href"].startswith(("#", "javascript:")):
            a.insert_before(f" [{a['href']}] ")
    for el in root.find_all(["td", "th"]):
        el.append(" | ")
    for el in root.find_all(BLOCK):
        el.insert_before("\n")
    text = re.sub(r"[ \t]+", " ", root.get_text())
    return re.sub(r"\n\s*\n+", "\n", text).strip()
