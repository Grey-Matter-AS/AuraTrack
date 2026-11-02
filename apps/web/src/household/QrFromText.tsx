import { useEffect, useState } from 'react';
import { useApp } from '../app/AppContext';
import { QrSvg } from '../screens/QrSvg';

/** A QR code of some text, made in the worker. */
export function QrFromText({ text, label, level = 'M' }: { text: string; label: string; level?: 'L' | 'M' }) {
  const { api } = useApp();
  const [matrix, setMatrix] = useState<{ size: number; dark: boolean[] } | null>(null);
  useEffect(() => {
    let alive = true;
    void api
      .qrMatrix({ text, level })
      .then((m) => alive && setMatrix(m))
      .catch(() => alive && setMatrix(null));
    return () => {
      alive = false;
    };
  }, [api, text, level]);
  return matrix ? <QrSvg size={matrix.size} dark={matrix.dark} label={label} /> : null;
}
