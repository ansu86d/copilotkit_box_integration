"use client";

import { CopilotPanel } from "@/components/copilot/CopilotPanel";
import { Header } from "@/components/layout/Header";
import { ActionBar } from "@/components/vendor/ActionBar";
import { DocumentTable } from "@/components/vendor/DocumentTable";
import { LiveFolderStatus } from "@/components/vendor/LiveFolderStatus";
import { MissingDocsPanel } from "@/components/vendor/MissingDocsPanel";
import { VendorOverview } from "@/components/vendor/VendorOverview";
import { getSeededVendor, seededWorkspaces } from "@/lib/demo/seedData";
import { getUseCaseById } from "@/lib/demo/useCases";
import { getMissingDocuments } from "@/lib/vendors/status";

interface Props {
  useCaseId: string;
  onBack: () => void;
}

export function AppShell({ useCaseId, onBack }: Props) {
  const useCase = getUseCaseById(useCaseId);
  const vendor = getSeededVendor(useCase.vendorId);
  const workspace = seededWorkspaces[vendor.id];
  const missingDocuments = getMissingDocuments(vendor);

  return (
    <div className="app-shell">
      <Header useCase={useCase} onBack={onBack} />
      <main className="app-grid">
        <section className="workspace-column shell-column shell-column--workspace">
          <div className="shell-column__header">
            <div>
              <p className="eyebrow">Operations workspace</p>
              <h2>Live vendor posture</h2>
            </div>
            <p className="shell-column__lead">
              Review risk, document coverage, and workflow readiness before you trigger Box actions.
            </p>
          </div>
          <VendorOverview vendor={vendor} workspace={workspace} />
          <div className="workspace-subgrid">
            <DocumentTable documents={vendor.documents} />
            <MissingDocsPanel missing={missingDocuments} />
          </div>
          <LiveFolderStatus workspace={workspace} />
          <ActionBar prompts={useCase.prompts} />
        </section>
        <section className="shell-column shell-column--copilot">
          <CopilotPanel />
        </section>
      </main>
    </div>
  );
}

