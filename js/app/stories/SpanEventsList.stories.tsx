import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { userEvent, within } from "storybook/test";

import { SpanEventsListContent } from "../src/pages/trace/SpanEventsList";
import { SpanEventsListBefore } from "./fixtures/SpanEventsListBefore";

const meta = {
  title: "Trace/Span events",
  component: SpanEventsListContent,
  parameters: { width: "600px" },
  args: {
    context: {
      spanName: "document.lookup",
      spanId: "b047f495d8d24f63",
      traceId: "a04350f8207b4f61a9103c7ae4195ae3",
    },
    events: [
      {
        name: "cache.lookup",
        timestamp: "2026-09-21T10:00:00.035Z",
        message: "",
        attributes: { query: "Phoenix installation", hit: false },
      },
      {
        name: "exception",
        timestamp: "2026-09-21T10:00:00.240Z",
        message:
          "The documentation search returned 429 Too Many Requests.\nRetry after 30 seconds, or use the cached installation guide.",
        attributes: {
          "exception.type": "RateLimitError",
          "exception.message":
            "The documentation search returned 429 Too Many Requests.\nRetry after 30 seconds, or use the cached installation guide.",
          "exception.stacktrace":
            "RateLimitError: Too Many Requests\n    at searchDocuments (tools/search.ts:42:11)\n    at execute (tools/lookup.ts:18:20)",
        },
      },
      {
        name: "fallback.used",
        timestamp: "2026-09-21T10:00:01.525Z",
        message: "",
        attributes: { source: "local index", documentCount: 4 },
      },
    ],
  },
} satisfies Meta<typeof SpanEventsListContent>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Narrow: Story = { parameters: { width: "320px" } };
export const LongContent: Story = {
  parameters: { width: "320px" },
  args: {
    events: [
      {
        name: "exception",
        timestamp: "2026-09-21T10:00:00.240Z",
        message: `Request failed for document ${"document_identifier_".repeat(20)}.\nThe complete identifier must remain readable and copyable.`,
        attributes: {
          "exception.stacktrace": `Error: request failed\n${Array.from({ length: 24 }, (_, index) => `    at handler${index} (src/tools/search.ts:${index + 10}:5)`).join("\n")}`,
        },
      },
    ],
  },
};
export const LongEventName: Story = {
  parameters: { width: "320px" },
  args: {
    events: [
      {
        ...meta.args.events[0],
        name: "document.lookup.retry_exhausted_for_requested_document",
      },
    ],
  },
};
export const MessageOnly: Story = {
  args: {
    events: [
      {
        name: "notice",
        message: "A complete message without attributes.",
        timestamp: "2026-09-21T10:00:00.000Z",
        attributes: null,
      },
    ],
  },
};
export const MetadataOnly: Story = {
  args: {
    events: [
      {
        name: "cache.invalidated",
        timestamp: "2026-09-21T10:00:00.000Z",
        message: "",
        attributes: null,
      },
    ],
  },
};
export const Empty: Story = { args: { events: [] } };

