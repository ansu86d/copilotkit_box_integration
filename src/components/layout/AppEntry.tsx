"use client";

import { useState } from "react";

import { UseCaseSelector } from "@/components/landing/UseCaseSelector";
import { AppShell } from "@/components/layout/AppShell";

export function AppEntry() {
  const [useCaseId, setUseCaseId] = useState<string | null>(null);

  if (!useCaseId) {
    return <UseCaseSelector onSelect={setUseCaseId} />;
  }

  return <AppShell useCaseId={useCaseId} onBack={() => setUseCaseId(null)} />;
}
