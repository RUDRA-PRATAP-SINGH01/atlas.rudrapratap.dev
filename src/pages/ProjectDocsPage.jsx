import Navbar from "../components/Navbar";

export default function ProjectDocsPage() {
  return (
    <div className="project-docs-page min-h-[100dvh] bg-black">
      <Navbar />
      <main className="project-docs-main px-6 md:px-12">
        <div className="mx-auto w-full max-w-[1400px]">
          <h1 className="scroll-panel-title">Project Docs</h1>
          <p className="scroll-panel-body">
            Documentation for Atlas guides, architecture notes, and implementation
            context.
          </p>
        </div>
      </main>
    </div>
  );
}
