"""Explorador: URL → traza + candidatos con parámetros y dependencias resueltos.

    PYTHONPATH=core python -m mcportal_core.explorer.explore http://localhost:8001/ \
        [--policy auto|llm|heuristic] [--max-steps 20] [--headless] [--hint "…"]

Escribe `runs/<slug>/trace.json` y `events.jsonl` (eventos del contrato 6.4).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import time
from pathlib import Path

from mcportal_core.explorer.analyze import analyze
from mcportal_core.explorer.browser import Session
from mcportal_core.explorer.policies import POLICIES, llm_available

try:  # contrato compartido (persona 2); el stub cubre el trabajo en solitario de P1
    from mcportal_core.common.events import Events, slug_for
except ImportError:
    from mcportal_core.explorer.events_stub import Events, slug_for

RUNS = Path(__file__).resolve().parents[3] / "runs"


async def explore(url: str, policy: str = "auto", max_steps: int = 20, headless: bool = False,
                  hint: str = "", events: Events | None = None,
                  read_only: bool | None = None) -> dict:
    run_dir = RUNS / slug_for(url)
    events = events or Events(run_dir)
    if policy == "auto":
        policy = "llm" if llm_available() else "heuristic"
        if policy == "heuristic":
            events.emit("warning", text="Sin MCPORTAL_LLM_API_KEY: exploración heurística (plan B)")
    if policy == "llm" and "llm" not in POLICIES:
        events.emit("warning", text="La capa de LLM no está disponible; sigo con la heurística")
        policy = "heuristic"

    events.emit("explore_started", url=url, policy=policy, max_steps=max_steps)
    started = time.time()
    session = Session(url, events, headless=headless, read_only=read_only)
    await session.start()
    try:
        try:
            await POLICIES[policy](session, max_steps, hint)
        except Exception as exc:  # red, cuota, clave o rechazo del modelo: la demo sigue con la heurística
            if policy != "llm":
                raise
            events.emit("warning", text=f"Fallo de la capa de LLM ({exc.__class__.__name__}: {exc}); "
                                        "sigo con la heurística")
            policy = "heuristic"
            await POLICIES["heuristic"](session, max_steps, hint)
    finally:
        await session.close()

    trace = {
        "site": session.base, "title": session.title, "start_url": url, "policy": policy,
        "started": started, "finished": time.time(),
        "steps": session.steps, "requests": session.requests,
    }
    trace.update(analyze(trace))
    (run_dir / "trace.json").write_text(
        json.dumps(trace, ensure_ascii=False, indent=1, default=str), encoding="utf-8")
    for candidate in trace["candidates"]:
        events.emit("candidate", id=candidate["id"], method=candidate["method"], url=candidate["url"],
                    params=[param["name"] for param in candidate["params"]],
                    csrf=bool(candidate["csrf_fields"]), browser=bool(candidate["browser"]))
    events.emit("explore_done", steps=len(session.steps), requests=len(session.requests),
                candidates=len(trace["candidates"]), dependencies=len(trace["dependencies"]))
    return trace


def main() -> None:
    parser = argparse.ArgumentParser(description="Explora una web y escribe su traza y candidatos.")
    parser.add_argument("url")
    parser.add_argument("--policy", default="auto", choices=["auto", *POLICIES])
    parser.add_argument("--max-steps", type=int, default=20)
    parser.add_argument("--headless", action="store_true")
    parser.add_argument("--hint", default="")
    parser.add_argument("--read-only", action="store_true",
                        help="fuerza el modo solo lectura (para probarlo en las webs de demo)")
    args = parser.parse_args()
    asyncio.run(explore(args.url, args.policy, args.max_steps, args.headless, args.hint,
                        read_only=True if args.read_only else None))


if __name__ == "__main__":
    main()
