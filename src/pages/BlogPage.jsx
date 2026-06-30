import { Link } from "react-router-dom";

export default function BlogPage() {
  return (
    <div className="blog-coming-soon">
      <div className="blog-coming-soon-backdrop" />
      <div className="blog-coming-soon-content">
        <Link to="/" className="blog-back-home">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none">
            <line x1="19" y1="12" x2="5" y2="12"></line>
            <polyline points="12 19 5 12 12 5"></polyline>
          </svg>
          Back to Home
        </Link>
        <div className="blog-coming-soon-card">
          <div className="blog-coming-soon-glow" />
          <h1 className="blog-title">COMING SOON</h1>
          <p className="blog-subtitle">We're writing deep-dive engineering articles. Stay tuned!</p>
        </div>
      </div>
    </div>
  );
}
