function IconFrame({ children, className = 'w-5 h-5' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function DownloadIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M12 4v10" />
      <path d="m8 10 4 4 4-4" />
      <path d="M5 18h14" />
    </IconFrame>
  );
}

export function UploadIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M12 20V10" />
      <path d="m8 14 4-4 4 4" />
      <path d="M5 6h14" />
    </IconFrame>
  );
}

export function SyncIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M3 12a7 7 0 0 1 12-4.95" />
      <path d="M15 3v4h-4" />
      <path d="M21 12a7 7 0 0 1-12 4.95" />
      <path d="M9 21v-4h4" />
    </IconFrame>
  );
}

export function InstallIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M12 3v10" />
      <path d="m8 9 4 4 4-4" />
      <path d="M5 19h14" />
    </IconFrame>
  );
}

export function CloseIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </IconFrame>
  );
}

export function EditIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="m4 20 4.5-1 9-9-3.5-3.5-9 9L4 20Z" />
      <path d="m12.5 6.5 3.5 3.5" />
      <path d="M14 5.5 16 3.5 20.5 8 18.5 10" />
    </IconFrame>
  );
}

export function GripIcon({ className }) {
  return (
    <IconFrame className={className}>
      <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="1" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function TrashIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M8 7v12" />
      <path d="M16 7v12" />
      <path d="M6 7l1 13h10l1-13" />
    </IconFrame>
  );
}

export function ResetIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M3 12a9 9 0 1 0 3-6.71" />
      <path d="M3 4v5h5" />
    </IconFrame>
  );
}

export function EyeIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.75" />
    </IconFrame>
  );
}

export function FileStackIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M8 3h7l4 4v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h6" />
    </IconFrame>
  );
}

export function TableIcon({ className }) {
  return (
    <IconFrame className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 10h16" />
      <path d="M10 10v9" />
      <path d="M15 10v9" />
    </IconFrame>
  );
}

export function ReportIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M8 3h7l4 4v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
      <path d="M15 3v4h4" />
      <path d="M9 12h6" />
      <path d="M9 16h4" />
    </IconFrame>
  );
}

export function StethoscopeIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M7 4v5a5 5 0 0 0 10 0V4" />
      <path d="M7 4H5" />
      <path d="M19 4h-2" />
      <path d="M12 14v2a4 4 0 0 0 8 0v-1" />
      <circle cx="20" cy="14" r="2" />
    </IconFrame>
  );
}

export function CalendarIcon({ className }) {
  return (
    <IconFrame className={className}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <path d="M8 14h3" />
      <path d="M13 14h3" />
    </IconFrame>
  );
}

export function ActivityIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M3 12h4l2-4 4 8 2-4h6" />
    </IconFrame>
  );
}

export function HistoryIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M4 12a8 8 0 1 0 2.34-5.66" />
      <path d="M4 4v4h4" />
      <path d="M12 8v4l3 2" />
    </IconFrame>
  );
}

export function SettingsIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="m12 2.8 1.55 1.35 2.03-.3.92 1.86 1.97.63.08 2.05 1.63 1.25-.76 1.9.76 1.9-1.63 1.25-.08 2.05-1.97.63-.92 1.86-2.03-.3L12 21.2l-1.55-1.35-2.03.3-.92-1.86-1.97-.63-.08-2.05-1.63-1.25.76-1.9-.76-1.9 1.63-1.25.08-2.05 1.97-.63.92-1.86 2.03.3L12 2.8Z" />
      <circle cx="12" cy="12" r="3.1" />
    </IconFrame>
  );
}

export function HelpIcon({ className }) {
  return (
    <IconFrame className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.75 9a2.55 2.55 0 1 1 4.36 1.8c-.8.78-1.61 1.3-1.61 2.45" />
      <circle cx="12" cy="16.8" r="0.7" fill="currentColor" stroke="none" />
    </IconFrame>
  );
}

export function ArrowRightIcon({ className }) {
  return (
    <IconFrame className={className}>
      <path d="M5 12h14" />
      <path d="m13 7 6 5-6 5" />
    </IconFrame>
  );
}
