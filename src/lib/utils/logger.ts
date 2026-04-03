export function logInfo(message: string, details?: Record<string, unknown>) {
  console.info(`[vendor-onboarding] ${message}`, details ?? {});
}

export function logError(message: string, details?: Record<string, unknown>) {
  console.error(`[vendor-onboarding] ${message}`, details ?? {});
}
