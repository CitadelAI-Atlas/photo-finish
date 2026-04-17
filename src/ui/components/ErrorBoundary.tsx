import { Component, type ReactNode, type ErrorInfo } from 'react'

// A last-line-of-defense catch so a render crash doesn't present the
// player with a blank viewport. React 19's error boundaries still require
// a class component — hooks have no equivalent.
interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI error boundary caught:', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  handleHardReset = () => {
    try {
      localStorage.removeItem('photo-finish-game')
    } catch {
      // ignore — private browsing or quota
    }
    location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-dvh bg-stone-900 text-stone-100 p-6 flex flex-col gap-4">
        <h1 className="text-xl font-bold text-red-400">Something went sideways at the rail.</h1>
        <p className="text-sm text-stone-300">
          {this.state.error.message || 'Unknown error.'}
        </p>
        <div className="flex gap-2">
          <button
            onClick={this.handleReset}
            className="rounded bg-stone-700 px-4 py-2 text-sm font-bold hover:bg-stone-600"
          >
            Try again
          </button>
          <button
            onClick={this.handleHardReset}
            className="rounded bg-red-700 px-4 py-2 text-sm font-bold hover:bg-red-600"
          >
            Reset saved game
          </button>
        </div>
      </div>
    )
  }
}
