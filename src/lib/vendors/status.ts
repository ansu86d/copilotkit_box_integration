import type { VendorRecord, VendorWorkspace } from "@/types/vendor";

import { requiredDocuments } from "@/lib/vendors/requiredDocuments";

export function getMissingDocuments(vendor: VendorRecord) {
  return requiredDocuments
    .filter((requiredDocument) => {
      const match = vendor.documents.find((document) => document.type === requiredDocument.type);
      return !match || match.status === "missing" || match.status === "rejected";
    })
    .map((requiredDocument) => ({
      type: requiredDocument.type,
      label: requiredDocument.label,
      reason: `${requiredDocument.label} has not been approved yet.`,
    }));
}

export function getReceivedDocuments(vendor: VendorRecord) {
  return vendor.documents.map((document) => ({
    label: document.name,
    status: document.status,
  }));
}

export function buildStatusHeadline(vendor: VendorRecord, workspace?: VendorWorkspace) {
  const missingCount = getMissingDocuments(vendor).length;

  if (!workspace) {
    return {
      headline: "Workspace has not been provisioned yet.",
      nextAction: "Create the vendor workspace and intake folder structure.",
    };
  }

  if (missingCount > 0) {
    return {
      headline: `${missingCount} required document${missingCount === 1 ? " is" : "s are"} still missing.`,
      nextAction: "Generate or resend the file request and ask the vendor to upload the missing items.",
    };
  }

  if (vendor.phase === "signature_pending") {
    return {
      headline: "The document package is review-complete and waiting for signature.",
      nextAction: "Send the NDA or MSA for signature.",
    };
  }

  return {
    headline: "Vendor onboarding is on track.",
    nextAction: "Review the audit timeline and close out the onboarding package.",
  };
}
