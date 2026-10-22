"""Pipeline: explorar → sintetizar → validar → manifiesto (sección 7.8).

    python -m mcportal_core.pipeline URL [--policy auto|llm|heuristic] [--no-llm] [--headless]
                                        [--max-steps 20] [--hint "..."]
    python -m mcportal_core.pipeline URL --from-trace cache/<slug>/trace.json

`--from-trace` repite en el panel una exploración guardada (0,35 s entre pasos), vuelve a
sintetizar y a validar: es el plan B de la demo.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

from .common.events import Events, slug_for
from .synthesizer.synthesize import synthesize
from .validator.validate import validate

ROOT = Path(__file__).resolve().parents[2]
RUNS = ROOT / "runs"
MANIFESTS = ROOT / "manifests"
STEP_DELAY = 0.35


def replay(trace: dict, events: Events, delay: float = STEP_DELAY) -> None:
    """Emite una traza guardada como si se estuviera explorando ahora."""
    events.emit("explore_started", url=trace.get("start_url") or trace.get("site"),
                policy=trace.get("policy") or "heuristic", max_steps=len(trace.get("steps") or []))
    events.emit("mode", read_only=bool(trace.get("read_only")), site=trace.get("site"))
    for step in trace.get("steps") or []:
        requests = [r for r in trace.get("requests") or [] if r.get("id") in (step.get("request_ids") or [])]
        action = step.get("action") or {}
        label = action.get("type")
        if label == "goto":
            text = f"goto {action.get('url')}"
        else:
            element = step.get("element") or {}
            text = f"{label} [{action.get('id')}] {element.get('kind', '')} \"{element.get('label', '')}\""
        events.emit("step", i=step.get("i"), action=text, url=step.get("url_after"),
                    requests=step.get("request_ids") or [], error=step.get("error"))
        for request in requests:
            events.emit("request", id=request.get("id"), step=request.get("step"),
                        method=request.get("method"), url=request.get("url"),
                        status=request.get("status"), kind=request.get("kind"))
        if step.get("note"):
            events.emit("warning", text=step["note"])
        time.sleep(delay)
    for cand in trace.get("candidates") or []:
        events.emit("candidate", id=cand.get("id"), method=cand.get("method"), url=cand.get("url"),
                    params=[p.get("name") for p in cand.get("params") or []],
                    csrf=cand.get("csrf_fields") or [], browser=bool(cand.get("browser")))
    events.emit("explore_done", steps=len(trace.get("steps") or []),
                requests=len(trace.get("requests") or []),
                candidates=len(trace.get("candidates") or []),
                dependencies=len(trace.get("dependencies") or []))
    events.emit("finish", summary="Exploración repetida desde la caché.")


def _explore(url: str, args: argparse.Namespace, events: Events) -> dict:
    """Ejecuta el explorador de la persona 1."""
    try:
        from .explorer.explore import explore
    except ImportError as exc:  # la carpeta explorer la escribe la persona 1
        raise SystemExit(
            "El explorador todavía no está disponible (core/mcportal_core/explorer/explore.py). "
            "Usa --from-trace para probar el pipeline con una traza guardada."
        ) from exc
    return asyncio.run(
        explore(
            url,
            events=events,
            policy=args.policy,
            max_steps=args.max_steps,
            headless=args.headless,
            hint=args.hint,
        )
    )


def run(args: argparse.Namespace) -> int:
    trace: dict | None = None
    if args.from_trace:
        trace_path = Path(args.from_trace)
        if not trace_path.exists():
            raise SystemExit(f"No existe la traza: {trace_path}")
        trace = json.loads(trace_path.read_text(encoding="utf-8"))
        url = args.url or f"http://{trace.get('site')}"
    else:
        if not args.url:
            raise SystemExit("Falta la URL (o usa --from-trace)")
        url = args.url

    slug = slug_for(url)
    run_dir = RUNS / slug
    run_dir.mkdir(parents=True, exist_ok=True)
    events = Events(run_dir)
    events.reset()
    events.emit("run_started", url=url, cached=bool(args.from_trace))

    if trace is not None:
        replay(trace, events)
    else:
        trace = _explore(url, args, events)
        (run_dir / "trace.json").write_text(json.dumps(trace, ensure_ascii=False, indent=2), encoding="utf-8")

    proposed = synthesize(trace, events, use_llm=not args.no_llm)
    (run_dir / "proposed.json").write_text(json.dumps(proposed, ensure_ascii=False, indent=2), encoding="utf-8")

    validated, report = asyncio.run(validate(proposed, events, run_dir=str(run_dir)))
    MANIFESTS.mkdir(parents=True, exist_ok=True)
    manifest_path = MANIFESTS / f"{slug}.json"
    manifest_path.write_text(json.dumps(validated, ensure_ascii=False, indent=2), encoding="utf-8")
    events.emit("done", proposed=report["proposed"], validated=report["validated"],
                manifest=f"manifests/{slug}.json")

    print(f"propuestas: {report['proposed']}  validadas: {report['validated']}")
    for item in report["results"]:
        print(f"  {'OK ' if item['ok'] else 'NO '} {item['name']:<42} {item['kind']:<8} {item['reason'][:70]}")
    print(f"manifiesto: {manifest_path.relative_to(ROOT)}")
    return 0 if report["validated"] else 1


def main(argv: list[str] | None = None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # pragma: no cover
        pass
    parser = argparse.ArgumentParser(prog="mcportal_core.pipeline", description=__doc__)
    parser.add_argument("url", nargs="?", help="URL de la web a explorar")
    parser.add_argument("--policy", choices=["auto", "llm", "heuristic"], default="auto")
    parser.add_argument("--no-llm", action="store_true", help="sintetizador determinista")
    parser.add_argument("--headless", action="store_true", help="navegador sin ventana")
    parser.add_argument("--max-steps", type=int, default=20)
    parser.add_argument("--hint", default=None)
    parser.add_argument("--from-trace", default=None, help="repetir una traza guardada")
    return run(parser.parse_args(argv))


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
