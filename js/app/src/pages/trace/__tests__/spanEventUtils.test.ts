import { describe, expect, it } from "vitest";

import { formatSpanEvent, getSpanEventDetails } from "../spanEventUtils";

const event = {
  name: "exception",
  timestamp: "2026-09-21T10:00:00.025Z",
  message: "The lookup failed.\nTry again after 30 seconds.",
  attributes: {
    "exception.type": "RateLimitError",
    "exception.message": "The lookup failed.\nTry again after 30 seconds.",
    "exception.stacktrace":
      "RateLimitError: lookup failed\n    at lookup (tools.ts:12)",
    attempt: 2,
  },
};

describe("getSpanEventDetails", () => {
  it("separates readable diagnostics without repeating them in attributes", () => {
    expect(getSpanEventDetails(event)).toEqual({
      message: event.message,
      stacktrace: event.attributes["exception.stacktrace"],
      attributes: { "exception.type": "RateLimitError", attempt: 2 },
      hasAttributes: true,
    });
    expect(event.attributes).toHaveProperty("exception.message", event.message);
  });

  it("preserves a different attribute message rather than silently dropping it", () => {
    const details = getSpanEventDetails({ ...event, message: "A summary" });
    expect(details.attributes).toHaveProperty(
      "exception.message",
      event.message
    );
  });

  it("does not interpret exception-shaped attributes on an ordinary event", () => {
    const details = getSpanEventDetails({ ...event, name: "checkpoint" });
    expect(details.stacktrace).toBeNull();
    expect(details.attributes).toEqual(event.attributes);
  });

  it.each([null, undefined, {}])(
    "handles absent attributes (%s)",
    (attributes) => {
      expect(getSpanEventDetails({ ...event, attributes })).toMatchObject({
        message: event.message,
        stacktrace: null,
        hasAttributes: false,
      });
    }
  );

  it.each([null, 42, ""])(
    "preserves an unusable stack trace (%s) in attributes",
    (stacktrace) => {
      const details = getSpanEventDetails({
        ...event,
        attributes: { "exception.stacktrace": stacktrace },
      });
      expect(details.stacktrace).toBeNull();
      expect(details.attributes).toEqual({
        "exception.stacktrace": stacktrace,
      });
    }
  );
});

describe("formatSpanEvent", () => {
  it("round-trips the complete recorded event, raw exception attributes, and context", () => {
    const context = {
      spanName: "document.lookup",
      spanId: "span-123",
      traceId: "trace-456",
    };
    const text = formatSpanEvent({ event, context });

    expect(JSON.parse(text)).toEqual({ ...event, context });
    expect(text).toContain('\n  "name": "exception",');
  });

  it("round-trips escaped text and nested JSON values without display extraction", () => {
    const recordedEvent = {
      ...event,
      timestamp: "2026-09-21T12:00:00.025+02:00",
      message: 'Could not open "C:\\documents\\guide.txt".\nRetry the lookup.',
      attributes: {
        ...event.attributes,
        "exception.message":
          'Original error: "file not found".\nPath: C:\\documents',
        retryable: true,
        duration: 1.25,
        details: {
          paths: ["C:\\documents", "/tmp/guide"],
          cached: false,
          result: null,
        },
      },
    };

    expect(JSON.parse(formatSpanEvent({ event: recordedEvent }))).toEqual(
      recordedEvent
    );
  });

  it.each([null, {}])(
    "preserves metadata-only event fields without context (%s)",
    (attributes) => {
      const recordedEvent = {
        name: "checkpoint.reached",
        timestamp: event.timestamp,
        message: "",
        attributes,
      };
      const parsed = JSON.parse(formatSpanEvent({ event: recordedEvent }));

      expect(parsed).toEqual(recordedEvent);
      expect(parsed).not.toHaveProperty("context");
    }
  );
});
