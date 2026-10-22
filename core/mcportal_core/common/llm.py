"""Capa de LLM independiente del proveedor (sección 7.10).

El resto del core solo usa cuatro cosas de este módulo: `available()`, `Conversation`
(agente explorador con herramientas), `agent_turn` (un turno suelto) y `structured`
(salida JSON validada contra un esquema).

Proveedores soportados hoy: `openai`, `openai_compatible` (cualquier API compatible con
`base_url`) y `anthropic`. Se eligen con `MCPORTAL_LLM_PROVIDER`; el modelo con
`MCPORTAL_MODEL`; la clave con `MCPORTAL_LLM_API_KEY` o la variable estándar del proveedor.

Sin clave (o sin SDK instalado) `available()` es False y el core debe seguir en modo
determinista: nunca se lanza una excepción por no tener LLM configurado.
"""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from typing import Any, Iterable, Sequence

MAX_OUTPUT_TOKENS_AGENT = 8000
MAX_OUTPUT_TOKENS_STRUCTURED = 16000

PROVIDER_ENV = "MCPORTAL_LLM_PROVIDER"
MODEL_ENV = "MCPORTAL_MODEL"
KEY_ENV = "MCPORTAL_LLM_API_KEY"
BASE_URL_ENV = "MCPORTAL_LLM_BASE_URL"

DEFAULT_MODELS = {
    "openai": "gpt-5",
    "openai_compatible": "gpt-5",
    "anthropic": "",  # se exige MCPORTAL_MODEL: los nombres cambian por versión
}
STANDARD_KEY_VARS = {
    "openai": ("OPENAI_API_KEY",),
    "openai_compatible": ("OPENAI_API_KEY",),
    "anthropic": ("ANTHROPIC_API_KEY",),
}
REASONING_PREFIXES = ("o1", "o3", "o4", "gpt-5")


class LLMError(RuntimeError):
    """Error del proveedor (red, cuota, rechazo del modelo o respuesta inválida)."""


class LLMUnavailable(LLMError):
    """No hay proveedor configurado o falta el SDK/la clave."""


@dataclass
class ToolCall:
    id: str
    name: str
    arguments: dict[str, Any]
    raw_arguments: str = ""


@dataclass
class AgentTurn:
    text: str = ""
    reasoning: str = ""
    calls: list[ToolCall] = field(default_factory=list)


def provider() -> str:
    return (os.environ.get(PROVIDER_ENV) or "openai").strip().lower()


def model(name: str | None = None) -> str:
    if name:
        return name
    env = os.environ.get(MODEL_ENV)
    if env:
        return env
    return DEFAULT_MODELS.get(provider(), "")


def api_key() -> str | None:
    explicit = os.environ.get(KEY_ENV)
    if explicit:
        return explicit
    for var in STANDARD_KEY_VARS.get(provider(), ()):
        if os.environ.get(var):
            return os.environ[var]
    return None


def available(name: str | None = None) -> bool:
    """¿Hay clave y SDK para el proveedor configurado?"""
    if not api_key() or not model(name):
        return False
    try:
        _sdk()
    except LLMUnavailable:
        return False
    return True


def _sdk() -> Any:
    name = provider()
    if name in ("openai", "openai_compatible"):
        try:
            import openai
        except ImportError as exc:  # pragma: no cover - depende del entorno
            raise LLMUnavailable("falta el SDK: pip install openai") from exc
        return openai
    if name == "anthropic":
        try:
            import anthropic
        except ImportError as exc:  # pragma: no cover
            raise LLMUnavailable("falta el SDK: pip install anthropic") from exc
        return anthropic
    raise LLMUnavailable(f"proveedor de LLM no soportado: {name!r}")


def _normalise_effort(effort: str | None) -> str:
    effort = (effort or "low").lower()
    return effort if effort in ("low", "medium", "high") else "low"


