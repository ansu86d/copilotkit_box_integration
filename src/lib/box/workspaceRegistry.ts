import { seededWorkspaces } from "@/lib/demo/seedData";
import type { VendorWorkspace } from "@/types/vendor";

const runtimeWorkspaces = new Map<string, VendorWorkspace>();

export function getWorkspaceForVendor(vendorId: string) {
  return runtimeWorkspaces.get(vendorId) ?? seededWorkspaces[vendorId];
}

export function setWorkspaceForVendor(workspace: VendorWorkspace) {
  runtimeWorkspaces.set(workspace.vendorId, workspace);
  return workspace;
}