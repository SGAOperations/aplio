export default function GlobalQuestionsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="bg-muted h-8 w-48 animate-pulse rounded" />
        <div className="bg-muted h-8 w-28 animate-pulse rounded" />
      </div>
      <div className="bg-muted h-64 animate-pulse rounded-lg" />
    </div>
  );
}
