export interface WebhookEvent {
  id: string;
  eventType: string;
  source: { type: string; name?: string; id?: string };
  createdBy?: string;
  createdAt: string;
}

export interface SignEvent {
  signRequestId: string;
  status: string;
  signerEmail?: string;
  documentName?: string;
  completedAt: string;
}

// In-memory ring buffer — survives hot reloads via `globalThis`
const g = globalThis as typeof globalThis & {
  _boxWebhookEvents?: WebhookEvent[];
  _boxSignEvents?: SignEvent[];
};
if (!g._boxWebhookEvents) g._boxWebhookEvents = [];
if (!g._boxSignEvents) g._boxSignEvents = [];

export function pushWebhookEvent(event: WebhookEvent): void {
  g._boxWebhookEvents!.unshift(event);
  if (g._boxWebhookEvents!.length > 50) g._boxWebhookEvents!.length = 50;
}

export function getWebhookEvents(limit = 10): WebhookEvent[] {
  return g._boxWebhookEvents!.slice(0, limit);
}

export function pushSignEvent(event: SignEvent): void {
  // Upsert by signRequestId — update status if already exists
  const existing = g._boxSignEvents!.findIndex((e) => e.signRequestId === event.signRequestId);
  if (existing >= 0) {
    g._boxSignEvents![existing] = event;
  } else {
    g._boxSignEvents!.unshift(event);
    if (g._boxSignEvents!.length > 20) g._boxSignEvents!.length = 20;
  }
}

export function getSignEvent(signRequestId: string): SignEvent | undefined {
  return g._boxSignEvents!.find((e) => e.signRequestId === signRequestId);
}

export function getLatestSignEvent(): SignEvent | undefined {
  return g._boxSignEvents![0];
}
