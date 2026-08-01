export function HuntIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 240" className={className} role="img" aria-label="A playful camera searching for objects">
      <path d="M30 197h300" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M88 157c0-35 23-61 59-61h42c39 0 63 25 63 61v40H88z" fill="#ffd348" stroke="currentColor" strokeWidth="4" />
      <rect x="115" y="55" width="121" height="91" rx="18" fill="white" stroke="currentColor" strokeWidth="4" transform="rotate(4 115 55)" />
      <circle cx="179" cy="102" r="28" fill="#76a9fa" stroke="currentColor" strokeWidth="4" />
      <circle cx="179" cy="102" r="11" fill="white" stroke="currentColor" strokeWidth="4" />
      <path d="M140 57l12-18h46l13 21" fill="white" stroke="currentColor" strokeWidth="4" strokeLinejoin="round" />
      <path d="M104 164c-25-11-45-3-55 22M250 159c26-10 44 1 54 22" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M66 146l-22-13m20-12l-27-2m37-16l-18-20M286 139l24-10m-19-13l26-5m-37-12l17-22" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function WaitingIllustration({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 250" className={className} role="img" aria-label="A steaming cup waiting for the game">
      <path d="M45 207h270" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M112 99h139v79c0 29-20 42-47 42h-45c-27 0-47-13-47-42z" fill="white" stroke="currentColor" strokeWidth="4" />
      <path d="M251 121h17c32 0 31 67 0 67h-17" fill="none" stroke="currentColor" strokeWidth="4" />
      <path d="M145 80c-17-19 15-30 0-51m43 51c-17-19 16-30 0-51m43 51c-16-19 16-30 0-51" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      <path d="M113 127c42 19 89 19 138 0v51c0 29-20 42-47 42h-45c-27 0-47-13-47-42z" fill="#f4a261" opacity=".8" />
      <circle cx="156" cy="157" r="4" /><circle cx="207" cy="157" r="4" /><path d="M171 178c8 5 16 5 24 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
