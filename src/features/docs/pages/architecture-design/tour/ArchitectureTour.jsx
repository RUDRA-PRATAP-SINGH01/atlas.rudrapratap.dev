import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { markArchTourCompleted, TOUR_STEPS } from "./tourSteps";

const PAD = 10;
const TOOLTIP_GAP = 14;
const TOOLTIP_W = 320;

function getPlacement(rect, preferred = "bottom") {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const space = {
    top: rect.top,
    bottom: vh - rect.bottom,
    left: rect.left,
    right: vw - rect.right,
  };

  const order = [preferred, "bottom", "top", "right", "left"];
  for (const p of order) {
    if (p === "bottom" && space.bottom > 180) return "bottom";
    if (p === "top" && space.top > 180) return "top";
    if (p === "right" && space.right > TOOLTIP_W + 24) return "right";
    if (p === "left" && space.left > TOOLTIP_W + 24) return "left";
  }
  // Fallback: side with most room
  return Object.entries(space).sort((a, b) => b[1] - a[1])[0][0];
}

function tooltipStyleFor(rect, placement) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let top = 0;
  let left = 0;

  switch (placement) {
    case "top":
      top = rect.top - TOOLTIP_GAP;
      left = rect.left + rect.width / 2;
      break;
    case "bottom":
      top = rect.bottom + TOOLTIP_GAP;
      left = rect.left + rect.width / 2;
      break;
    case "left":
      top = rect.top + rect.height / 2;
      left = rect.left - TOOLTIP_GAP;
      break;
    case "right":
    default:
      top = rect.top + rect.height / 2;
      left = rect.right + TOOLTIP_GAP;
      break;
  }

  // Keep tooltip inside viewport (approximate height ~220)
  const clampLeft = Math.min(Math.max(left, TOOLTIP_W / 2 + 12), vw - TOOLTIP_W / 2 - 12);
  const clampTop = Math.min(Math.max(top, 16), vh - 16);

  return {
    top: clampTop,
    left: clampLeft,
    transform:
      placement === "top"
        ? "translate(-50%, -100%)"
        : placement === "bottom"
          ? "translate(-50%, 0)"
          : placement === "left"
            ? "translate(-100%, -50%)"
            : "translate(0, -50%)",
  };
}

/**
 * Product-tour coach marks for the Architecture Explorer.
 */
export default function ArchitectureTour({
  open,
  onClose,
  onStepEnter,
  ensureTargetVisible,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [visible, setVisible] = useState(false);
  const targetElRef = useRef(null);
  const prevTargetRef = useRef(null);

  const step = TOUR_STEPS[stepIndex];
  const total = TOUR_STEPS.length;
  const isLast = stepIndex === total - 1;

  const clearHighlight = useCallback(() => {
    if (prevTargetRef.current) {
      prevTargetRef.current.classList.remove("arch-tour-target-active");
      prevTargetRef.current = null;
    }
  }, []);

  const measure = useCallback(async () => {
    if (!open || !step) return;

    clearHighlight();

    if (typeof onStepEnter === "function") {
      await onStepEnter(step, stepIndex);
    }

    // Allow DOM updates (flow controls mount, etc.)
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    let el = document.querySelector(step.target);
    if (!el) {
      // Some steps mount controls after state commit — brief retry
      await new Promise((r) => window.setTimeout(r, 180));
      el = document.querySelector(step.target);
    }
    if (!el) {
      setSpotlight(null);
      setTooltip({
        placement: "bottom",
        style: { top: "30%", left: "50%", transform: "translate(-50%, 0)" },
      });
      setVisible(true);
      return;
    }

    if (typeof ensureTargetVisible === "function") {
      await ensureTargetVisible(el, step);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }

    const rect = el.getBoundingClientRect();
    const padded = {
      top: rect.top - PAD,
      left: rect.left - PAD,
      width: rect.width + PAD * 2,
      height: rect.height + PAD * 2,
      bottom: rect.bottom + PAD,
      right: rect.right + PAD,
    };

    el.classList.add("arch-tour-target-active");
    prevTargetRef.current = el;
    targetElRef.current = el;

    const placement = getPlacement(padded, step.placement);
    setSpotlight({
      top: padded.top,
      left: padded.left,
      width: padded.width,
      height: padded.height,
    });
    setTooltip({
      placement,
      style: tooltipStyleFor(padded, placement),
    });
    setVisible(true);
  }, [open, step, stepIndex, onStepEnter, ensureTargetVisible, clearHighlight]);

  useLayoutEffect(() => {
    if (!open) {
      setVisible(false);
      clearHighlight();
      return undefined;
    }
    setVisible(false);
    const t = window.setTimeout(() => {
      void measure();
    }, 40);
    return () => window.clearTimeout(t);
  }, [open, stepIndex, measure, clearHighlight]);

  useEffect(() => {
    if (!open) return undefined;
    const onResize = () => {
      void measure();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, measure]);

  const finish = useCallback(
    (replay = false) => {
      markArchTourCompleted();
      clearHighlight();
      setVisible(false);
      setStepIndex(0);
      onClose?.({ replay });
    },
    [clearHighlight, onClose],
  );

  const goNext = useCallback(() => {
    if (isLast) {
      finish(false);
      return;
    }
    setVisible(false);
    setStepIndex((i) => Math.min(total - 1, i + 1));
  }, [isLast, finish, total]);

  const goPrev = useCallback(() => {
    setVisible(false);
    setStepIndex((i) => Math.max(0, i - 1));
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, finish, goNext, goPrev]);

  if (!open) return null;

  return (
    <div className={`arch-tour${visible ? " is-visible" : ""}`} role="dialog" aria-modal="false" aria-label="Architecture Explorer tour">
      <div className="arch-tour-scrim" aria-hidden="true" />

      {spotlight && (
        <div
          className="arch-tour-spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
        />
      )}

      {tooltip && step && (
        <div
          className={`arch-tour-tooltip arch-tour-tooltip--${tooltip.placement}`}
          style={tooltip.style}
          role="document"
        >
          <div className="arch-tour-tooltip-progress">
            Step {stepIndex + 1} of {total}
          </div>
          <h3 className="arch-tour-tooltip-title">{step.title}</h3>
          <p className="arch-tour-tooltip-body">{step.body}</p>
          {isLast && step.finishTitle && (
            <p className="arch-tour-tooltip-finish">{step.finishTitle}</p>
          )}

          <div className="arch-tour-tooltip-footer">
            <button type="button" className="arch-tour-btn arch-tour-btn--ghost" onClick={() => finish(false)}>
              Skip Tour
            </button>
            <div className="arch-tour-tooltip-nav">
              {stepIndex > 0 && (
                <button type="button" className="arch-tour-btn" onClick={goPrev}>
                  Previous
                </button>
              )}
              {isLast ? (
                <>
                  <button type="button" className="arch-tour-btn" onClick={() => finish(true)}>
                    Replay Tour
                  </button>
                  <button type="button" className="arch-tour-btn arch-tour-btn--primary" onClick={() => finish(false)}>
                    Start Exploring
                  </button>
                </>
              ) : (
                <button type="button" className="arch-tour-btn arch-tour-btn--primary" onClick={goNext}>
                  Next
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
