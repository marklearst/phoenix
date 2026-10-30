import { css } from "@emotion/react";
import { graphql, useLazyLoadQuery } from "react-relay";

import {
  Card,
  CopyToClipboardButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  ExpandableContent,
  Flex,
  Icon,
  Icons,
  Text,
} from "@phoenix/components";
import {
  JSONViewBody,
  JSONViewProvider,
  JSONViewToolbar,
  PreBlock,
} from "@phoenix/components/code";
import {
  EmptyState,
  EmptyStateArea,
  EmptyStateGraphic,
} from "@phoenix/components/core/empty";
import { useTimeFormatters } from "@phoenix/hooks";

import type { SpanEventsListQuery } from "./__generated__/SpanEventsListQuery.graphql";
import {
  formatSpanEvent,
  getSpanEventDetails,
  type SpanEvent,
  type SpanEventContext,
} from "./spanEventUtils";

type SpanEventsListProps = {
  spanId: string;
};

/** Fetch event payloads only when the Events tab is selected. */
export function SpanEventsList({ spanId }: SpanEventsListProps) {
  const data = useLazyLoadQuery<SpanEventsListQuery>(
    graphql`
      query SpanEventsListQuery($id: ID!) {
        span: node(id: $id) {
          ... on Span {
            name
            spanId
            trace {
              traceId
            }
            events {
              name
              message
              timestamp
              attributes
            }
          }
        }
      }
    `,
    { id: spanId }
  );
  const span = data.span;
  const context =
    span?.name != null && span.spanId != null && span.trace != null
      ? {
          spanName: span.name,
          spanId: span.spanId,
          traceId: span.trace.traceId,
        }
      : undefined;

  return (
    <SpanEventsListContent
      key={spanId}
      events={span?.events ?? []}
      context={context}
    />
  );
}

