/* The Pipeline mark: three chevrons, like deals moving through pipeline stages. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Pipeline logo">
      <rect width="32" height="32" rx="8" fill="#134e4a" />
      <path d="M5 9h4l5 7-5 7H5l5-7z" fill="#fff" opacity="0.45" />
      <path d="M11.5 9h4l5 7-5 7h-4l5-7z" fill="#fff" opacity="0.72" />
      <path d="M18 9h4l5 7-5 7h-4l5-7z" fill="#2dd4bf" />
    </svg>
  );
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className={`flex items-center gap-2 ${light ? "text-white" : "text-stone-900"}`}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight">Pipeline</span>
    </span>
  );
}
