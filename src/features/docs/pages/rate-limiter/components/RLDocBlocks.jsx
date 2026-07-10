/**
 * Backward-compatible aliases over the shared docs component system.
 * New pages should import from `@/features/docs/components/system`.
 */
export {
  PageThesis as RLThesis,
  QuickModel as RLQuickModel,
  EvidenceBadge as RLEvidenceBadge,
  SourceExcerpt as RLSourceExcerpt,
  RelatedPages as RLRelatedPages,
  MetricGrid as RLStatGrid,
  TechnicalCallout,
  EvidenceBadge,
  EvidencePanel,
  SourceExcerpt,
  RelatedPages,
  MetricGrid,
  MetricCard,
  DocsGrid,
  DocsTable,
  MermaidDiagram,
  PageThesis,
  QuickModel,
  DecisionRecord,
  Invariant,
  Guarantee,
  Limitation,
  FailureScenario,
  TradeoffPanel,
  DesignRationale,
  CodeBlock,
  RequestFlow,
  FlowStep,
  ArchitectureDiagram,
  StateOwnershipTable,
  FailureMatrix,
  GuaranteeMatrix,
  ComparisonTable,
  TechnicalTable,
  LatencySummary,
  BeforeAfterMetric,
  EvidenceSource,
  FileReference,
  ImplementationNote,
} from "@/features/docs/components/system";

import { TechnicalCallout } from "@/features/docs/components/system";

/** Maps legacy RLCallout variants onto TechnicalCallout types. */
export function RLCallout({ variant = "info", title, children }) {
  const type = variant === "limitation" ? "limitation" : variant;
  return (
    <TechnicalCallout type={type} title={title}>
      {children}
    </TechnicalCallout>
  );
}
