export default function RouteFallback() {
  return (
    <div className="route-fallback" aria-live="polite" aria-busy="true">
      <span className="route-fallback-spinner" aria-hidden="true" />
    </div>
  );
}
