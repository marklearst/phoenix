import copy from "copy-to-clipboard";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installTestMatchMedia } from "@phoenix/__tests__/installTestMatchMedia";

import { CopyToClipboardButton } from "../CopyToClipboardButton";

vi.mock("copy-to-clipboard", () => ({ default: vi.fn(async () => true) }));

installTestMatchMedia();

let container: HTMLDivElement;
let root: Root | null;

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(copy).mockReset().mockResolvedValue(true);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
});

function renderButton(
  text: string | { current: string | null } = "Full message"
) {
  act(() => {
    root!.render(
      <CopyToClipboardButton text={text} aria-label="Copy event details">
        Copy event
      </CopyToClipboardButton>
    );
  });
  return container.querySelector<HTMLButtonElement>("button")!;
}

function statusText() {
  return container.querySelector('[role="status"]')?.textContent;
}

async function press(button: HTMLButtonElement) {
  await act(async () => button.click());
}

function pendingCopy() {
  let resolve!: (copied: boolean) => void;
  const promise = new Promise<boolean>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe("CopyToClipboardButton", () => {
  it("announces a successful copy without replacing the caller's label or text", async () => {
    const button = renderButton();

    await press(button);

    expect(copy).toHaveBeenCalledExactlyOnceWith("Full message");
    expect(statusText()).toMatch(/copied/i);
    expect(button.getAttribute("aria-label")).toBe("Copy event details");
    expect(button.textContent).toBe("Copy event");

    act(() => vi.advanceTimersByTime(2000));
    expect(statusText()).toBe("");
  });

  it("reports failure instead of success when the clipboard rejects a copy", async () => {
    vi.mocked(copy).mockResolvedValue(false);
    const button = renderButton();
    const idleIcon = button.querySelector("svg")?.innerHTML;

    await press(button);

    expect(statusText()).toMatch(/could not copy/i);
    expect(statusText()).toMatch(/try again/i);
    expect(button.querySelector("svg")?.innerHTML).not.toBe(idleIcon);
  });

  it("contains asynchronous clipboard rejection and offers a retry", async () => {
    vi.mocked(copy).mockRejectedValue(new Error("Clipboard unavailable"));
    const button = renderButton();

    await press(button);

    expect(statusText()).toMatch(/could not copy/i);
    expect(statusText()).toMatch(/try again/i);
  });

  it("keeps failure guidance available in the tooltip until the user retries", async () => {
    vi.mocked(copy).mockResolvedValue(false);
    const button = renderButton();
    await press(button);
    act(() => vi.advanceTimersByTime(5000));
    expect(statusText()).toMatch(/could not copy/i);

    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    await act(async () => user.tab());

    expect(document.querySelector('[role="tooltip"]')?.textContent).toMatch(
      /could not copy.*try again/i
    );
  });

  it("keeps feedback visible for two seconds after the most recent copy", async () => {
    const button = renderButton();
    await press(button);
    act(() => vi.advanceTimersByTime(1500));
    await press(button);

    act(() => vi.advanceTimersByTime(500));
    expect(statusText()).toMatch(/copied/i);
    act(() => vi.advanceTimersByTime(1499));
    expect(statusText()).toMatch(/copied/i);
    act(() => vi.advanceTimersByTime(1));
    expect(statusText()).toBe("");
  });

  it("cancels pending feedback work when the button unmounts", async () => {
    const button = renderButton();
    await press(button);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    act(() => root!.unmount());
    root = null;

    expect(vi.getTimerCount()).toBe(0);
  });

  it("copies the current ref value and can recover from a failed attempt", async () => {
    vi.mocked(copy).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const text = { current: "First message" };
    const button = renderButton(text);
    await press(button);
    expect(statusText()).toMatch(/could not copy/i);

    text.current = "Updated message";
    await press(button);

    expect(copy).toHaveBeenLastCalledWith("Updated message");
    expect(statusText()).toMatch(/copied/i);
  });

  it("waits for clipboard completion before reporting success", async () => {
    const pending = pendingCopy();
    vi.mocked(copy).mockReturnValue(pending.promise);
    const button = renderButton();

    await press(button);
    expect(statusText()).toBe("");
    expect(vi.getTimerCount()).toBe(0);

    await act(async () => pending.resolve(true));
    expect(statusText()).toMatch(/copied/i);
  });

  it("does not overwrite a newer failure with an older completed copy", async () => {
    const first = pendingCopy();
    const second = pendingCopy();
    vi.mocked(copy)
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const button = renderButton();
    await press(button);
    await press(button);

    await act(async () => second.resolve(false));
    expect(statusText()).toMatch(/could not copy/i);
    await act(async () => first.resolve(true));
    expect(statusText()).toMatch(/could not copy/i);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("ignores a clipboard operation that completes after unmount", async () => {
    const pending = pendingCopy();
    vi.mocked(copy).mockReturnValue(pending.promise);
    const button = renderButton();
    await press(button);
    act(() => root!.unmount());
    root = null;

    await act(async () => pending.resolve(true));

    expect(vi.getTimerCount()).toBe(0);
  });

  it("waits for the browser write through the installed clipboard adapter", async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard"
    );
    const secureContextDescriptor = Object.getOwnPropertyDescriptor(
      window,
      "isSecureContext"
    );
    const pending = pendingCopy();
    const writeText = vi.fn(() => pending.promise.then(() => undefined));
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });
    try {
      const actual = await vi.importActual<{ default: typeof copy }>(
        "copy-to-clipboard"
      );
      vi.mocked(copy).mockImplementation(actual.default);
      const button = renderButton();

      await press(button);
      expect(writeText).toHaveBeenCalledExactlyOnceWith("Full message");
      expect(statusText()).toBe("");

      await act(async () => pending.resolve(true));
      expect(statusText()).toMatch(/copied/i);
    } finally {
      if (clipboardDescriptor)
        Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
      else Reflect.deleteProperty(navigator, "clipboard");
      if (secureContextDescriptor)
        Object.defineProperty(
          window,
          "isSecureContext",
          secureContextDescriptor
        );
      else Reflect.deleteProperty(window, "isSecureContext");
    }
  });
});
