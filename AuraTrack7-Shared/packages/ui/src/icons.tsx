import type { SVGProps } from 'react';

// The icons the kit itself draws. Decorative: the control that holds one carries the accessible name.
const base = (props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
  width: '1em',
  height: '1em',
  ...props,
});

export const CloseIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
export const HomeIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M4 11l8-7 8 7" />
    <path d="M6 10v10h12V10" />
  </svg>
);
export const LockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="5" y="11" width="14" height="9" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const BackIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
);
export const CalendarIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </svg>
);
export const ClockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </svg>
);
export const ChevronDownIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);
