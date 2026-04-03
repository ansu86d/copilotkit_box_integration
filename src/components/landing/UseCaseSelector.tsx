"use client";

import { USE_CASES, type UseCase } from "@/lib/demo/useCases";

interface Props {
  onSelect: (useCaseId: string) => void;
}

export function UseCaseSelector({ onSelect }: Props) {
  return (
    <div className="landing">
      <header className="landing__hero">
        <div className="landing__hero-inner">
          <div className="landing__brand">
            <div className="landing__brand-mark">
              <svg width="22" height="22" viewBox="0 0 32 32" fill="none">
                <rect width="32" height="32" rx="8" fill="#0061D5" />
                <path
                  d="M16 7.5L7.5 12.5V22.5L16 27.5L24.5 22.5V12.5L16 7.5Z"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinejoin="round"
                  fill="none"
                />
                <circle cx="16" cy="17.5" r="3" fill="white" />
              </svg>
            </div>
            <span className="landing__brand-name">Box</span>
          </div>
          <p className="landing__eyebrow">Vendor Onboarding Copilot</p>
          <h1 className="landing__headline">
            Choose your workflow
          </h1>
          <p className="landing__subheadline">
            Select a scenario to open the AI-powered control surface. Each workflow has a pre-configured vendor, live Box integration, and guided prompt playbook.
          </p>
        </div>
      </header>

      <div className="landing__cases">
        {USE_CASES.map((uc) => (
          <UseCaseCard key={uc.id} useCase={uc} onSelect={onSelect} />
        ))}
      </div>

      <footer className="landing__footer">
        <span className="landing__footer-chip">CopilotKit</span>
        <span className="landing__footer-sep">·</span>
        <span className="landing__footer-chip">Box Platform</span>
        <span className="landing__footer-sep">·</span>
        <span className="landing__footer-chip">GPT-4.1</span>
      </footer>
    </div>
  );
}

function UseCaseCard({ useCase, onSelect }: { useCase: UseCase; onSelect: (id: string) => void }) {
  return (
    <div
      className={`uc-card uc-card--${useCase.id}`}
      style={{ "--uc-accent": useCase.accentHex } as React.CSSProperties}
    >
      <div className="uc-card__top">
        <div className="uc-card__icon-wrap">
          <span className="uc-card__emoji">{useCase.emoji}</span>
        </div>
        <div className={`uc-card__badge uc-card__badge--${useCase.badgeVariant}`}>
          {useCase.badge}
        </div>
      </div>

      <div className="uc-card__body">
        <p className="uc-card__subtitle">{useCase.subtitle}</p>
        <h2 className="uc-card__title">{useCase.title}</h2>
        <p className="uc-card__desc">{useCase.description}</p>
      </div>

      <ul className="uc-card__caps">
        {useCase.capabilities.map((cap) => (
          <li key={cap} className="uc-card__cap">
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" className="uc-card__check">
              <circle cx="7" cy="7" r="6.5" stroke="currentColor" strokeOpacity="0.3" />
              <path d="M4.5 7l2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {cap}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="uc-card__cta"
        onClick={() => onSelect(useCase.id)}
      >
        Open workflow
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 7h8M8 4l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
