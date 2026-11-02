export interface LogoProps {
  src: string;
  /** Width and height in CSS pixels. */
  size: number;
}

/** The AuraTrack bird on its light tile, centred. Decorative: the name always stands in text beside it. */
export function Logo({ src, size }: LogoProps) {
  return <img className="ui-logo" src={src} alt="" width={size} height={size} />;
}
