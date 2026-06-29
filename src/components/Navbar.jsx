const navLinks = ["Features", "Docs", "Blog"];

export default function Navbar() {
  return (
    <header className="navbar">
      <div className="navbar-container">
        <a href="/" className="navbar-logo" aria-label="Atlas home">
          <img src="/images/final-a.png" alt="" className="navbar-logo-img" />
          <span className="navbar-logo-text">tlas</span>
        </a>

        <nav className="navbar-links" aria-label="Main navigation">
          <a href="/" className="navbar-link navbar-link--active">
            <span className="navbar-link-dot" aria-hidden="true" />
            Home
          </a>
          {navLinks.map((link) => (
            <a key={link} href="#" className="navbar-link">
              {link}
            </a>
          ))}
        </nav>

        <a href="#" className="navbar-login">
          Login
        </a>
      </div>
    </header>
  );
}