def _parse_arguments(raw: str | None) -> dict[str, Any]:
    if not raw:
        return {}
    try:
        value = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise LLMError(f"argumentos de herramienta no son JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise LLMError("argumentos de herramienta no son un objeto JSON")
    return value


def _validate(data: Any, schema: dict[str, Any]) -> None:
    try:
        import jsonschema
    except ImportError:  # validación mínima si falta la librería
        if schema.get("type") == "object" and not isinstance(data, dict):
            raise LLMError("la respuesta no es un objeto JSON")
        required = schema.get("required") or []
        missing = [k for k in required if k not in (data or {})]
        if missing:
            raise LLMError(f"faltan campos obligatorios: {missing}")
        return
    try:
        jsonschema.validate(data, schema)
    except jsonschema.ValidationError as exc:
        raise LLMError(f"respuesta fuera de esquema: {exc.message}") from exc


class Conversation:
    """Conversación con herramientas sobre el proveedor configurado.

    Guarda el historial en el formato nativo del proveedor (incluidos los bloques de
    razonamiento), que es lo que exigen algunos modelos para poder continuar.
    """

    def __init__(
        self,
        system: str,
        tools: Sequence[dict[str, Any]] | None = None,
        effort: str = "low",
        model_name: str | None = None,
        max_tokens: int = MAX_OUTPUT_TOKENS_AGENT,
        tool_choice: dict[str, Any] | None = None,
    ) -> None:
        if not available(model_name):
            raise LLMUnavailable(
                "LLM no configurado: define MCPORTAL_LLM_API_KEY y MCPORTAL_MODEL (o usa el modo determinista)"
            )
        self.provider = provider()
        self.model = model(model_name)
        self.system = system
        self.tools = list(tools or [])
        self.effort = _normalise_effort(effort)
        self.max_tokens = max_tokens
        self.tool_choice = tool_choice
        self.messages: list[dict[str, Any]] = []
        self._raw_messages: list[Any] = []

    # ---------------------------------------------------------------- envío
    def send(self, content: str) -> AgentTurn:
        if self.provider in ("openai", "openai_compatible"):
            return self._send_openai(content)
        if self.provider == "anthropic":
            return self._send_anthropic(content)
        raise LLMUnavailable(f"proveedor no soportado: {self.provider}")

    def add_tool_results(self, results: Iterable[tuple[str, str]]) -> None:
        """Añade los resultados de las herramientas del último turno.

        `results` son pares `(tool_call_id, texto)`.
        """
        items = list(results)
        if self.provider in ("openai", "openai_compatible"):
            for call_id, text in items:
                self.messages.append({"role": "tool", "tool_call_id": call_id, "content": text})
        elif self.provider == "anthropic":
            self.messages.append({
                "role": "user",
                "content": [
                    {"type": "tool_result", "tool_use_id": call_id, "content": text}
                    for call_id, text in items
                ],
            })

    # ----------------------------------------------------------------- openai
    def _openai_client(self) -> Any:
        sdk = _sdk()
        kwargs: dict[str, Any] = {"api_key": api_key()}
        base_url = os.environ.get(BASE_URL_ENV)
        if base_url:
            kwargs["base_url"] = base_url
        return sdk.OpenAI(**kwargs)

    def _send_openai(self, content: str) -> AgentTurn:
        client = self._openai_client()
        self.messages.append({"role": "user", "content": content})
        payload: dict[str, Any] = {
            "model": self.model,
            "messages": [{"role": "system", "content": self.system}, *self.messages],
        }
        if self.tools:
            payload["tools"] = [
                {
                    "type": "function",
                    "function": {
                        "name": tool["name"],
                        "description": tool.get("description", ""),
                        "parameters": tool.get("input_schema") or {"type": "object", "properties": {}},
                        "strict": True,
                    },
                }
                for tool in self.tools
            ]
            payload["tool_choice"] = "auto"
        if self.model.startswith(REASONING_PREFIXES):
            payload["reasoning_effort"] = self.effort
            payload["max_completion_tokens"] = self.max_tokens
        else:
            payload["max_tokens"] = self.max_tokens
        try:
            response = client.chat.completions.create(**payload)
        except Exception as exc:  # el SDK lanza tipos distintos por proveedor
            raise LLMError(f"error del proveedor: {exc}") from exc
        return self._parse_openai(response)

    def _parse_openai(self, response: Any) -> AgentTurn:
        if not getattr(response, "choices", None):
            raise LLMError("respuesta sin opciones")
        message = response.choices[0].message
        text = message.content or ""
        reasoning = getattr(message, "reasoning_content", None) or ""
        calls = [
            ToolCall(
                id=call.id or f"call_{index}",
                name=call.function.name,
                arguments=_parse_arguments(call.function.arguments),
                raw_arguments=call.function.arguments or "",
            )
            for index, call in enumerate(getattr(message, "tool_calls", None) or [])
        ]
        # se conserva la respuesta completa del asistente, incluidos tool_calls
        self.messages.append(message.model_dump(exclude_none=True))
        return AgentTurn(text=text, reasoning=reasoning, calls=calls)

    # -------------------------------------------------------------- anthropic
    def _send_anthropic(self, content: str) -> AgentTurn:
        sdk = _sdk()
        client = sdk.Anthropic(api_key=api_key())
        self.messages.append({"role": "user", "content": content})
        payload: dict[str, Any] = {
            "model": self.model,
            "max_tokens": self.max_tokens,
            "system": [{"type": "text", "text": self.system, "cache_control": {"type": "ephemeral"}}],
            "messages": self.messages,
        }
        if self.tools:
            payload["tools"] = [
                {
                    "name": tool["name"],
                    "description": tool.get("description", ""),
                    "input_schema": tool.get("input_schema") or {"type": "object", "properties": {}},
                }
                for tool in self.tools
            ]
            if self.tool_choice:
                payload["tool_choice"] = self.tool_choice
        try:
            response = client.messages.create(**payload)
        except Exception as exc:
            raise LLMError(f"error del proveedor: {exc}") from exc
        return self._parse_anthropic(response)

    def _parse_anthropic(self, response: Any) -> AgentTurn:
        blocks = list(getattr(response, "content", []) or [])
        texts, reasoning, calls = [], [], []
        for block in blocks:
            kind = getattr(block, "type", None)
            if kind == "text":
                texts.append(block.text)
            elif kind in ("thinking", "redacted_thinking"):
                raw = getattr(block, "thinking", None) or getattr(block, "data", None) or ""
                if isinstance(raw, str) and raw:
                    reasoning.append(raw)
            elif kind == "tool_use":
                calls.append(ToolCall(id=block.id, name=block.name, arguments=dict(block.input or {})))
        self.messages.append({
            "role": "assistant",
            "content": [block.model_dump(exclude_none=True) for block in blocks],
        })
        return AgentTurn(text="\n".join(texts).strip(), reasoning="\n".join(reasoning).strip(), calls=calls)


def agent_turn(
    system: str,
    tools: Sequence[dict[str, Any]],
    messages: Sequence[dict[str, Any]],
    effort: str = "low",
) -> AgentTurn:
    """Un turno suelto sin estado (útil en pruebas y scripts)."""
    conversation = Conversation(system=system, tools=tools, effort=effort)
    turn = AgentTurn()
    for message in messages:
        role = message.get("role")
        if role == "user":
            turn = conversation.send(str(message.get("content", "")))
    return turn


def structured(
    system: str,
    user: str,
    schema: dict[str, Any],
    effort: str = "medium",
    model_name: str | None = None,
) -> dict[str, Any]:
    """Una respuesta JSON válida contra `schema` (esquema estricto)."""
    conversation = Conversation(
        system=system,
        effort=effort,
        model_name=model_name,
        max_tokens=MAX_OUTPUT_TOKENS_STRUCTURED,
    )
    if conversation.provider in ("openai", "openai_compatible"):
        client = conversation._openai_client()  # noqa: SLF001 - mismo módulo
        payload: dict[str, Any] = {
            "model": conversation.model,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}],
            "response_format": {
                "type": "json_schema",
                "json_schema": {"name": "respuesta", "schema": schema, "strict": True},
            },
        }
        if conversation.model.startswith(REASONING_PREFIXES):
            payload["reasoning_effort"] = conversation.effort
            payload["max_completion_tokens"] = conversation.max_tokens
        else:
            payload["max_tokens"] = conversation.max_tokens
        try:
            response = client.chat.completions.create(**payload)
        except Exception as exc:
            raise LLMError(f"error del proveedor: {exc}") from exc
        raw = response.choices[0].message.content or ""
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise LLMError(f"respuesta no es JSON: {exc}") from exc
        _validate(data, schema)
        return data

    if conversation.provider == "anthropic":
        # Algunos modelos (Sonnet 5.5 entre ellos) rechazan forzar tool_choice:
        # se pide la herramienta en el prompt y se reintenta si contesta en texto.
        conversation.tools = [{
            "name": "responder",
            "description": "Devuelve la respuesta estructurada solicitada.",
            "input_schema": schema,
        }]
        prompt = f"{user}\n\nDevuelve el resultado llamando a la herramienta `responder`."
        turn = conversation.send(prompt)
        for attempt in range(2):
            if turn.calls:
                _validate(turn.calls[0].arguments, schema)
                return turn.calls[0].arguments
            turn = conversation.send(
                "No has llamado a la herramienta. Devuelve ahora el resultado llamando a `responder`.")
        raise LLMError("el modelo no devolvió la respuesta estructurada")

    raise LLMUnavailable(f"proveedor no soportado: {conversation.provider}")
