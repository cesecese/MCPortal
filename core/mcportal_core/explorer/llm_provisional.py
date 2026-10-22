"""Adaptador provisional de LLM para poder probar el explorador y el sintetizador.

**Temporal.** La capa definitiva es `mcportal_core.common.llm` (persona 2), con la
interfaz `agent_turn` / `structured`. Este módulo la implementa sobre Anthropic
(Claude) y sobre la API compatible con OpenAI (OpenAI, OpenRouter, DeepSeek, Ollama)
para no bloquear las pruebas. En cuanto exista `common/llm.py`, se usa esa y este
archivo deja de importarse.

Configuración (`.env.local` o entorno):
    MCPORTAL_LLM_PROVIDER   anthropic | openai | openrouter | deepseek | ollama
    MCPORTAL_LLM_API_KEY    clave (o la variable estándar del proveedor)
    MCPORTAL_MODEL          modelo (Claude: claude-sonnet-5-5)
    MCPORTAL_LLM_BASE_URL   opcional, solo para proveedores compatibles con OpenAI
"""

from __future__ import annotations

import json
import os

PROVIDER = os.environ.get("MCPORTAL_LLM_PROVIDER", "openai").lower()

PROVIDERS = {
    "openai": ("https://api.openai.com/v1", ("MCPORTAL_LLM_API_KEY", "OPENAI_API_KEY"),
               "gpt-4o-mini"),
    "openrouter": ("https://openrouter.ai/api/v1", ("MCPORTAL_LLM_API_KEY", "OPENROUTER_API_KEY"),
                   "openai/gpt-4o-mini"),
    "deepseek": ("https://api.deepseek.com/v1", ("MCPORTAL_LLM_API_KEY", "DEEPSEEK_API_KEY"),
                 "deepseek-chat"),
    "ollama": ("http://127.0.0.1:11434/v1", ("MCPORTAL_LLM_API_KEY", "OLLAMA_API_KEY"), "llama3.1"),
}
ANTHROPIC_KEYS = ("MCPORTAL_LLM_API_KEY", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN")
FALLBACK_BETA = "server-side-fallback-2026-07-01"

DEFAULT_BASE, KEY_VARS, DEFAULT_MODEL = PROVIDERS.get(PROVIDER, PROVIDERS["openai"])
BASE_URL = os.environ.get("MCPORTAL_LLM_BASE_URL", DEFAULT_BASE)
MODEL = os.environ.get("MCPORTAL_MODEL", "claude-sonnet-5-5" if PROVIDER == "anthropic" else DEFAULT_MODEL)
_key_vars = ANTHROPIC_KEYS if PROVIDER == "anthropic" else KEY_VARS
API_KEY = next((os.environ[name] for name in _key_vars if os.environ.get(name)), "")
AUTH_TOKEN = os.environ.get("ANTHROPIC_AUTH_TOKEN", "") if PROVIDER == "anthropic" else ""


def available() -> bool:
    return bool(API_KEY or AUTH_TOKEN)


# ---------- Anthropic ----------

_anthropic_client = None


def anthropic_client():
    global _anthropic_client
    if _anthropic_client is None:
        from anthropic import AsyncAnthropic

        if API_KEY:
            _anthropic_client = AsyncAnthropic(api_key=API_KEY)
        else:
            _anthropic_client = AsyncAnthropic(auth_token=AUTH_TOKEN)
    return _anthropic_client


def _text_of(response) -> str:
    return "".join(block.text for block in response.content if getattr(block, "type", "") == "text")


async def _anthropic_turn(*, system: str, tools: list[dict], messages: list[dict],
                          effort: str, max_tokens: int) -> dict:
    response = await anthropic_client().beta.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        tools=tools,
        messages=messages,
        thinking={"type": "adaptive", "display": "summarized"},
        output_config={"effort": effort},
        cache_control={"type": "ephemeral"},
        betas=[FALLBACK_BETA],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        raise RuntimeError(f"El modelo rechazó la petición: {response.stop_details}")
    text = "".join(block.text for block in response.content
                   if getattr(block, "type", "") == "text")
    thinking = "".join(getattr(block, "thinking", "") or "" for block in response.content
                       if getattr(block, "type", "") == "thinking")
    calls = [{"id": block.id, "name": block.name, "input": block.input}
             for block in response.content if getattr(block, "type", "") == "tool_use"]
    return {"text": text, "thinking": thinking, "tool_calls": calls,
            "content": response.content}


async def _anthropic_structured(*, system: str, user: str, schema: dict, effort: str) -> dict:
    response = await anthropic_client().beta.messages.create(
        model=MODEL,
        max_tokens=16000,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        cache_control={"type": "ephemeral"},
        betas=[FALLBACK_BETA],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        raise RuntimeError(f"El modelo rechazó la petición: {response.stop_details}")
    return json.loads(_text_of(response))


# ---------- API compatible con OpenAI ----------

_client = None


def client():
    global _client
    if _client is None:
        from openai import AsyncOpenAI

        _client = AsyncOpenAI(api_key=API_KEY or "not-needed", base_url=BASE_URL)
    return _client


def _to_openai(messages: list[dict]) -> list[dict]:
    """Convierte el historial neutral (bloques text/tool_use/tool_result) al formato OpenAI."""
    out = []
    for message in messages:
        content = message.get("content")
        if isinstance(content, str):
            out.append({"role": message["role"], "content": content})
            continue
        text_parts, tool_calls, tool_results = [], [], []
        for block in content or []:
            if block.get("type") == "text":
                text_parts.append(block.get("text", ""))
            elif block.get("type") == "tool_use":
                tool_calls.append({
                    "id": block["id"], "type": "function",
                    "function": {"name": block["name"],
                                 "arguments": json.dumps(block.get("input") or {}, ensure_ascii=False)},
                })
            elif block.get("type") == "tool_result":
                tool_results.append({
                    "role": "tool", "tool_call_id": block["tool_use_id"],
                    "content": block.get("content", ""),
                })
        if tool_results:
            out.extend(tool_results)
        else:
            entry = {"role": message["role"], "content": "".join(text_parts) or None}
            if tool_calls:
                entry["tool_calls"] = tool_calls
            out.append(entry)
    return out


def _tools(tools: list[dict]) -> list[dict]:
    return [{
        "type": "function",
        "function": {
            "name": tool["name"], "description": tool.get("description", ""),
            "parameters": tool.get("input_schema") or {"type": "object", "properties": {}},
            "strict": bool(tool.get("strict")),
        },
    } for tool in tools]


async def _openai_turn(*, system: str, tools: list[dict], messages: list[dict],
                       effort: str, max_tokens: int) -> dict:
    response = await client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system}, *_to_openai(messages)],
        tools=_tools(tools),
        tool_choice="auto",
        max_tokens=max_tokens,
        temperature=0.2,
    )
    message = response.choices[0].message
    text = message.content or ""
    calls = [{"id": call.id, "name": call.function.name,
              "input": json.loads(call.function.arguments or "{}")}
             for call in (message.tool_calls or [])]
    content = ([{"type": "text", "text": text}] if text else []) + [
        {"type": "tool_use", "id": call["id"], "name": call["name"], "input": call["input"]}
        for call in calls
    ]
    return {"text": text, "thinking": "", "tool_calls": calls, "content": content}


async def _openai_structured(*, system: str, user: str, schema: dict, effort: str) -> dict:
    response = await client().chat.completions.create(
        model=MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_schema",
                         "json_schema": {"name": "resultado", "strict": True, "schema": schema}},
    )
    return json.loads(response.choices[0].message.content or "{}")


# ---------- interfaz común ----------

async def agent_turn(*, system: str, tools: list[dict], messages: list[dict],
                     effort: str = "low", max_tokens: int = 8000, **_) -> dict:
    if PROVIDER == "anthropic":
        return await _anthropic_turn(system=system, tools=tools, messages=messages,
                                     effort=effort, max_tokens=max_tokens)
    return await _openai_turn(system=system, tools=tools, messages=messages,
                              effort=effort, max_tokens=max_tokens)


async def structured(*, system: str, user: str, schema: dict, effort: str = "medium", **_) -> dict:
    if PROVIDER == "anthropic":
        return await _anthropic_structured(system=system, user=user, schema=schema, effort=effort)
    return await _openai_structured(system=system, user=user, schema=schema, effort=effort)
