import { css } from "@emotion/react";
import copy from "copy-to-clipboard";
import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import type { ButtonProps } from "../button";
import { Button } from "../button";
import { VisuallyHidden } from "../content";
import { Icon } from "../icon";
import { Tooltip, TooltipTrigger } from "../tooltip";

const SHOW_COPIED_TIMEOUT_MS = 2000;

export type CopyToClipboardButtonProps = Omit<
  ButtonProps,
  "icon" | "onPress" | "size"
> & {
  /**
   * The size of the button
   * @default S
   */
  size?: ButtonProps["size"];
  /**
   * The text to copy to the clipboard
   */
  text: string | RefObject<string | null>;
  /**
   * The text to display in the tooltip
   * @default "Copy"
   */
  tooltipText?: string;
};

const copyToClipboardButtonCSS = css`
  flex: none;
  box-sizing: content-box;
`;

/**
 * An Icon button that copies the given text to the clipboard when clicked.
 */
export function CopyToClipboardButton(props: CopyToClipboardButtonProps) {
  const { text, size = "S", tooltipText = "Copy", ...otherProps } = props;
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "error">(
    "idle"
  );
  const resetTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRequest = useRef(0);
  const isCopied = copyStatus === "success";
  const hasCopyError = copyStatus === "error";
  const statusMessage = isCopied
    ? "Copied to clipboard."
    : hasCopyError
      ? "Could not copy. Select the text and copy it manually."
      : "";

  useEffect(() => {
    return () => {
      latestRequest.current += 1;
      if (resetTimeout.current !== null) {
        clearTimeout(resetTimeout.current);
      }
    };
  }, []);

  const onPress = async () => {
    const request = ++latestRequest.current;
    if (resetTimeout.current !== null) {
      clearTimeout(resetTimeout.current);
      resetTimeout.current = null;
    }
    setCopyStatus("idle");
    const textToCopy = typeof text === "string" ? text : text.current || "";
    let didCopy = false;
    try {
      didCopy = await copy(textToCopy);
    } catch {
      // Clipboard access may be unavailable or denied by the browser.
    }
    // A newer attempt or an unmount makes this result irrelevant.
    if (request !== latestRequest.current) {
      return;
    }
    setCopyStatus(didCopy ? "success" : "error");
    if (!didCopy) {
      return;
    }
    resetTimeout.current = setTimeout(() => {
      setCopyStatus("idle");
      resetTimeout.current = null;
    }, SHOW_COPIED_TIMEOUT_MS);
  };
  return (
    <div className="copy-to-clipboard-button" css={copyToClipboardButtonCSS}>
      <TooltipTrigger>
        <Button
          size={size}
          leadingVisual={
            <Icon
              color={isCopied ? "success" : hasCopyError ? "danger" : "inherit"}
              svgKey={
                isCopied
                  ? "Checkmark"
                  : hasCopyError
                    ? "AlertTriangle"
                    : "Duplicate"
              }
              aria-hidden="true"
            />
          }
          onPress={onPress}
          {...otherProps}
          className="copy-button"
        />
        <Tooltip offset={1}>
          {hasCopyError ? statusMessage : tooltipText}
        </Tooltip>
      </TooltipTrigger>
      <VisuallyHidden role="status">{statusMessage}</VisuallyHidden>
    </div>
  );
}
