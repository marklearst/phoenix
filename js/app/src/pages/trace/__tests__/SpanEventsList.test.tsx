import copy from "copy-to-clipboard";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";
import { PreferencesProvider, ThemeProvider } from "@phoenix/contexts";

import { SpanEventAttributes, SpanEventsListContent } from "../SpanEventsList";
import type { SpanEvent, SpanEventContext } from "../spanEventUtils";

vi.mock("copy-to-clipboard", () => ({ default: vi.fn(async () => true) }));

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

async function renderEvents({
  events,
  context,
}: {
  events: readonly SpanEvent[];
  context?: SpanEventContext;
}) {
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <PreferencesProvider>
          <SpanEventsListContent events={events} context={context} />
        </PreferencesProvider>
      </ThemeProvider>
    );
  });
}

function getEventTrigger() {
  const trigger = container.querySelector<HTMLButtonElement>(
    "button[aria-expanded]"
  );
  expect(trigger).not.toBeNull();
  return trigger!;
}

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

async function renderAttributes({
  name,
  attributes,
}: {
  name: string;
  attributes: unknown;
}) {
  await act(async () => {
    root.render(
      <ThemeProvider themeMode="light" disableBodyTheme>
        <SpanEventAttributes
          event={{
            name,
            message: "",
            timestamp: "2026-08-03T12:00:00.000Z",
            attributes,
          }}
        />
      </ThemeProvider>
    );
  });
}

describe("SpanEventAttributes", () => {
  it("renders an exception stack trace as preformatted text", async () => {
    const stacktrace = [
      "Traceback (most recent call last):",
      '  File "/app/main.py", line 10, in run',
      "    result = 1 / 0",
      "ZeroDivisionError: division by zero",
    ].join("\n");

    await renderAttributes({
      name: "exception",
      attributes: {
        "exception.type": "ZeroDivisionError",
        "exception.message": "division by zero",
        "exception.stacktrace": stacktrace,
      },
    });

    const stacktraceElement = container.querySelector(
      "[data-testid='pre-block']"
    );
    expect(stacktraceElement?.textContent).toBe(stacktrace);
    expect(
      container.querySelector("button[aria-label='Copy stack trace']")
    ).not.toBeNull();
    expect(container.querySelector("table")?.textContent).not.toContain(
      "exception.stacktrace"
    );
    expect(
      container.querySelector("[aria-label='JSON view mode']")
    ).not.toBeNull();
    expect(container.querySelector("table")?.textContent).toContain(
      "exception.type"
    );
  });

  it("uses the shared attribute viewer for non-exception events", async () => {
    await renderAttributes({
      name: "retry",
      attributes: {
        attempt: 2,
        context: '{"reason":"rate limit"}',
      },
    });

    expect(container.querySelector("[data-testid='pre-block']")).toBeNull();
    expect(
      container.querySelector("[aria-label='JSON view mode']")
    ).not.toBeNull();
    expect(container.querySelector("table")?.textContent).toContain("attempt");
    expect(container.querySelector("table")?.textContent).toContain(
      '{"reason":"rate limit"}'
    );
  });

  it("uses the shared attribute viewer when an exception has no stack trace", async () => {
    await renderAttributes({
      name: "exception",
      attributes: { "exception.message": "division by zero" },
    });

    expect(container.querySelector("[data-testid='pre-block']")).toBeNull();
    expect(container.querySelector("table")?.textContent).toContain(
      "exception.message"
    );
  });
});

