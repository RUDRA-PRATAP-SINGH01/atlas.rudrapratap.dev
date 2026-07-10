import { CodeBlock } from "@/features/docs/components/system/code";

/** @deprecated Prefer CodeBlock from the docs component system. */
export default function GoCodeBlock({ children }) {
  return <CodeBlock language="go">{children}</CodeBlock>;
}
