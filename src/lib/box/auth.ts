import { getAppEnv, isPlaceholder } from "@/lib/config/env";

export function getBoxMode() {
  const env = getAppEnv();

  return {
    authMode: env.boxAuthMode,
    token: env.boxDeveloperToken,
    mock: isPlaceholder(env.boxDeveloperToken),
    fileRequestTemplateId: env.boxFileRequestTemplateId,
    metadataScope: env.boxMetadataScope,
    metadataTemplateKey: env.boxMetadataTemplateKey,
  };
}

export function assertBoxReady() {
  const mode = getBoxMode();

  if (mode.mock) {
    throw new Error("BOX_DEVELOPER_TOKEN is still a placeholder. Update your env file to run live Box commands.");
  }

  return mode;
}
