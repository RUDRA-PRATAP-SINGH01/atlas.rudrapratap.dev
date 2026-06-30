import { Link, useLocation } from "react-router-dom";
import DocsNavbar from "../components/DocsNavbar";

export default function NotFoundPage() {
  const { pathname } = useLocation();
  const onDocs = pathname.startsWith("/project-docs");

  return (
    <div className="not-found-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      {onDocs ? <DocsNavbar /> : null}
      <main className="not-found-main">
        <p className="not-found-code">404</p>
        <h1 className="not-found-title">Page not found</h1>
        <p className="not-found-body">The page you requested does not exist or was moved.</p>
        <div className="not-found-actions">
          <Link to="/" className="not-found-link not-found-link--primary">
            Back to home
          </Link>
          <Link to="/project-docs" className="not-found-link">
            Project docs
          </Link>
        </div>
      </main>
    </div>
  );
}
