function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17L17 7M17 7H9M17 7V15"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PillButton({
  href,
  label,
  variant = "primary",
  size = "md",
  className = "",
}) {
  const classes = [
    "pill-button",
    `pill-button--${variant}`,
    size === "sm" && "pill-button--sm",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <a href={href} className={classes}>
      <span className="pill-button-label">{label}</span>
      <span className="pill-button-icon">
        <ArrowIcon />
      </span>
    </a>
  );
}
