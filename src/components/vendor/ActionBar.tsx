"use client";

import { useState } from "react";

import { useCopilotChat } from "@copilotkit/react-core";
import { MessageRole, TextMessage } from "@copilotkit/runtime-client-gql";

interface Props {
  prompts: string[];
}

export function ActionBar({ prompts }: Props) {
  const { appendMessage, isLoading } = useCopilotChat();
  const [sent, setSent] = useState<Set<string>>(new Set());

  async function handlePromptClick(prompt: string) {
    if (isLoading || sent.has(prompt)) {
      return;
    }

    setSent((prev) => new Set(prev).add(prompt));
    await appendMessage(
      new TextMessage({
        role: MessageRole.User,
        content: prompt,
      }),
    );
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <div>
          <p className="eyebrow">Walkthrough helpers</p>
          <h3>Demo prompts</h3>
        </div>
        <span className="panel__badge">Playbook</span>
      </div>
      <p className="panel__lead">
        Use these prompts to step through the workflow and trigger live Box actions.
      </p>
      <div className="prompt-grid">
        {prompts.map((prompt) => (
          <button
            key={prompt}
            type="button"
            className={`prompt-chip${sent.has(prompt) ? " prompt-chip--sent" : ""}`}
            onClick={() => void handlePromptClick(prompt)}
            disabled={isLoading || sent.has(prompt)}
          >
            {sent.has(prompt) ? "✓ Sent" : prompt}
          </button>
        ))}
      </div>
    </section>
  );
}

