import type { UseCase } from "@/lib/demo/useCases";

interface Props {
  useCase: UseCase;
  onBack: () => void;
}

export function Header({ useCase, onBack }: Props) {
  return (
    <header className="hero-header">
      <div className="hero-header__copy">
        <button type="button" className="back-button" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M10 7H4M4 7l3-3M4 7l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All workflows
        </button>
        <p className="eyebrow" style={{ marginTop: "10px" }}>Vendor Onboarding Copilot · {useCase.subtitle}</p>
        <h1>{useCase.title}</h1>
        <p className="hero-header__lead">
          {useCase.description}
        </p>
      </div>
      <div className="hero-header__meta">
        <div className="hero-stat-card">
          <span className="muted-label">Platform</span>
          <strong>CopilotKit + Box CLI</strong>
        </div>
        <div className="hero-stat-card hero-stat-card--accent">
          <span className="muted-label">Mode</span>
          <strong><span className="live-dot">Operator Assisted</span></strong>
        </div>
      </div>
    </header>
  );
}

