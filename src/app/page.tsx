import { CopilotPanel } from "@/components/copilot/CopilotPanel";
import { DocumentWizard } from "@/components/wizard/DocumentWizard";

export default function Home() {
  return (
    <div className="app-grid" style={{ padding: "0 24px 24px" }}>
      <section>
        <DocumentWizard />
      </section>
      <section className="shell-column--copilot">
        <CopilotPanel />
      </section>
    </div>
  );
}