const spanEventsCSS = css`
  min-width: 0;
  container: span-events / inline-size;

  .span-events__list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .span-events__item {
    min-width: 0;
    border-bottom: 1px solid var(--global-border-color-default);
    &:last-child {
      border-bottom: none;
    }
  }

  .span-events__item .react-aria-Button[slot="trigger"] {
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
    align-items: flex-start;
    text-align: left;
    border-bottom: none;
    > .flex {
      box-sizing: border-box;
      padding-right: calc(
        var(--event-copy-width) + var(--global-dimension-size-100)
      );
    }
    > .icon-wrap {
      flex: none;
      width: var(--event-caret-size);
      height: var(--event-caret-size);
      margin-top: calc(
        (var(--event-control-size) - var(--event-caret-size)) / 2
      );
    }
    &[data-pressed] {
      background-color: var(--global-disclosure-background-color-active);
    }
  }

  .span-events__header {
    --event-control-size: var(--global-dimension-size-400);
    --event-copy-width: var(--event-control-size);
    --event-caret-size: var(--global-font-size-s);
    position: relative;
  }

  .span-events__copy {
    position: absolute;
    top: var(--global-dimension-size-100);
    right: var(--global-dimension-size-200);
    /* Keep the sibling action above the trigger's keyboard focus layer. */
    z-index: 2;

    .copy-button {
      box-sizing: border-box;
      width: var(--event-copy-width);
      height: var(--event-control-size);
      padding-inline: var(--global-dimension-size-75);
      justify-content: center;
      white-space: nowrap;
    }
  }

  .span-events__copy-label {
    display: none;
  }

  .span-events__header--static {
    padding: var(--global-dimension-size-100) var(--global-dimension-size-200);

    .span-events__summary {
      /* Align timestamps with rows that have a disclosure caret. */
      padding-left: calc(
        var(--event-caret-size) + var(--global-dimension-size-100)
      );
      padding-right: calc(
        var(--event-copy-width) + var(--global-dimension-size-100)
      );
    }
  }

  .span-events__summary {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-50);
  }

  .span-events__heading {
    display: flex;
    flex-wrap: wrap;
    min-height: var(--event-control-size);
    align-content: center;
    align-items: center;
    column-gap: var(--global-dimension-size-100);
    row-gap: var(--global-dimension-size-50);
  }

  .disclosure[data-expanded] .span-events__preview {
    display: none;
  }

  .span-events__name {
    display: inline-flex;
    align-items: center;
    gap: var(--global-dimension-size-100);
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .span-events__time {
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    font-variant-numeric: tabular-nums;
  }

  .span-events__preview {
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
    overflow: hidden;
    display: block;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .span-events__details {
    min-width: 0;
    padding: 0 var(--global-dimension-size-200) var(--global-dimension-size-200);
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-150);

    pre {
      margin: 0;
      overflow-wrap: anywhere;
      line-height: var(--global-line-height-m);
    }
  }

  .span-events__message {
    flex: 1;
    min-width: 0;
    white-space: pre-wrap;
    font-family: inherit;
    font-size: var(--global-font-size-s);
  }

  .span-events__message-row {
    display: flex;
    align-items: flex-start;
    gap: var(--global-dimension-size-100);
    /* Match the card header's inset, including its border. */
    padding-inline-end: calc(var(--global-dimension-size-200) + 1px);
  }

  .span-events__attributes > .card > header {
    height: auto;
    min-height: var(--global-card-header-height);
    flex-wrap: wrap;
    gap: var(--global-dimension-size-100);
    padding-block: var(--global-dimension-size-100);

    > .flex {
      margin-left: auto;
      min-width: 0;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
  }

  .span-events__attributes > .card > .card__body {
    overflow-x: auto;

    table {
      min-width: var(--global-dimension-size-6000);
    }
  }

  @container span-events (min-width: 480px) {
    .span-events__header {
      --event-copy-width: 112px;
    }

    .span-events__copy-label {
      display: inline;
    }

    @media (hover: hover) and (pointer: fine) {
      .span-events__header .span-events__copy {
        width: var(--event-copy-width);
        /* Empty reserved space still belongs to the disclosure below. */
        pointer-events: none;

        .copy-to-clipboard-button {
          display: flex;
          justify-content: flex-end;
        }

        .copy-button {
          --copy-label-width: 0px;
          pointer-events: auto;
          display: grid;
          grid-template-columns: var(--copy-label-width) minmax(0, 1fr);
          column-gap: 0;
          align-items: center;
          width: var(--event-control-size);
          padding: 0;
          overflow: hidden;
          /* The surface and hit area change together; only the label moves. */
          transition: none;

          > .icon-wrap {
            grid-area: 1 / 2;
            justify-self: center;
            pointer-events: none;
          }

          > .span-events__copy-label {
            display: block;
            grid-area: 1 / 1;
            justify-self: start;
            padding-left: var(--global-dimension-size-100);
            pointer-events: none;
            visibility: hidden;
            opacity: 0;
            transform: translateX(var(--global-dimension-size-50));
            transition: none;
          }

          &:hover:not([disabled]),
          &[data-focus-visible]:not([disabled]),
          &:focus-visible:not([disabled]) {
            --copy-label-width: calc(
              var(--event-copy-width) - var(--event-control-size)
            );
            width: var(--event-copy-width);

            > .span-events__copy-label {
              visibility: visible;
              opacity: 1;
              transform: translateX(0);
              transition:
                transform 150ms ease-out,
                opacity 150ms ease-out;
            }
          }

          &[data-focus-visible]:not([disabled]),
          &:focus-visible:not([disabled]) {
            > .span-events__copy-label {
              transition: none;
            }
          }
        }
      }
    }
  }

  @media (pointer: coarse) {
    .span-events__header {
      --event-control-size: 44px;
    }
    .copy-button {
      min-width: 44px;
      min-height: 44px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .span-events__header .span-events__copy .copy-button {
      &:hover:not([disabled]),
      &[data-focus-visible],
      &:focus-visible {
        > .span-events__copy-label {
          transition: none;
        }
      }
    }

    .react-aria-Button[slot="trigger"],
    .react-aria-Button[slot="trigger"] > .icon-wrap {
      transition: none;
    }
  }
`;

