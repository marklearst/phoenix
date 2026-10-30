# Traced calculator agent

A minimal AI SDK `ToolLoopAgent` with one local `divide` tool. A language model
chooses the operands, the local function calculates the quotient, and the model
explains the result. Phoenix receives the agent, model, and tool spans through
OpenInference. The default uses real local inference with Qwen3 through an
OpenAI-compatible server; no paid API key is required.

Adapted from the repository's [AI SDK agent example](../../js/examples/apps/ai-sdk-agent)
and [tracing guide](https://arize.com/docs/phoenix/integrations/typescript/vercel/vercel-ai-sdk-tracing-js).

## Run

Requires Node.js 22.12+, pnpm, Phoenix at `http://localhost:6006`, and a running
OpenAI-compatible model server at `http://127.0.0.1:11434/v1` serving `qwen3:1.7b`.
Follow [DEVELOPMENT.md](../../DEVELOPMENT.md) for Phoenix setup.

For local inference, download the official
[Qwen3-1.7B Q8_0 model](https://huggingface.co/Qwen/Qwen3-1.7B-GGUF) and run a
tool-capable [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md):

```sh
llama-server -m /path/to/Qwen3-1.7B-Q8_0.gguf \
  --host 127.0.0.1 --port 11434 --alias qwen3:1.7b \
  --ctx-size 8192 --parallel 1 --jinja --reasoning off \
  --cors-origins localhost --no-cors-credentials --no-webui --offline
```

The verified run used the portable `llama-server` included in the official
[Ollama 0.34.2 macOS archive](https://github.com/ollama/ollama/releases/tag/v0.34.2).
The model download is approximately 1.83 GB and stays outside this repository.

```sh
cd scripts/mark-learst-agent
make install
cp .env.example .env
# Adjust the model endpoint in .env if needed. The file is ignored by Git.
make check
make run
```

The script loads `.env`; existing shell variables take precedence.
`PHOENIX_COLLECTOR_ENDPOINT` defaults to `http://localhost:6006`; set
`PHOENIX_API_KEY` only if your local Phoenix server requires it. Local model
requests use a placeholder credential, never an OpenAI key.

To use OpenAI instead, set `OPENAI_BASE_URL=https://api.openai.com/v1`,
`OPENAI_MODEL=gpt-4o-mini`, and `OPENAI_API_KEY` in `.env`. Hosted OpenAI runs incur
API usage charges. Both modes use AI SDK's OpenAI Chat Completions adapter.

The normal run asks for `84 / 7`, which returns `12`. `make demo-error` asks for
`84 / 0`: the tool throws a multiline `RangeError`, then the model explains the
failure and requests corrected input. The diagnostic is intentionally generated
to exercise Phoenix's event details, not a failure in Phoenix itself.

Both runs require one tool call first, disable tools afterward, allow at most
three steps, cap each model response at 256 tokens, and disable API retries. The
whole run has a 30-second timeout. AI SDK telemetry records the exception message
and stack automatically. Request headers are excluded; telemetry is flushed in
`finally`, including when a run fails.

## Verify the trace

The script prints the trace ID, tool span ID, and a link to the `mark-learst-agent`
project. Open the trace in Phoenix and check the model and tool spans. For the
diagnostic run, open the failed `divide` span's Events tab to inspect the full
exception message and stack. A console response alone does not prove ingestion.

See [EVIDENCE.md](./EVIDENCE.md) for the verified local trace.
The calculator tests run without an API key and cover valid calculations, zero
divisors, nonfinite inputs, and overflow.
