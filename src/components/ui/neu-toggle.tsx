import { useId } from "react";

interface NeuToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  ariaLabel?: string;
  disabled?: boolean;
}

/**
 * Neumorphic toggle inspired by Uiverse (mobinkakei).
 * Self-contained styles so it does not depend on global CSS.
 *
 * We drive the visual state from a `data-state` attribute (instead of relying
 * only on the `:checked` sibling selector) so React always keeps the DOM in
 * sync with the `checked` prop, even in controlled scenarios where the input
 * is visually hidden.
 */
export function NeuToggle({
  checked,
  onCheckedChange,
  ariaLabel,
  disabled,
}: NeuToggleProps) {
  const id = useId();
  return (
    <>
      <style>{`
        .neu-toggle {
          isolation: isolate;
          position: relative;
          height: 26px;
          width: 52px;
          border-radius: 13px;
          overflow: hidden;
          background: #ecf0f3;
          box-shadow:
            -6px -3px 6px rgba(255,255,255,0.9),
            6px 3px 10px rgba(209,217,230,0.9),
            3px 3px 3px rgba(209,217,230,0.8) inset,
            -3px -3px 3px rgba(255,255,255,0.9) inset;
          cursor: pointer;
          display: inline-block;
        }
        .neu-toggle[data-disabled="true"] { opacity: 0.55; cursor: not-allowed; }
        .neu-toggle-input {
          position: absolute;
          inset: 0;
          opacity: 0;
          margin: 0;
          cursor: inherit;
          z-index: 2;
        }
        .neu-toggle-indicator {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          width: 200%;
          border-radius: 13px;
          background: #ecf0f3;
          transform: translate3d(-75%, 0, 0);
          transition: transform 0.4s cubic-bezier(0.85, 0.05, 0.18, 1.35),
                      background 0.3s ease,
                      box-shadow 0.3s ease;
          box-shadow:
            -6px -3px 6px rgba(255,255,255,0.9),
            6px 3px 10px rgba(209,217,230,0.9);
          z-index: 1;
        }
        .neu-toggle[data-state="on"] .neu-toggle-indicator,
        .neu-toggle-input:checked ~ .neu-toggle-indicator {
          transform: translate3d(25%, 0, 0);
          background: linear-gradient(145deg, #4da3ff, #007bff);
          box-shadow:
            0 0 12px rgba(0, 123, 255, 0.45),
            -2px -2px 6px rgba(255,255,255,0.35) inset,
            2px 2px 6px rgba(0,0,0,0.15) inset;
        }
      `}</style>
      <label
        htmlFor={id}
        className="neu-toggle"
        data-state={checked ? "on" : "off"}
        data-disabled={disabled ? "true" : "false"}
        aria-label={ariaLabel}
      >
        <input
          id={id}
          className="neu-toggle-input"
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange(e.target.checked)}
        />
        <span className="neu-toggle-indicator" />
      </label>
    </>
  );
}
