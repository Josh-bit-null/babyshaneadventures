import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <main className="fatal">
      <div className="fatal-card">
        <span className="fatal-emoji">🌀</span>
        <h1>This path washed out to sea.</h1>
        <p>The page you tried to visit is not part of the island.</p>
        <Link className="btn btn-primary" to="/play">Back to the island</Link>
      </div>
    </main>
  )
}
