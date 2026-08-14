import { type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./responsive-dialog.css";

export function ResponsiveDialog({
  open,
  titleId,
  initialFocusRef,
  onClose,
  children,
}: {
  open: boolean;
  titleId: string;
  initialFocusRef?: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}) {
  const modalRef = useRef<HTMLDivElement>(null);
  const viewport = useVisualViewport(open);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.setTimeout(() => initialFocusRef?.current?.focus(), 0);
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [initialFocusRef, open]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      ),
    );
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;

  return createPortal(
    <div
      className="responsive-dialog-backdrop"
      data-testid="responsive-dialog-backdrop"
      style={{
        left: viewport.left,
        top: viewport.top,
        width: viewport.width,
        height: viewport.height,
      }}
    >
      <div
        ref={modalRef}
        className="responsive-dialog-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="responsive-dialog-modal"
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

function useVisualViewport(enabled: boolean) {
  const [viewport, setViewport] = useState(readVisualViewport);

  useEffect(() => {
    if (!enabled) return;
    const visualViewport = window.visualViewport;
    const update = () => setViewport(readVisualViewport());
    update();
    visualViewport?.addEventListener("resize", update);
    visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      visualViewport?.removeEventListener("resize", update);
      visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [enabled]);

  return viewport;
}

function readVisualViewport() {
  const viewport = window.visualViewport;
  return {
    left: viewport?.offsetLeft ?? 0,
    top: viewport?.offsetTop ?? 0,
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
}