function EventAttributesJSONView({ attributes }: { attributes: unknown }) {
  return (
    <div className="span-events__attributes">
      <JSONViewProvider
        value={attributes}
        defaultMode="table"
        indexNotation="dot"
      >
        <Card
          title="Attributes"
          extra={
            <JSONViewToolbar searchPlaceholder="Search event attributes" />
          }
        >
          <JSONViewBody />
        </Card>
      </JSONViewProvider>
    </div>
  );
}

export function SpanEventAttributes({ event }: { event: SpanEvent }) {
  const { message, stacktrace, attributes, hasAttributes } =
    getSpanEventDetails(event);
  return (
    <Flex direction="column" gap="size-150">
      {message && (
        <div className="span-events__message-row">
          <pre className="span-events__message">{message}</pre>
          <CopyToClipboardButton
            aria-label="Copy message"
            text={message}
            tooltipText="Copy message"
          />
        </div>
      )}
      {stacktrace && (
        <Card
          title="Stack trace"
          extra={
            <CopyToClipboardButton
              aria-label="Copy stack trace"
              text={stacktrace}
              tooltipText="Copy stack trace"
            />
          }
        >
          <ExpandableContent height={320} expandedBehavior="grow">
            <PreBlock>{stacktrace}</PreBlock>
          </ExpandableContent>
        </Card>
      )}
      {hasAttributes && <EventAttributesJSONView attributes={attributes} />}
    </Flex>
  );
}

export function SpanEventsListContent({
  events,
  context,
}: {
  events: readonly SpanEvent[];
  context?: SpanEventContext;
}) {
  const { fullTimeFormatter } = useTimeFormatters();

  if (events.length === 0) {
    return (
      <EmptyStateArea>
        <EmptyState
          graphic={<EmptyStateGraphic variant="event" />}
          description="No events for this span"
        />
      </EmptyStateArea>
    );
  }

  return (
    <DisclosureGroup css={spanEventsCSS}>
      <ol className="span-events__list" role="list" aria-label="Span events">
        {events.map((event, index) => {
          const isException = event.name === "exception";
          const { message, stacktrace, hasAttributes } =
            getSpanEventDetails(event);
          const hasDetails =
            message.length > 0 || stacktrace !== null || hasAttributes;
          const summary = (
            <div className="span-events__summary">
              <div className="span-events__heading">
                <time className="span-events__time" dateTime={event.timestamp}>
                  {fullTimeFormatter(new Date(event.timestamp))}
                </time>
                <span className="span-events__name">
                  {isException && (
                    <Icon svg={<Icons.AlertTriangle />} color="danger" />
                  )}
                  <Text weight="heavy">{event.name}</Text>
                </span>
              </div>
              {message && (
                <span className="span-events__preview" aria-hidden="true">
                  {message}
                </span>
              )}
            </div>
          );
          const copyEvent = (
            <div className="span-events__copy">
              <CopyToClipboardButton
                text={formatSpanEvent({ event, context })}
                tooltipText="Copy event as JSON, including attributes and trace context"
                aria-label={`Copy event ${event.name}`}
              >
                <span className="span-events__copy-label">Copy event</span>
              </CopyToClipboardButton>
            </div>
          );

          return (
            <li className="span-events__item" key={index}>
              {hasDetails ? (
                <Disclosure id={index} defaultExpanded={false}>
                  <div className="span-events__header">
                    <DisclosureTrigger arrowPosition="start">
                      {summary}
                    </DisclosureTrigger>
                    {copyEvent}
                  </div>
                  <DisclosurePanel>
                    <div className="span-events__details">
                      <SpanEventAttributes event={event} />
                    </div>
                  </DisclosurePanel>
                </Disclosure>
              ) : (
                <div className="span-events__header span-events__header--static">
                  {summary}
                  {copyEvent}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </DisclosureGroup>
  );
}
