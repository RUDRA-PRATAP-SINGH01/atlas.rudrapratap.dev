import { Link } from "react-router-dom";
import DocsNavbar from "../components/DocsNavbar";
import DocsSidebar from "../components/DocsSidebar";
import {
  referenceSections,
  repositories,
  literature,
  industrySystems,
  algorithms,
  standards,
  osConcurrency,
  goEcosystem,
  environmentVariables,
  internalDocIndex,
} from "../data/pebbledbReferences";

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left",
  fontSize: 13,
  border: "1px solid rgba(255, 255, 255, 0.08)",
};

const thStyle = {
  padding: "10px 16px",
  color: "#ff5cad",
  fontWeight: 600,
};

const theadRowStyle = {
  background: "rgba(255, 92, 173, 0.08)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
};

const tdStyle = { padding: "10px 16px", verticalAlign: "top" };
const tdMonoStyle = { ...tdStyle, fontFamily: "monospace", color: "#ffffff" };
const tdBoldStyle = { ...tdStyle, fontWeight: 500, color: "#ffffff" };

function DocLinks({ docs }) {
  if (!docs?.length) return <span style={{ color: "#71717a" }}>—</span>;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px" }}>
      {docs.map((doc) => (
        <Link
          key={doc.path}
          to={doc.path}
          style={{ color: "#38bdf8", textDecoration: "none", fontSize: 12 }}
        >
          {doc.label} →
        </Link>
      ))}
    </div>
  );
}

function ExternalLink({ href, children }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: "#ff5cad", textDecoration: "none" }}
    >
      {children}
    </a>
  );
}

