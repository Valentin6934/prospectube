import Link from 'next/link'

type EmptyStateProps = {
  icon: string
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}

export default function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon" aria-hidden="true">{icon}</span>
      <strong>{title}</strong>
      <p>{description}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className="btn btn-secondary">{actionLabel}</Link>
      )}
    </div>
  )
}
