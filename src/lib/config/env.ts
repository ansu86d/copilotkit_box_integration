const placeholderValues = new Set([
  "",
  "YOUR_LLM_API_KEY_HERE",
  "YOUR_BOX_DEVELOPER_TOKEN_HERE",
  "YOUR_FILE_REQUEST_TEMPLATE_ID_HERE",
]);

function readEnv(name: string, fallback = "") {
  return process.env[name]?.trim() ?? fallback;
}

export interface AppEnv {
  runtimeUrl: string;
  model: string;
  openAiApiKey: string;
  boxAuthMode: string;
  boxDeveloperToken: string;
  boxFileRequestTemplateId: string;
  boxMetadataScope: string;
  boxMetadataTemplateKey: string;
  boxWebhookUrl: string;
  boxWebhookSignatureKey: string;
}

export function getAppEnv(): AppEnv {
  return {
    runtimeUrl: readEnv("COPILOTKIT_RUNTIME_URL", "/api/copilotkit"),
    model: readEnv("COPILOTKIT_MODEL", "openai:gpt-4.1"),
    openAiApiKey: readEnv("OPENAI_API_KEY"),
    boxAuthMode: readEnv("BOX_AUTH_MODE", "developer-token"),
    boxDeveloperToken: readEnv("BOX_DEVELOPER_TOKEN"),
    boxFileRequestTemplateId: readEnv("BOX_FILE_REQUEST_TEMPLATE_ID"),
    boxMetadataScope: readEnv("BOX_METADATA_SCOPE", "enterprise"),
    boxMetadataTemplateKey: readEnv("BOX_METADATA_TEMPLATE_KEY", "vendorOnboarding"),
    boxWebhookUrl: readEnv("BOX_WEBHOOK_URL"),
    boxWebhookSignatureKey: readEnv("BOX_WEBHOOK_SIGNATURE_KEY"),
  };
}

export function isPlaceholder(value: string) {
  return placeholderValues.has(value);
}

export function getConfigHealth() {
  const env = getAppEnv();
  const boxReady = !isPlaceholder(env.boxDeveloperToken);

  return {
    runtimeUrl: env.runtimeUrl,
    model: env.model,
    llmReady: !isPlaceholder(env.openAiApiKey),
    boxReady,
    fileRequestTemplateReady: boxReady && !isPlaceholder(env.boxFileRequestTemplateId),
    fileRequestMode: boxReady ? "copy-from-template" : "demo",
    mockMode: isPlaceholder(env.boxDeveloperToken),
  };
}

export function assertRuntimeReady() {
  const health = getConfigHealth();

  if (!health.llmReady) {
    throw new Error("Missing OPENAI_API_KEY. Replace the placeholder in your local env file.");
  }

  return health;
}
