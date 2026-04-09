export default function OfflinePage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-3xl border bg-background/80 backdrop-blur p-6 text-center space-y-3">
        <h1 className="text-xl font-bold">You&apos;re offline</h1>
        <p className="text-sm text-muted-foreground">
          You can still play any clips you&apos;ve downloaded for offline viewing.
        </p>
        <a
          href="/downloads"
          className="inline-flex items-center justify-center rounded-full px-6 py-2 bg-foreground text-background font-semibold"
        >
          Open downloads
        </a>
      </div>
    </div>
  );
}

