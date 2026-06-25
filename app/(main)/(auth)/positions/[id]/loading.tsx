export default function PositionDetailLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      {/* Back link */}
      <div className="bg-muted mb-6 h-8 w-36 animate-pulse rounded" />

      {/* Title + action buttons */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="bg-muted h-8 w-64 animate-pulse rounded" />
        <div className="flex gap-2">
          <div className="bg-muted h-8 w-16 animate-pulse rounded" />
          <div className="bg-muted h-8 w-32 animate-pulse rounded" />
        </div>
      </div>

      {/* Status badge + dates */}
      <div className="mb-6 flex items-center gap-2">
        <div className="bg-muted h-5 w-16 animate-pulse rounded-full" />
        <div className="bg-muted h-4 w-28 animate-pulse rounded" />
      </div>

      {/* Description section */}
      <div className="mb-6 flex flex-col gap-2">
        <div className="bg-muted h-5 w-28 animate-pulse rounded" />
        <div className="bg-muted h-4 w-full animate-pulse rounded" />
        <div className="bg-muted h-4 w-5/6 animate-pulse rounded" />
        <div className="bg-muted h-4 w-4/6 animate-pulse rounded" />
      </div>

      {/* Questions section */}
      <div className="flex flex-col gap-3">
        <div className="bg-muted h-5 w-40 animate-pulse rounded" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <div className="bg-muted h-4 w-48 animate-pulse rounded" />
            <div className="bg-muted h-5 w-24 animate-pulse rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