describe("SpanEventsListContent", () => {
  it("reveals the complete multiline message inside its expanded panel", async () => {
    const message = [
      "The documentation lookup failed after the upstream service returned HTTP 429 Too Many Requests.",
      "The request exceeded the per-minute limit while retrieving the Phoenix installation guide.",
      "Retry in 1.25 seconds, or use the local index to continue without the remote service.",
    ].join("\n");
    await renderEvents({
      events: [
        {
          name: "exception",
          message,
          timestamp: "2026-09-21T10:00:00.240Z",
          attributes: { "exception.type": "RateLimitError" },
        },
      ],
    });
    const trigger = getEventTrigger();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    await act(async () => userEvent.click(trigger));

    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    const panelId = trigger.getAttribute("aria-controls");
    expect(panelId).toBeTruthy();
    const panel = document.getElementById(panelId!);
    expect(panel?.querySelector("pre")?.textContent).toBe(message);
    expect(
      Array.from(panel?.querySelectorAll("h1, h2, h3, h4, h5, h6") ?? []).map(
        (heading) => heading.textContent
      )
    ).not.toContain("Message");
  });

  it("keeps a message-only event enabled and expandable with the keyboard", async () => {
    const message = "The documentation index is temporarily unavailable.";
    await renderEvents({
      events: [
        {
          name: "exception",
          message,
          timestamp: "2026-09-21T10:00:00.240Z",
          attributes: null,
        },
      ],
    });
    const trigger = getEventTrigger();
    expect(trigger.disabled).toBe(false);
    const user = userEvent.setup();

    await act(async () => {
      await user.tab();
      await user.keyboard("{Enter}");
    });

    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(container.querySelector("pre")?.textContent).toBe(message);
    expect(container.querySelector("table")).toBeNull();

    await act(async () => user.keyboard("{Enter}"));

    expect(trigger.getAttribute("aria-expanded")).toBe("false");
  });

  it("copies an event with no payload without adding a disclosure", async () => {
    await renderEvents({
      events: [
        {
          name: "checkpoint.reached",
          message: "",
          timestamp: "2026-09-21T10:00:00.035Z",
          attributes: {},
        },
      ],
    });

    const item = container.querySelector("ol[aria-label='Span events'] > li");
    expect(item?.textContent).toContain("checkpoint.reached");
    expect(item?.querySelector("time")?.dateTime).toBe(
      "2026-09-21T10:00:00.035Z"
    );
    expect(item?.querySelector("button[aria-expanded]")).toBeNull();
    const copyButton = item?.querySelector<HTMLButtonElement>(
      "button[aria-label='Copy event checkpoint.reached']"
    );
    expect(copyButton).not.toBeNull();

    await act(async () => userEvent.click(copyButton!));

    expect(copy).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(copy).mock.calls[0][0])).toEqual({
      name: "checkpoint.reached",
      message: "",
      timestamp: "2026-09-21T10:00:00.035Z",
      attributes: {},
    });
    expect(item?.querySelector("button[aria-expanded]")).toBeNull();
    expect(document.activeElement).toBe(copyButton);
  });

  it("preserves the supplied event sequence in an ordered list", async () => {
    const events = [
      { name: "cache.lookup", timestamp: "2026-09-21T10:00:00.035Z" },
      { name: "exception", timestamp: "2026-09-21T10:00:00.240Z" },
      { name: "retry.scheduled", timestamp: "2026-09-21T10:00:00.260Z" },
      { name: "fallback.used", timestamp: "2026-09-21T10:00:01.525Z" },
    ].map((event) => ({ ...event, message: "", attributes: null }));
    await renderEvents({ events });

    const list = container.querySelector("ol[aria-label='Span events']");
    expect(list).not.toBeNull();
    const items = Array.from(list!.children);
    expect(items).toHaveLength(events.length);
    expect(items.map((item) => item.tagName)).toEqual(["LI", "LI", "LI", "LI"]);
    expect(items.map((item) => item.querySelector("time")?.dateTime)).toEqual(
      events.map((event) => event.timestamp)
    );
    items.forEach((item, index) => {
      expect(item.textContent).toContain(events[index].name);
    });
  });

  it("copies the full diagnostic and trace context without expanding the event", async () => {
    const message =
      "The remote lookup failed.\nThe local index remains available.";
    const stacktrace =
      "TypeError: documents is undefined\n    at documentLookup (lookup.ts:48:24)";
    const timestamp = "2026-09-21T12:00:00.240+02:00";
    await renderEvents({
      events: [
        {
          name: "exception",
          message,
          timestamp,
          attributes: {
            "exception.message": message,
            "exception.stacktrace": stacktrace,
            "retry.attempt": 2,
            "request.id": "request-4821",
          },
        },
      ],
      context: {
        spanName: "document.lookup",
        spanId: "45e2efef166316de",
        traceId: "3b0c667952fd1ebbe426ab6683a201bc",
      },
    });

    const trigger = getEventTrigger();
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    const copyButton = container.querySelector<HTMLButtonElement>(
      "button[aria-label='Copy event exception']"
    );
    expect(copyButton).not.toBeNull();
    expect(trigger.contains(copyButton)).toBe(false);

    await act(async () => userEvent.click(copyButton!));

    expect(copy).toHaveBeenCalledOnce();
    expect(JSON.parse(vi.mocked(copy).mock.calls[0][0])).toEqual({
      name: "exception",
      message,
      timestamp,
      attributes: {
        "exception.message": message,
        "exception.stacktrace": stacktrace,
        "retry.attempt": 2,
        "request.id": "request-4821",
      },
      context: {
        spanName: "document.lookup",
        spanId: "45e2efef166316de",
        traceId: "3b0c667952fd1ebbe426ab6683a201bc",
      },
    });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(copyButton);
  });

  it.each([
    { copied: true, status: "Copied to clipboard." },
    {
      copied: false,
      status: "Could not copy. Select the text and copy it manually.",
    },
  ])(
    "preserves the expanded event and keyboard focus when copying resolves to $copied",
    async ({ copied, status }) => {
      vi.mocked(copy).mockResolvedValueOnce(copied);
      await renderEvents({
        events: [
          {
            name: "exception",
            message: "The remote lookup failed.\nUse the local index.",
            timestamp: "2026-09-21T10:00:00.240Z",
            attributes: null,
          },
        ],
      });
      const trigger = getEventTrigger();
      const copyButton = container.querySelector<HTMLButtonElement>(
        "button[aria-label='Copy event exception']"
      );
      expect(copyButton).not.toBeNull();
      const user = userEvent.setup();

      await act(async () => {
        await user.tab();
        await user.keyboard("{Enter}");
        await user.tab();
      });

      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(copyButton);

      await act(async () => user.keyboard(" "));

      expect(copy).toHaveBeenCalledOnce();
      expect(container.querySelector("[role='status']")?.textContent).toBe(
        status
      );
      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(document.activeElement).toBe(copyButton);
      expect(container.querySelector("pre")?.textContent).toBe(
        "The remote lookup failed.\nUse the local index."
      );
    }
  );
});
