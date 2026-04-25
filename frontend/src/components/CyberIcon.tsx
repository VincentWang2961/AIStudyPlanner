import styles from "./CyberIcon.module.css";

export type CyberIconVariant =
  | "planner"
  | "plans"
  | "units"
  | "settings"
  | "validation"
  | "assistant";

interface CyberIconProps {
  variant: CyberIconVariant;
  size?: "sm" | "md";
  className?: string;
}

function renderGlyph(variant: CyberIconVariant) {
  switch (variant) {
    case "planner":
      return (
        <>
          <path
            d="M12 4.5 15 7.5 12 10.5 9 7.5Z"
            fill="var(--icon-secondary)"
            stroke="var(--icon-primary)"
            strokeWidth="1"
          />
          <path
            d="M12 2.5v2M12 10.5v2M7 7.5h2M15 7.5h2M8.6 4.1l1.4 1.4M14 9.5l1.4 1.4"
            stroke="var(--icon-primary)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M8.5 15h7l-1.8 2.2H10.3Z"
            fill="none"
            stroke="var(--icon-tertiary)"
            strokeWidth="1.3"
            strokeLinejoin="round"
          />
        </>
      );
    case "plans":
      return (
        <>
          <rect
            x="5"
            y="7"
            width="10"
            height="11"
            rx="1.8"
            fill="none"
            stroke="var(--icon-tertiary)"
            strokeWidth="1.2"
            opacity="0.65"
          />
          <rect
            x="8"
            y="5"
            width="10"
            height="12"
            rx="2"
            fill="none"
            stroke="var(--icon-primary)"
            strokeWidth="1.4"
          />
          <path
            d="M10.5 8.5h5M10.5 11.5h5M10.5 14.5h3.5"
            stroke="var(--icon-secondary)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      );
    case "units":
      return (
        <>
          <rect
            x="4.5"
            y="9.5"
            width="6"
            height="6"
            rx="1.3"
            fill="none"
            stroke="var(--icon-tertiary)"
            strokeWidth="1.3"
          />
          <rect
            x="8.9"
            y="5"
            width="6"
            height="6"
            rx="1.3"
            fill="none"
            stroke="var(--icon-secondary)"
            strokeWidth="1.3"
          />
          <rect
            x="13.3"
            y="9.5"
            width="6"
            height="6"
            rx="1.3"
            fill="none"
            stroke="var(--icon-primary)"
            strokeWidth="1.3"
          />
          <path
            d="M10.5 12.5h3M12 11v3"
            stroke="var(--icon-primary)"
            strokeWidth="1.3"
            strokeLinecap="round"
          />
        </>
      );
    case "settings":
      return (
        <>
          <circle
            cx="12"
            cy="12"
            r="4.3"
            fill="none"
            stroke="var(--icon-primary)"
            strokeWidth="1.5"
          />
          <circle cx="12" cy="12" r="1.5" fill="var(--icon-secondary)" />
          <path
            d="M12 4.2v2.2M12 17.6v2.2M4.2 12h2.2M17.6 12h2.2M6.6 6.6l1.6 1.6M15.8 15.8l1.6 1.6M17.4 6.6l-1.6 1.6M8.2 15.8l-1.6 1.6"
            stroke="var(--icon-tertiary)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </>
      );
    case "validation":
      return (
        <>
          <circle
            cx="12"
            cy="12"
            r="5.6"
            fill="none"
            stroke="var(--icon-primary)"
            strokeWidth="1.4"
          />
          <circle cx="12" cy="12" r="1.8" fill="var(--icon-secondary)" />
          <path
            d="M12 12 16.8 8.2"
            stroke="var(--icon-tertiary)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path
            d="M7.6 16.4A6.4 6.4 0 0 1 18 9.4"
            fill="none"
            stroke="var(--icon-tertiary)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </>
      );
    case "assistant":
      return (
        <>
          <circle cx="8" cy="12.5" r="1.8" fill="var(--icon-secondary)" />
          <circle cx="16" cy="8.2" r="1.8" fill="var(--icon-tertiary)" />
          <path
            d="M8 12.5 12 12l4-3.8"
            fill="none"
            stroke="var(--icon-primary)"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M12 8.6 14.4 12 12 15.4 9.6 12Z"
            fill="none"
            stroke="var(--icon-primary)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </>
      );
  }
}

export default function CyberIcon({
  variant,
  size = "sm",
  className = "",
}: CyberIconProps) {
  const classes = [styles.icon, styles[size], styles[variant], className].filter(Boolean).join(" ");

  return (
    <span className={classes} aria-hidden="true">
      <span className={styles.frame} />
      <svg viewBox="0 0 24 24" className={styles.glyph}>
        {renderGlyph(variant)}
      </svg>
    </span>
  );
}
