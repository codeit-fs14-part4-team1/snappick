type ShareIconProps = { className?: string };

export default function ShareIcon({ className }: ShareIconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      width={20}
      height={20}
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M10.0013 12.5V2.5M14.168 6.66667L10.0013 2.5L5.83464 6.66667M4.16797 10.8333V15.8333C4.16797 16.2754 4.34356 16.6993 4.65612 17.0118C4.96868 17.3244 5.39261 17.5 5.83464 17.5H14.168C14.61 17.5 15.0339 17.3244 15.3465 17.0118C15.659 16.6993 15.8346 16.2754 15.8346 15.8333V10.8333"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
