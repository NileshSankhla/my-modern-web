export default function Loading() {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="flex items-center space-x-2">
        <div className="h-4 w-4 animate-pulse rounded-full bg-primary"></div>
        <div className="h-4 w-4 animate-pulse rounded-full bg-primary [animation-delay:0.2s]"></div>
        <div className="h-4 w-4 animate-pulse rounded-full bg-primary [animation-delay:0.4s]"></div>
      </div>
    </div>
  );
}
