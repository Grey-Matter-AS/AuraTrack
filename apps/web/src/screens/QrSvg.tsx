/** A QR code drawn from its grid of squares, as one picture with a name for a screen reader. */
export function QrSvg({ size, dark, label }: { size: number; dark: boolean[]; label: string }) {
  const margin = 2;
  const total = size + margin * 2;
  const squares: string[] = [];
  for (let row = 0; row < size; row++)
    for (let col = 0; col < size; col++)
      if (dark[row * size + col]) squares.push(`M${col + margin} ${row + margin}h1v1h-1z`);
  return (
    <svg viewBox={`0 0 ${total} ${total}`} role="img" aria-label={label} className="app-qr" shapeRendering="crispEdges">
      <rect width={total} height={total} fill="#fff" />
      <path d={squares.join('')} fill="#000" />
    </svg>
  );
}
