import { OpenTelemetry } from "@ai-sdk/otel";
import { register } from "@arizeai/phoenix-otel";
import { registerTelemetry } from "ai";

export const projectName = "mark-learst-agent";
export const phoenixUrl =
  process.env.PHOENIX_COLLECTOR_ENDPOINT ?? "http://localhost:6006";

export const provider = register({
  projectName,
  url: phoenixUrl,
});

registerTelemetry(new OpenTelemetry({ headers: false }));
