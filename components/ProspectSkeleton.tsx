export default function ProspectSkeleton() {
  return (
    <div className="prospect-skeleton" aria-hidden="true">
      <div className="skeleton-avatar skeleton-shimmer" />
      <div className="skeleton-content">
        <div className="skeleton-line skeleton-title skeleton-shimmer" />
        <div className="skeleton-badges">
          <div className="skeleton-pill skeleton-shimmer" />
          <div className="skeleton-pill skeleton-shimmer" />
          <div className="skeleton-pill skeleton-shimmer" />
        </div>
        <div className="skeleton-line skeleton-short skeleton-shimmer" />
      </div>
      <div className="skeleton-actions">
        <div className="skeleton-button skeleton-shimmer" />
        <div className="skeleton-button skeleton-shimmer" />
        <div className="skeleton-button skeleton-shimmer" />
      </div>
    </div>
  )
}