export default function ReferenceDocsPage() {
  return (
    <div className="guide-page min-h-[100dvh] bg-[#0b0b0b] text-[#d4d4d8]">
      <DocsNavbar />
      <div className="guide-layout-wrapper">
        <DocsSidebar />

        <main className="guide-main-content">
          <div className="guide-main-container">
            <h1 className="guide-main-title" id="overview">
              PebbleDB Reference
            </h1>

            <div className="guide-body-text" style={{ marginTop: 24 }}>
              <p>
                This page catalogs every external source, algorithm, standard, package, and environment variable referenced across the PebbleDB documentation. Use it as a single bibliography and quick-lookup index when reading the guide or exploring the codebase.
              </p>

              {/* ── Repositories ── */}
              <h2 className="guide-sub-heading" id="repositories" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Repositories &amp; Source
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {repositories.map((repo) => (
                  <div
                    key={repo.name}
                    style={{
                      background: "rgba(255, 92, 173, 0.03)",
                      border: "1px solid rgba(255, 92, 173, 0.12)",
                      borderRadius: 8,
                      padding: "16px 20px",
                    }}
                  >
                    <h3 style={{ margin: "0 0 8px", fontSize: 16, color: "#ffffff" }}>
                      <ExternalLink href={repo.href}>{repo.name}</ExternalLink>
                    </h3>
                    <p style={{ margin: "0 0 10px", fontSize: 13, color: "#a1a1aa" }}>{repo.description}</p>
                    {repo.docs && <DocLinks docs={repo.docs} />}
                  </div>
                ))}
              </div>

              {/* ── Literature ── */}
              <h2 className="guide-sub-heading" id="literature" style={{ fontSize: 22, color: "#ffffff", marginTop: 40, marginBottom: 12 }}>
                Academic &amp; Foundational Literature
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Publication</th>
                      <th style={thStyle}>Authors / Year</th>
                      <th style={thStyle}>Relevance</th>
                      <th style={thStyle}>Atlas Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {literature.map((item, i) => (
                      <tr
                        key={item.name}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                          background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        }}
                      >
                        <td style={tdStyle}>
                          <ExternalLink href={item.href}>{item.name}</ExternalLink>
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>
                          {item.authors}
                          <br />
                          <span style={{ color: "#71717a" }}>{item.year}</span>
                        </td>
                        <td style={tdStyle}>{item.description}</td>
                        <td style={tdStyle}><DocLinks docs={item.docs} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Industry ── */}
              <h2 className="guide-sub-heading" id="industry" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Industry Systems &amp; Projects
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>System</th>
                      <th style={thStyle}>Relation to PebbleDB</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}>Atlas Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {industrySystems.map((item, i) => (
                      <tr
                        key={item.name}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                          background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        }}
                      >
                        <td style={tdBoldStyle}>
                          {item.href ? (
                            <ExternalLink href={item.href}>{item.name}</ExternalLink>
                          ) : (
                            item.name
                          )}
                        </td>
                        <td style={tdStyle}>
                          <span className="highlight-text">{item.relation}</span>
                        </td>
                        <td style={tdStyle}>{item.description}</td>
                        <td style={tdStyle}><DocLinks docs={item.docs} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Algorithms ── */}
              <h2 className="guide-sub-heading" id="algorithms" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Algorithms &amp; Data Structures
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Algorithm / Structure</th>
                      <th style={thStyle}>Role in PebbleDB</th>
                      <th style={thStyle}>Atlas Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {algorithms.map((item, i) => (
                      <tr
                        key={item.name}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                          background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        }}
                      >
                        <td style={{ ...tdStyle, fontWeight: 500, color: "#ffffff" }}>{item.name}</td>
                        <td style={tdStyle}>{item.description}</td>
                        <td style={tdStyle}><DocLinks docs={item.docs} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Standards ── */}
              <h2 className="guide-sub-heading" id="standards" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Standards, Formats &amp; Encoding
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Standard / Format</th>
                      <th style={thStyle}>Usage</th>
                      <th style={thStyle}>External</th>
                      <th style={thStyle}>Atlas Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standards.map((item, i) => (
                      <tr
                        key={item.name}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                          background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        }}
                      >
                        <td style={{ ...tdStyle, fontWeight: 500, color: "#ffffff" }}>{item.name}</td>
                        <td style={tdStyle}>{item.description}</td>
                        <td style={tdStyle}>
                          {item.href ? (
                            <ExternalLink href={item.href}>Link →</ExternalLink>
                          ) : (
                            <span style={{ color: "#71717a" }}>—</span>
                          )}
                        </td>
                        <td style={tdStyle}><DocLinks docs={item.docs} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── OS & Concurrency ── */}
              <h2 className="guide-sub-heading" id="os-concurrency" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                OS &amp; Concurrency
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Primitive / Tool</th>
                      <th style={thStyle}>Usage</th>
                      <th style={thStyle}>External</th>
                      <th style={thStyle}>Atlas Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {osConcurrency.map((item, i) => (
                      <tr
                        key={item.name}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                          background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        }}
                      >
                        <td style={tdMonoStyle}>{item.name}</td>
                        <td style={tdStyle}>{item.description}</td>
                        <td style={tdStyle}>
                          {item.href ? (
                            <ExternalLink href={item.href}>Link →</ExternalLink>
                          ) : (
                            <span style={{ color: "#71717a" }}>—</span>
                          )}
                        </td>
                        <td style={tdStyle}><DocLinks docs={item.docs} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Go Ecosystem ── */}
              <h2 className="guide-sub-heading" id="go-ecosystem" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Go Toolchain &amp; Packages
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Package / Tool</th>
                      <th style={thStyle}>Role</th>
                      <th style={thStyle}>External</th>
                      <th style={thStyle}>Atlas Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {goEcosystem.map((item, i) => (
                      <tr
                        key={item.name}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                          background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        }}
                      >
                        <td style={tdMonoStyle}>{item.name}</td>
                        <td style={tdStyle}>{item.description}</td>
                        <td style={tdStyle}>
                          {item.href ? (
                            <ExternalLink href={item.href}>Link →</ExternalLink>
                          ) : (
                            <span style={{ color: "#71717a" }}>—</span>
                          )}
                        </td>
                        <td style={tdStyle}><DocLinks docs={item.docs} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Environment Variables ── */}
              <h2 className="guide-sub-heading" id="env-vars" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Environment Variables
              </h2>
              <div style={{ overflowX: "auto", marginBottom: 20 }}>
                <table style={tableStyle}>
                  <thead>
                    <tr style={theadRowStyle}>
                      <th style={thStyle}>Variable</th>
                      <th style={thStyle}>Description</th>
                      <th style={thStyle}>Default</th>
                      <th style={thStyle}>Atlas Docs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {environmentVariables.map((item, i) => (
                      <tr
                        key={item.name}
                        style={{
                          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
                          background: i % 2 === 0 ? "rgba(255, 255, 255, 0.02)" : "transparent",
                        }}
                      >
                        <td style={tdMonoStyle}>{item.name}</td>
                        <td style={tdStyle}>{item.description}</td>
                        <td style={{ ...tdStyle, color: "#a1a1aa", fontFamily: "monospace", fontSize: 12 }}>{item.default}</td>
                        <td style={tdStyle}><DocLinks docs={item.docs} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Internal Docs Index ── */}
              <h2 className="guide-sub-heading" id="internal-docs" style={{ fontSize: 22, color: "#ffffff", marginTop: 32, marginBottom: 12 }}>
                Internal Documentation Index
              </h2>
              <p>Quick links to every reference, format-spec, and lookup page in the PebbleDB guide.</p>

              {internalDocIndex.map((group) => (
                <div key={group.category} style={{ marginTop: 24 }}>
                  <h3 style={{ fontSize: 16, color: "#ff5cad", marginBottom: 12 }}>{group.category}</h3>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {group.items.map((item) => (
                      <Link
                        key={item.path}
                        to={item.path}
                        style={{
                          display: "block",
                          padding: "14px 18px",
                          background: "rgba(255, 255, 255, 0.02)",
                          border: "1px solid rgba(255, 255, 255, 0.06)",
                          borderRadius: 8,
                          textDecoration: "none",
                          color: "inherit",
                          transition: "border-color 0.15s ease",
                        }}
                      >
                        <span style={{ color: "#ffffff", fontWeight: 500, fontSize: 14 }}>{item.label}</span>
                        <span style={{ display: "block", marginTop: 4, fontSize: 13, color: "#a1a1aa" }}>{item.description}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>

        <aside className="guide-sidebar-right" aria-label="Page Outline">
          <div className="guide-sidebar-right-content">
            <h4 className="guide-sidebar-right-title">On This Page</h4>
            <ul className="guide-sidebar-right-list">
              {referenceSections.map((section) => (
                <li key={section.id} className="guide-sidebar-right-item">
                  <a href={`#${section.id}`} className="guide-sidebar-right-link">
                    {section.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
