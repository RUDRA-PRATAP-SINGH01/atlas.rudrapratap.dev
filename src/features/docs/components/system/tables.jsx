import React from "react";

function TableShell({ caption, headers, children, className = "" }) {
  return (
    <div className="docs-table-wrap">
      <table className={`docs-table ${className}`.trim()}>
        {caption && <caption>{caption}</caption>}
        {headers && (
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} scope="col">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TechnicalTable({ caption, headers, rows }) {
  return (
    <TableShell caption={caption} headers={headers}>
      {rows.map((row, i) => (
        <tr key={row.id || i}>
          {row.cells.map((cell, j) =>
            j === 0 && row.rowHeader !== false ? (
              <th key={j} scope="row">
                {cell}
              </th>
            ) : (
              <td key={j}>{cell}</td>
            ),
          )}
        </tr>
      ))}
    </TableShell>
  );
}

export function ComparisonTable({ caption, headers, rows }) {
  return <TechnicalTable caption={caption} headers={headers} rows={rows} />;
}

export function DecisionMatrix({ caption, headers, rows }) {
  return <TechnicalTable caption={caption} headers={headers || ["Decision", "Option A", "Option B", "Chosen"]} rows={rows} />;
}

export function StateOwnershipTable({ caption, rows }) {
  return (
    <TechnicalTable
      caption={caption || "State ownership"}
      headers={["State", "Owner", "Scope", "Notes"]}
      rows={rows}
    />
  );
}

export function FailureMatrix({ caption, rows }) {
  return (
    <TechnicalTable
      caption={caption || "Failure matrix"}
      headers={["Failure", "Detection", "Mitigation", "User impact"]}
      rows={rows}
    />
  );
}

export function GuaranteeMatrix({ caption, rows }) {
  return (
    <TechnicalTable
      caption={caption || "Guarantees"}
      headers={["Guarantee", "Strength", "Evidence", "Boundary"]}
      rows={rows}
    />
  );
}

/** Escape hatch for pages that already have <tr> children */
export function DocsTable({ caption, headers, children }) {
  return (
    <TableShell caption={caption} headers={headers}>
      {children}
    </TableShell>
  );
}
