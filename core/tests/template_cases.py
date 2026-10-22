"""Casos del contrato de plantillas y del ejecutor (sección 6.1 y 7.2), sin red externa.

    py core/tests/template_cases.py
"""
from __future__ import annotations

import asyncio
import html
import sys

from mcportal_core.runtime import executor as ex

failures = 0


def check(condition: bool, message: str, detail: str = "") -> None:
    global failures
    print(f"  {'OK  ' if condition else 'FALLA'} {message}" + (f"  → {detail}" if not condition and detail else ""))
    if not condition:
        failures += 1


def tool(url: str, body=None, body_type=None, method="GET", schema=None) -> dict:
    impl = {"kind": "http", "method": method, "url": url}
    if body is not None:
        impl["body"] = body
        impl["body_type"] = body_type or "json"
    return {"name": "t", "impl": impl, "input_schema": schema or {"type": "object", "properties": {}}}


def main() -> int:
    print("URL: sustitución y parámetros opcionales")
    t = tool("http://x/api?q={query}&limit={limit}&fixed=1")
    check(ex.build_url(t["impl"]["url"], {"query": "a b", "limit": 5}) ==
          "http://x/api?q=a%20b&limit=5&fixed=1", "codifica el valor y conserva los literales")
    check(ex.build_url(t["impl"]["url"], {"limit": 5}) == "http://x/api?limit=5&fixed=1",
          "omite el par cuyo valor es solo {p} y p no viene")
    check(ex.build_url("http://x/api/{id}/items", {"id": "cart_1"}) == "http://x/api/cart_1/items",
          "sustituye en el path")
    check(ex.build_url("http://x/api?flag={flag}", {"flag": True}) == "http://x/api?flag=true",
          "los booleanos van como true/false")
    check(ex.build_url("http://x/api?tag=libro-{slug}", {"slug": "zeta"}) == "http://x/api?tag=libro-zeta",
          "sustituye dentro de un par de query mixto")

    print("\nCuerpo JSON: tipos, nulos y claves con puntos")
    body = {"product_id": "{product_id}", "qty": "{qty}", "name": "{name}", "note": "texto {name}"}
    out = ex.build_body(body, {"product_id": "bk-1", "qty": 2, "name": "Ada"})
    check(out == {"product_id": "bk-1", "qty": 2, "name": "Ada", "note": "texto Ada"},
          "conserva el tipo del número y rellena texto embebido", repr(out))
    check(ex.build_body(body, {"product_id": "bk-1", "qty": 2}) ==
          {"product_id": "bk-1", "qty": 2, "note": "texto {name}"},
          "quita la clave si el parámetro no viene", "")
    nested = ex.build_body({"a.b": "{x}", "a.c": 1}, {"x": "v"})
    check(nested == {"a": {"b": "v", "c": 1}}, "las claves con puntos generan JSON anidado", repr(nested))
    check(ex.build_body({"a.b": "{x}", "a.c": 1}, {}) == {"a": {"c": 1}},
          "quitar una clave anidada no rompe el objeto")

    print("\nCuerpo form y argumentos")
    flat = ex._flatten({"a": {"b": "v"}, "n": 3, "ok": True, "z": None})
    check(flat == {"a.b": "v", "n": "3", "ok": "true", "z": ""}, "aplana a texto para x-www-form-urlencoded", repr(flat))
    prepared = ex.prepare_arguments(
        {"input_schema": {"properties": {"limit": {"type": "integer", "default": 10}, "q": {"type": "string"}}}},
        {"q": None, "other": 1},
    )
    check(prepared == {"limit": 10, "other": 1}, "aplica defaults e ignora argumentos null", repr(prepared))
    check(ex.prepare_arguments({"input_schema": {"properties": {"x": {"default": 0}}}}, {"x": False}) == {"x": False},
          "no confunde false con null")

    print("\nTexto: recortes y HTML")
    trimmed = ex.trim_strings({"a": "x" * 200, "b": ["y" * 170]})
    check(trimmed["a"].endswith("…") and len(trimmed["a"]) == 161, "recorta cadenas a 160 caracteres")
    long_text = "z" * 9000
    check(ex.finish_text(long_text).endswith("caracteres en total)"), "avisa al recortar a 8000 caracteres")
    page = """<html><body><header>MENU PRINCIPAL</header><main>
      <h1>Fundación</h1><p>Primer volumen.</p>
      <table><tr><td>Precio</td><td>19,90</td></tr></table>
      <a href="/api/cart">Ver carrito</a>
      <footer>Pie</footer><script>var x=1</script></main></body></html>"""
    text = ex.html_to_text(page)
    check("MENU PRINCIPAL" not in text and "Pie" not in text and "var x" not in text,
          "quita cabecera, pie y scripts", text)
    check("Fundación" in text and bool(__import__("re").search(r"\[\s*/api/cart\s*\]\s*Ver carrito", text)),
          "conserva el contenido y los enlaces como [href] texto", text)
    check("19,90 | " in text or "Precio | 19,90 |" in text, "separa celdas con |", text)

    print("\nMétodo HTTP no estándar (QUERY, como Toolshop)")
    received: list[str] = []

    async def server(reader, writer):
        request = (await reader.read(4096)).decode("latin-1")
        received.append(request.split("\r\n", 1)[0])
        payload = b'{"ok":true}'
        writer.write(b"HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: "
                     + str(len(payload)).encode() + b"\r\nConnection: close\r\n\r\n" + payload)
        await writer.drain()
        writer.close()

    async def probe() -> None:
        srv = await asyncio.start_server(server, "127.0.0.1", 0)
        port = srv.sockets[0].getsockname()[1]
        async with srv:
            await ex.run_http(tool(f"http://127.0.0.1:{port}/api/search", method="QUERY"), {})
            srv.close()

    asyncio.run(probe())
    check(received and received[0].startswith("QUERY /api/search"), "envía el método tal cual", repr(received))

    print()
    print("OK: casos de plantilla y ejecutor" if not failures else f"FALLAN {failures} comprobaciones")
    return 0 if not failures else 1


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):
        pass
    raise SystemExit(main())
