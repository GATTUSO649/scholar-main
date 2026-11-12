type PageLoaderProps = {
  label?: string;
  className?: string;
};

export function PageLoader({ label = "Loading…", className = "" }: PageLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex min-h-[220px] items-center justify-center rounded-2xl border border-[#dfe9e2] bg-[#f4f8f5] ${className}`.trim()}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <span className="absolute h-16 w-16 rounded-full border-2 border-[#cfe1d7]" />
          <span className="absolute h-16 w-16 animate-spin rounded-full border-[3px] border-transparent border-t-[#1d4d3d] border-r-[#4c9c76]" />
          <span className="relative h-3.5 w-3.5 rounded-full bg-[#1d4d3d] animate-pulse" />
        </div>
        <p className="text-sm font-medium tracking-[0.12em] text-[#31574b] uppercase">{label}</p>
      </div>
    </div>
  );
}
