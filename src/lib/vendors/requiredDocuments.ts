import type { VendorDocumentType } from "@/types/vendor";

export const requiredDocuments: Array<{
  type: VendorDocumentType;
  label: string;
  description: string;
}> = [
  {
    type: "w9",
    label: "W-9",
    description: "Tax documentation required before vendor activation.",
  },
  {
    type: "certificate_of_insurance",
    label: "Certificate of insurance",
    description: "Proof of coverage aligned with procurement policy.",
  },
  {
    type: "security_questionnaire",
    label: "Security questionnaire",
    description: "Security review packet for IT and compliance.",
  },
  {
    type: "nda",
    label: "Signed NDA",
    description: "Executed confidentiality agreement before data exchange.",
  },
];
