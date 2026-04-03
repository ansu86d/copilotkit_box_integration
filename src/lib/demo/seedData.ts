import type { VendorRecord, VendorWorkspace } from "@/types/vendor";

export const seededWorkspaces: Record<string, VendorWorkspace> = {
  "vendor-acme-logistics": {
    id: "workspace-acme",
    vendorId: "vendor-acme-logistics",
    vendorName: "Acme Logistics",
    rootFolderId: "374621651394",
    subfolders: [
      { name: "01 Intake", folderId: "374620739067" },
      { name: "02 Review", folderId: "374620489799" },
      { name: "03 Signed", folderId: "374622009556" },
    ],
    fileRequestId: "fr-acme-template",
    fileRequestUrl: "https://box.example.com/file-request/acme",
    collaborationCount: 2,
    createdAt: "2026-03-28T17:15:00Z",
    source: "demo",
  },
};

export const seededVendors: VendorRecord[] = [
  {
    id: "vendor-acme-logistics",
    name: "Acme Logistics",
    legalName: "Acme Logistics, Inc.",
    owner: "Priya Shah",
    region: "US",
    riskTier: "medium",
    phase: "under_review",
    boxFolderId: "374621651394",
    fileRequestId: "fr-acme-template",
    signerEmail: "legal@acme-logistics.com",
    requiredDocuments: ["w9", "certificate_of_insurance", "security_questionnaire", "nda"],
    documents: [
      {
        id: "doc-acme-w9",
        name: "Acme_W9_2026.pdf",
        type: "w9",
        status: "approved",
        required: true,
        source: "demo",
        boxFileId: "7788001",
        uploadedAt: "2026-03-29T08:00:00Z",
        reviewer: "procurement@box.example",
      },
      {
        id: "doc-acme-coi",
        name: "Acme_COI.pdf",
        type: "certificate_of_insurance",
        status: "uploaded",
        required: true,
        source: "demo",
        boxFileId: "7788002",
        uploadedAt: "2026-03-29T09:20:00Z",
      },
      {
        id: "doc-acme-security",
        name: "Acme_Security_Questionnaire.xlsx",
        type: "security_questionnaire",
        status: "under_review",
        required: true,
        source: "demo",
        boxFileId: "7788003",
        uploadedAt: "2026-03-29T10:15:00Z",
      },
      {
        id: "doc-acme-nda",
        name: "Signed NDA",
        type: "nda",
        status: "missing",
        required: true,
        source: "box",
        boxFileId: "2185786487480",
        notes: "Signature request not yet sent.",
      },
    ],
    activity: [
      {
        id: "evt-acme-1",
        timestamp: "2026-03-28T17:15:00Z",
        title: "Workspace provisioned",
        detail: "Copilot created the vendor workspace and review folders.",
        actor: "Vendor Onboarding Copilot",
        source: "copilot",
      },
      {
        id: "evt-acme-2",
        timestamp: "2026-03-29T09:30:00Z",
        title: "Insurance certificate uploaded",
        detail: "The vendor uploaded the latest proof of insurance.",
        actor: "Acme Logistics",
        source: "box",
      },
      {
        id: "evt-acme-3",
        timestamp: "2026-03-29T10:30:00Z",
        title: "Security review assigned",
        detail: "A reviewer was assigned to the security questionnaire.",
        actor: "Priya Shah",
        source: "demo",
      },
    ],
  },
  {
    id: "vendor-nimbus-analytics",
    name: "Nimbus Analytics",
    legalName: "Nimbus Analytics LLC",
    owner: "Diego Ramos",
    region: "EU",
    riskTier: "high",
    phase: "collecting_documents",
    requiredDocuments: ["w9", "certificate_of_insurance", "security_questionnaire", "nda"],
    documents: [
      {
        id: "doc-nimbus-w9",
        name: "Nimbus_W9.pdf",
        type: "w9",
        status: "uploaded",
        required: true,
        source: "demo",
      },
      {
        id: "doc-nimbus-nda",
        name: "Signed NDA",
        type: "nda",
        status: "missing",
        required: true,
        source: "demo",
      },
    ],
    activity: [
      {
        id: "evt-nimbus-1",
        timestamp: "2026-03-30T11:00:00Z",
        title: "Intake opened",
        detail: "Vendor file request sent to Nimbus Analytics.",
        actor: "Vendor Onboarding Copilot",
        source: "copilot",
      },
    ],
  },
];

export function getSeededVendor(vendorId: string) {
  return seededVendors.find((vendor) => vendor.id === vendorId) ?? seededVendors[0];
}
