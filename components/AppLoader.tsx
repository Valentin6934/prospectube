type AppLoaderProps = {
  text?: string
  fullScreen?: boolean
  compact?: boolean
}

export default function AppLoader({
  text = 'Chargement de votre espace...',
  fullScreen = true,
  compact = false,
}: AppLoaderProps) {
  return (
    <div
      className={`${fullScreen ? 'app-loader-screen' : 'app-loader-inline'}${compact ? ' app-loader-compact' : ''}`}
      role="status"
      aria-live="polite"
    >
      <span className="app-spinner" aria-hidden="true" />
      <span>{text}</span>
    </div>
  )
}