/** Synthetic lookup with four failed attempts and a successful local fallback. */
export const TwentyEvents: Story = {
  name: "20 events",
  args: {
    events: [0, 1510, 4270, 9530].flatMap((startOffset, index) => {
      const attempt = index + 1;
      const timestamp = (offset: number) =>
        new Date(
          Date.UTC(2026, 8, 21, 10) + startOffset + offset
        ).toISOString();
      const requestId = `synthetic-document-lookup-attempt-${attempt}`;
      const message = [
        `Documentation search attempt ${attempt} returned HTTP 429 Too Many Requests.`,
        `The remote index could not retrieve the Phoenix installation guide for request ${requestId}.`,
        attempt < 4
          ? "The lookup will retry after the scheduled backoff."
          : "The retry budget is exhausted. Continue with the local installation guide.",
      ].join("\n");

      return [
        {
          name: "attempt.started",
          timestamp: timestamp(0),
          message: "",
          attributes: null,
        },
        {
          name: "cache.lookup",
          timestamp: timestamp(35),
          message: "",
          attributes: {
            query: "Phoenix installation",
            hit: false,
            attempt,
          },
        },
        {
          name: "request.started",
          timestamp: timestamp(60),
          message: "",
          attributes: {
            "http.request.method": "GET",
            "url.path": "/documents/search",
            "request.id": requestId,
            attempt,
          },
        },
        {
          name: "exception",
          timestamp: timestamp(240),
          message,
          attributes: {
            "exception.type": "RateLimitError",
            "exception.message": message,
            "exception.stacktrace":
              "RateLimitError: Too Many Requests\n    at searchDocuments (tools/search.ts:42:11)\n    at execute (tools/lookup.ts:18:20)",
            "request.id": requestId,
            "retry.attempt": attempt,
          },
        },
        attempt < 4
          ? {
              name: "retry.scheduled",
              timestamp: timestamp(260),
              message: "",
              attributes: {
                "backoff.ms": [1250, 2500, 5000][index],
                "next.attempt": attempt + 1,
              },
            }
          : {
              name: "fallback.used",
              timestamp: timestamp(260),
              message: "",
              attributes: {
                source: "local index",
                documentCount: 4,
                reason: "retry budget exhausted",
              },
            },
      ];
    }),
  },
};

/** Focused review of the production copy interaction using the same twenty events. */
export const CopyReveal: Story = {
  name: "Copy reveal",
  args: TwentyEvents.args,
  parameters: {
    docs: {
      description: {
        story:
          "This story uses the production event inspector. The left-hand caret separates expansion from copying. The copy icon stays fixed on the right while its label appears to the left. At rest, the empty space beside the icon still expands the row. Keyboard focus reveals the label immediately. Below 480px the control stays icon-only; touch keeps the label where space permits. The 20 events story uses the same component and data. Design references: [Devouring Details: Ergonomic interactions](https://devouringdetails.com/principles/ergonomic-interactions), [Motion choreography](https://devouringdetails.com/principles/motion-choreography), and [AI for UI: Reviewing your work](https://aiforui.dev/learn/workflows/build-a-tool-to-build-the-tool/reviewing-your-work).",
      },
    },
  },
};

export const CopyRevealLongContent: Story = {
  ...CopyReveal,
  name: "Copy reveal: long content",
  args: {
    events: [
      ...LongContent.args!.events!,
      ...LongEventName.args!.events!,
      ...MetadataOnly.args!.events!,
    ],
  },
};

/** Local review comparison. Both columns receive the exact same recorded fields. */
export const BeforeAfter: Story = {
  name: "Before / After",
  parameters: { width: "1200px" },
  args: { events: [meta.args.events[1]] },
  render: (args) => (
    <div>
      <h2>Same event. Before and after.</h2>
      <p>
        The original already had stack and attribute copy buttons. The changes
        show the complete message once and let you copy the complete event as
        JSON with trace context before expanding it.
      </p>
      <div
        css={css`
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: var(--global-dimension-size-300);
          margin-top: var(--global-dimension-size-300);
          > section {
            min-width: 0;
          }
          > section > h3 {
            margin: 0 0 var(--global-dimension-size-150);
          }
          @media (max-width: 700px) {
            grid-template-columns: minmax(0, 1fr);
          }
        `}
      >
        <section aria-label="Before">
          <h3>Before · original Phoenix</h3>
          <SpanEventsListBefore events={args.events} />
        </section>
        <section aria-label="After">
          <h3>After · our changes</h3>
          <SpanEventsListContent {...args} />
        </section>
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    // Show both diagnostics immediately, including when both themes are shown.
    for (const region of within(canvasElement).getAllByRole("region", {
      name: /^(Before|After)$/,
    })) {
      const trigger = within(region)
        .getAllByRole("button")
        .find((button) => button.hasAttribute("aria-expanded"));
      if (!trigger) {
        throw new Error("Comparison event must have a disclosure trigger");
      }
      if (trigger.getAttribute("aria-expanded") !== "true") {
        await userEvent.click(trigger);
      }
    }
  },
};
