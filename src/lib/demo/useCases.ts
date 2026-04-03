export interface UseCase {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  emoji: string;
  vendorId: string;
  badge: string;
  badgeVariant: "green" | "amber" | "blue" | "warning";
  capabilities: string[];
  prompts: string[];
  accentHex: string;
}

export const USE_CASES: UseCase[] = [
  {
    id: "vendor-intake",
    title: "New Vendor Intake",
    subtitle: "Workspace provisioning",
    description:
      "Onboard a new high-risk vendor from scratch — provision a Box workspace, generate intake upload forms, and begin structured document collection.",
    emoji: "🏗",
    vendorId: "vendor-acme-logistics",
    badge: "Medium Risk · US",
    badgeVariant: "amber",
    capabilities: [
      "Provision Box folder structure",
      "Create vendor intake file request",
      "Track required document checklist",
    ],
    prompts: [
      "Create onboarding workspace for Acme Logistics.",
      "Create an intake upload form for Acme Logistics.",
      "What documents are still missing for Acme Logistics?",
      "Fill the intake PDF for Acme Logistics with: Company Name: Acme Logistics, Address: 123 Main St Chicago IL 60601, Phone: 312-555-0100, Email: info@acme-logistics.com, Website: acme-logistics.com, Contact: John Smith - VP Operations, Contact Email: jsmith@acme-logistics.com, Services: Freight forwarding and last-mile delivery, Established: 2004, Annual Sales: $8M, Legal Structure: LLC",
    ],
    accentHex: "#1756a8",
  },
  {
    id: "document-review",
    title: "Document Review",
    subtitle: "Compliance verification",
    description:
      "Route uploaded vendor documents to the right reviewers, check coverage gaps, assign Box review tasks, and verify compliance before sign-off.",
    emoji: "📋",
    vendorId: "vendor-acme-logistics",
    badge: "Under Review",
    badgeVariant: "amber",
    capabilities: [
      "Check document coverage gaps",
      "Assign reviewers with scoped Box access",
      "Create Box review tasks on files",
    ],
    prompts: [
      "What documents are still missing for Acme Logistics?",
      "Assign legal@acme-logistics.com as reviewer for the security questionnaire.",
      "Create an intake upload form for Acme Logistics.",
    ],
    accentHex: "#0c6a4e",
  },
  {
    id: "sign-closeout",
    title: "Sign & Close",
    subtitle: "NDA execution",
    description:
      "Send the NDA for Box Sign, track live signature request status, and generate the final onboarding status report for audit.",
    emoji: "✍️",
    vendorId: "vendor-acme-logistics",
    badge: "Signature Pending",
    badgeVariant: "blue",
    capabilities: [
      "Send Box Sign signature request",
      "Track sign request live status",
      "Generate onboarding summary report",
    ],
    prompts: [
      "Prepare the NDA for signature with signer legal@acme-logistics.com and summarize the current onboarding status.",
      "What documents are still missing for Acme Logistics?",
      "Create onboarding workspace for Acme Logistics.",
    ],
    accentHex: "#6b2fa0",
  },
  {
    id: "fill-intake-pdf",
    title: "Fill Intake PDF",
    subtitle: "Automated form completion",
    description:
      "Send free-form vendor information through the Copilot and watch it fill the intake PDF form field-by-field using AI + pypdf, then push the file to the review folder automatically.",
    emoji: "📝",
    vendorId: "vendor-acme-logistics",
    badge: "AI-Powered",
    badgeVariant: "green",
    capabilities: [
      "LLM extracts fields from free-form text",
      "pypdf fills the intake PDF form",
      "Auto-uploads to intake & review folder",
    ],
    prompts: [
      "Fill the intake PDF for Acme Logistics with: Company Name: Acme Logistics, Address: 123 Main St Chicago IL 60601, Phone: 312-555-0100, Email: info@acme-logistics.com, Website: acme-logistics.com, Contact: John Smith - VP Operations, Contact Email: jsmith@acme-logistics.com, Services: Freight forwarding and last-mile delivery, Established: 2004, Annual Sales: $8M, Legal Structure: LLC",
      "What documents are still missing for Acme Logistics?",
      "Create onboarding workspace for Acme Logistics.",
    ],
    accentHex: "#0c6a4e",
  },
];

export function getUseCaseById(id: string): UseCase {
  return USE_CASES.find((uc) => uc.id === id) ?? USE_CASES[0];
}
