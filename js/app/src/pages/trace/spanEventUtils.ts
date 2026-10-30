import { isPlainObject } from "@phoenix/utils/jsonUtils";

export type SpanEvent = {
  name: string;
  message: string;
  timestamp: string;
  attributes: unknown;
};

export type SpanEventContext = {
  spanName: string;
  spanId: string;
  traceId: string;
};

/** Separate readable exception content while preserving every other attribute. */
export function getSpanEventDetails(event: SpanEvent) {
  const isException = event.name === "exception";
  const sourceAttributes = event.attributes;
  const candidateStacktrace =
    isException && isPlainObject(sourceAttributes)
      ? sourceAttributes["exception.stacktrace"]
      : null;
  const stacktrace =
    typeof candidateStacktrace === "string" && candidateStacktrace.length > 0
      ? candidateStacktrace
      : null;
  const attributes =
    isException && isPlainObject(sourceAttributes)
      ? Object.fromEntries(
          Object.entries(sourceAttributes).filter(([key, value]) => {
            const isRenderedStacktrace =
              key === "exception.stacktrace" && stacktrace !== null;
            const isRenderedMessage =
              key === "exception.message" &&
              event.message.length > 0 &&
              value === event.message;
            return !isRenderedStacktrace && !isRenderedMessage;
          })
        )
      : sourceAttributes;
  const hasAttributes =
    attributes != null &&
    (typeof attributes !== "object" || Object.keys(attributes).length > 0);

  return { message: event.message, stacktrace, attributes, hasAttributes };
}

/**
 * Serialize the complete recorded event as JSON for a debugging handoff.
 * @param params - Event and the span it belongs to.
 * @param params.event - The complete recorded event.
 * @param params.context - Identifiers that let a teammate locate the same trace.
 */
export function formatSpanEvent({
  event,
  context,
}: {
  event: SpanEvent;
  context?: SpanEventContext;
}): string {
  return JSON.stringify({ ...event, ...(context ? { context } : {}) }, null, 2);
}
