export default function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20 blur-xl" />
        <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <div className="h-6 w-6 animate-pulse rounded-full bg-primary shadow-lg shadow-primary/50" />
      </div>
      <div className="animate-pulse text-sm font-medium text-muted-foreground tracking-widest uppercase">
        Loading
      </div>
    </div>
  );
}
