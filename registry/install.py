"""Instala un MCP del registro: descarga su manifiesto y muestra la configuración.

    ./mcportal install localhost-8001
    .venv/bin/python -m registry.install localhost-8001 --registry http://localhost:8010

El manifiesto se guarda en `manifests/<slug>.json`, que es la carpeta que lee el
runtime MCP. La configuración que se imprime se puede pegar en cualquier cliente
MCP (bloque `mcpServers`).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    parser = argparse.ArgumentParser(prog="mcportal install")
    parser.add_argument("slug", help="slug del MCP en el registro")
    parser.add_argument(
        "--registry",
        default=os.environ.get("MCPORTAL_REGISTRY_URL", "http://localhost:8010"),
        help="URL del registro (por defecto http://localhost:8010)",
    )
    parser.add_argument(
        "--manifests",
        default=str(ROOT / "manifests"),
        help="carpeta donde dejar el manifiesto",
    )
    args = parser.parse_args()

    url = f"{args.registry.rstrip('/')}/mcps/{args.slug}/manifest"
    try:
        with urlopen(url, timeout=10) as response:  # noqa: S310 - URL del registro configurada
            manifest = json.load(response)
    except HTTPError as exc:
        print(f"No existe el MCP «{args.slug}» en {args.registry} (HTTP {exc.code}).", file=sys.stderr)
        return 1
    except URLError as exc:
        print(f"No se pudo conectar con el registro {args.registry}: {exc.reason}", file=sys.stderr)
        return 1

    destination = Path(args.manifests).expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    path = destination / f"{args.slug}.json"
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")

    config = {
        "mcpServers": {
            "mcportal": {
                "command": sys.executable,
                "args": ["-m", "mcportal_core.runtime.server", str(destination)],
                "env": {
                    "MCPORTAL_CONTACT": os.environ.get(
                        "MCPORTAL_CONTACT", "https://github.com/cesecese/MCPortal"
                    )
                },
            }
        }
    }
    print(f"Manifiesto instalado: {path}")
    print("Añade este bloque a tu cliente MCP:")
    print(json.dumps(config, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
