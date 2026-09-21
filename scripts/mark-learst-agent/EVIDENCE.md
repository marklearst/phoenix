# Local trace evidence

Verified against local Phoenix on September 21, 2026. These are real model
requests to a local Qwen3-1.7B Q8_0 model through `llama-server`, followed by local
tool execution. No model responses or spans were mocked.

## Successful calculation

Command: `make run`

- Phoenix project: `mark-learst-agent` (`UHJvamVjdDoz`)
- Trace ID: `777588b58ef54d44d058a5926a1e676c`
- Tool span ID: `0a17dc00404b5624`
- Tool input: `{"numerator":84,"denominator":7}`
- Tool result: `{"quotient":12}`
- Two model steps; one tool execution.

The Phoenix REST endpoint
`GET /v1/projects/mark-learst-agent/spans?limit=20` returned six spans sharing this
trace ID: one `AGENT`, two `LLM`, two `CHAIN`, and one `TOOL`, all with `OK` status.
The tool's recorded output contained the quotient `12`; the model's final
response was: "The result of dividing 84 by 7 is 12."

## Diagnostic tool failure

Command: `make demo-error`

- Trace ID: `2c7b131ab8dd9ba0f2eee3d6d8c9ef3e`
- Tool span ID: `ced3b889a5db33cc`
- Tool input: `{"numerator":84,"denominator":0}`
- Two model steps; one tool execution.

Phoenix returned six spans for this trace. The `execute_tool divide` span had
`ERROR` status and an `exception` event containing `exception.type=RangeError`,
the complete multiline `exception.message`, and `exception.stacktrace`:

```text
Cannot divide by zero: the calculator needs a nonzero denominator.
Received numerator=84, denominator=0.
No result was produced. Ask for a nonzero denominator before calculating again.
```

The model explained that division by zero is undefined and requested a nonzero
denominator. The script completed successfully; the tool failure was intentional.
Use this trace's failed tool span to inspect the event-details UI.

## Interpretation

The telemetry provider field says `openai` because the application uses AI SDK's
OpenAI-compatible Chat Completions adapter. The model runs locally at
`http://127.0.0.1:11434/v1`; this evidence does not claim use of a hosted OpenAI model.

Local trace IDs refer to this development database. A new run prints new IDs.

## Offline verification

`make check` passed TypeScript checking and three calculator tests covering
valid arithmetic, positive and negative zero divisors, nonfinite operands, and
numeric overflow. These tests do not require a model or Phoenix.
