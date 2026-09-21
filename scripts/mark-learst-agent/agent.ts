import { createOpenAI } from "@ai-sdk/openai";
import { trace } from "@opentelemetry/api";
import { stepCountIs, tool, ToolLoopAgent } from "ai";
import { z } from "zod";

import { divideNumbers } from "./calculator.js";
import { phoenixUrl, projectName, provider } from "./instrumentation.js";

try {
  const baseUrl = process.env.OPENAI_BASE_URL ?? "http://127.0.0.1:11434/v1";
  const isLocalEndpoint = ["localhost", "127.0.0.1", "[::1]"].includes(
    new URL(baseUrl).hostname
  );
  if (!isLocalEndpoint && !process.env.OPENAI_API_KEY?.trim()) {
    throw new Error(
      "Set OPENAI_API_KEY in .env to use a hosted model endpoint."
    );
  }
  const modelProvider = createOpenAI({
    baseURL: baseUrl,
    apiKey: isLocalEndpoint ? "local" : process.env.OPENAI_API_KEY,
  });

  const isErrorDemo = process.argv.includes("--demo-error");
  const prompt = isErrorDemo
    ? "Use the calculator to divide 84 by 0. Explain any error and ask for corrected input."
    : "Use the calculator to divide 84 by 7 and briefly explain the result.";
  let toolExecutionCount = 0;

  const agent = new ToolLoopAgent({
    model: modelProvider.chat(process.env.OPENAI_MODEL ?? "qwen3:1.7b"),
    instructions:
      "Call divide once using exactly the numbers requested by the user. " +
      "Always call the tool, including for zero: input validation belongs to the tool. " +
      "Then explain its result or error briefly. Never retry or invent a replacement operand.",
    tools: {
      divide: tool({
        description:
          "Run a local division calculation on the two supplied numbers. " +
          "The tool validates inputs and returns the quotient or raises an error.",
        inputSchema: z.object({
          numerator: z.number(),
          denominator: z.number(),
        }),
        execute: async (operands) => {
          toolExecutionCount += 1;
          const spanContext = trace.getActiveSpan()?.spanContext();
          if (spanContext) {
            process.stdout.write(`Trace ID: ${spanContext.traceId}\n`);
            process.stdout.write(`Tool span ID: ${spanContext.spanId}\n`);
          }
          // AI SDK telemetry records thrown errors on this tool span automatically.
          return { quotient: divideNumbers(operands) };
        },
      }),
    },
    // The first step must exercise the tool; the next step can only explain it.
    prepareStep: ({ stepNumber }) => ({
      toolChoice: stepNumber === 0 ? "required" : "none",
      activeTools: stepNumber === 0 ? ["divide"] : [],
    }),
    providerOptions: { openai: { parallelToolCalls: false } },
    stopWhen: stepCountIs(3),
    maxOutputTokens: 256,
    maxRetries: 0,
  });

  process.stdout.write(`Prompt: ${prompt}\n`);
  const result = await agent.generate({ prompt, timeout: 30_000 });
  if (toolExecutionCount !== 1) {
    throw new Error(
      `Expected one local tool execution; received ${toolExecutionCount}.`
    );
  }
  process.stdout.write(`Response: ${result.text}\n`);
  process.stdout.write(`Steps: ${result.steps.length}\n`);
  const projectUrl = new URL(
    `/redirects/projects/${encodeURIComponent(projectName)}`,
    phoenixUrl
  );
  process.stdout.write(`Verify the trace in Phoenix: ${projectUrl}\n`);
} catch (error) {
  const message =
    error instanceof Error ? error.message : "The agent run failed.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
} finally {
  // Short-lived scripts must flush queued spans, including failed runs.
  await provider.shutdown();
}
