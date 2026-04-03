import { getSeededVendor } from "@/lib/demo/seedData";
import { getMissingDocuments } from "@/lib/vendors/status";

export async function findMissingDocuments(vendorId: string) {
  const vendor = getSeededVendor(vendorId);
  return {
    vendorId,
    vendorName: vendor.name,
    missing: getMissingDocuments(vendor),
  };
}
