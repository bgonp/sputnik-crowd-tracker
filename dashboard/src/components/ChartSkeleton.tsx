export function ChartSkeleton({ className = "h-52" }: { className?: string }) {
  return <div className={`w-full animate-pulse rounded-md bg-muted ${className}`} />;
}
