type HeartIconProps = { filled: boolean; className?: string };

export default function HeartIcon({ filled, className }: HeartIconProps) {
  return (
    <svg
      viewBox="-1 -1 18 16"
      width={18}
      height={16}
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <path
        d="M8 14C8 14 1.81328 9.975 0.328461 5.95C-0.743904 3.0625 0.905889 0 3.87552 0C5.52531 0 6.59768 0.9625 8 2.625C9.40232 0.9625 10.4747 0 12.1245 0C15.0941 0 16.7439 3.0625 15.6715 5.95C14.1867 9.975 8 14 8 14Z"
        fill={filled ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={1.2}
      />
    </svg>
  );
}
