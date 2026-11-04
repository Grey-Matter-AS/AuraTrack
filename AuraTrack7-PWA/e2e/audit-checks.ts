// The checks of the layout audit. `auditInPage` runs inside the browser (Playwright serialises it), so it must not use
// anything from outside itself. It looks at what is on the screen right now and returns every rule it finds broken.

export interface Violation {
  kind: 'overlap' | 'clipped' | 'offscreen' | 'tap-target' | 'contrast';
  where: string;
  detail: string;
}

export interface AuditOptions {
  /** CSS selector for the parts of the page to check (all matches). Null: the whole page. */
  scope: string | null;
  /** Smallest tap target in CSS px. */
  minTap: number;
  /** Smallest text contrast. */
  minContrast: number;
  /** Check vertical placement too (for overlays, which must fit inside the screen). */
  vertical: boolean;
  /** Which checks to run. */
  checks: ('overlap' | 'clipped' | 'offscreen' | 'tap-target' | 'contrast')[];
}

export function auditInPage(options: AuditOptions): Violation[] {
  const out: Violation[] = [];
  const seen = new Set<string>();
  const report = (kind: Violation['kind'], el: Element | string, detail: string) => {
    const where = typeof el === 'string' ? el : describe(el);
    const key = `${kind}|${where}|${detail}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ kind, where, detail });
  };
  const describe = (el: Element): string => {
    const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 28);
    const cls = typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 2).join('.') : '';
    return `<${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}>${text ? ' "' + text + '"' : ''}`;
  };

  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const roots = options.scope ? [...document.querySelectorAll(options.scope)] : [document.body];
  const all = roots.flatMap((root) => [root, ...root.querySelectorAll('*')]);
  const run = (kind: AuditOptions['checks'][number]) => options.checks.includes(kind);

  const style = new Map<Element, CSSStyleDeclaration>();
  const css = (el: Element): CSSStyleDeclaration => {
    let s = style.get(el);
    if (!s) {
      s = getComputedStyle(el);
      style.set(el, s);
    }
    return s;
  };
  const decorative = (el: Element) => el.closest('[aria-hidden="true"]') !== null;
  const visible = (el: Element) => {
    if (el.getClientRects().length === 0) return false;
    const s = css(el);
    return s.visibility !== 'hidden' && s.display !== 'none';
  };
  const els = all.filter(
    (el) => visible(el) && !['SCRIPT', 'STYLE', 'HEAD', 'TITLE', 'META', 'LINK', 'HTML'].includes(el.tagName),
  );

  // The part of an element that can be seen: cut to the boxes of the ancestors that scroll or hide overflow
  const visibleRect = (el: Element, r: DOMRect) => {
    let { left, top, right, bottom } = r;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const s = css(node);
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
      const c = node.getBoundingClientRect();
      if (s.overflowX !== 'visible') {
        left = Math.max(left, c.left);
        right = Math.min(right, c.right);
      }
      if (s.overflowY !== 'visible') {
        top = Math.max(top, c.top);
        bottom = Math.min(bottom, c.bottom);
      }
    }
    return { left, top, right, bottom };
  };

  const INTERACTIVE = 'button, a[href], input:not([type="hidden"]), select, textarea, [role="tab"], [role="switch"]';
  const interactive = (el: Element) => el.matches(INTERACTIVE);

  // ── Off the screen: sideways always; up and down as well for overlays
  if (run('offscreen')) {
    const doc = document.documentElement;
    if (doc.scrollWidth > doc.clientWidth + 1)
      report(
        'offscreen',
        'page',
        `the page scrolls sideways (${doc.scrollWidth}px wide on a ${doc.clientWidth}px screen)`,
      );
    for (const el of els) {
      if (el === document.body || decorative(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      if (css(el).clip !== 'auto' && css(el).position === 'absolute' && r.width <= 1) continue;
      if (r.left < -1 || r.right > vw + 1)
        report('offscreen', el, `sideways: ${Math.round(r.left)} to ${Math.round(r.right)} on a ${vw}px screen`);
      if (
        options.vertical &&
        (r.top < -1 || r.bottom > vh + 1) &&
        !el.closest('.ui-sheet__body, .ui-dialog, .ui-scroll')
      )
        report('offscreen', el, `up or down: ${Math.round(r.top)} to ${Math.round(r.bottom)} on a ${vh}px screen`);
    }
  }

  // ── Clipped: content that does not fit its own box and is cut off, or spills out of it
  if (run('clipped')) {
    for (const el of els) {
      if (['INPUT', 'TEXTAREA', 'SELECT', 'svg', 'path', 'circle', 'rect', 'text', 'g'].includes(el.tagName)) continue;
      if (el.closest('.ui-header--hidden')) continue; // for screen readers only: nobody sees it, so nothing is cut off
      const s = css(el);
      if (s.display === 'inline' || el.clientWidth === 0) continue;
      const ellipsis = s.textOverflow === 'ellipsis' && s.whiteSpace === 'nowrap';
      const scrollsX = s.overflowX === 'auto' || s.overflowX === 'scroll';
      const scrollsY = s.overflowY === 'auto' || s.overflowY === 'scroll';
      if (!ellipsis && !scrollsX && el.scrollWidth > el.clientWidth + 1)
        report('clipped', el, `content is ${el.scrollWidth}px wide in a ${el.clientWidth}px box`);
      if (!scrollsY && s.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 1)
        report('clipped', el, `content is ${el.scrollHeight}px tall in a ${el.clientHeight}px box`);
    }
    // Single-line truncation is allowed only where the design says so (names, hints); everything else must show in full
    for (const el of els) {
      const s = css(el);
      if (
        s.textOverflow === 'ellipsis' &&
        el.scrollWidth > el.clientWidth + 1 &&
        !el.matches('.ui-patient__name, .ui-tabs__picker-name, .ui-date__hint, select.ui-field')
      )
        report('clipped', el, 'text is cut short with an ellipsis where it should show in full');
    }
  }

  // ── Tap targets
  if (run('tap-target')) {
    for (const el of els) {
      if (!interactive(el) || decorative(el)) continue;
      if ((el as HTMLButtonElement).disabled && !el.matches('.ui-btn')) continue;
      const box =
        el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')
          ? (el.closest('label') ?? el)
          : el;
      const r = box.getBoundingClientRect();
      if (r.width < options.minTap - 0.5 || r.height < options.minTap - 0.5)
        report(
          'tap-target',
          el,
          `${Math.round(r.width * 10) / 10} x ${Math.round(r.height * 10) / 10}px, needs at least ${options.minTap}`,
        );
    }
  }

  // ── Overlap: no two controls, or pieces of text, may cover each other
  if (run('overlap')) {
    interface Box {
      el: Element;
      left: number;
      top: number;
      right: number;
      bottom: number;
    }
    const boxes: Box[] = [];
    for (const el of els) {
      if (decorative(el)) continue;
      if (interactive(el)) {
        if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) continue; // its label is the control
        boxes.push({ el, ...visibleRect(el, el.getBoundingClientRect()) });
        continue;
      }
      if (el.closest(INTERACTIVE) || el.closest('label')) continue; // text inside a control is part of the control
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
      );
      if (!hasText) continue;
      const range = document.createRange();
      range.selectNodeContents(el);
      const r = range.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) boxes.push({ el, ...visibleRect(el, r) });
    }
    // Labels hold a checkbox and its text: they count as one control
    for (const label of els.filter((el) => el.tagName === 'LABEL' && el.querySelector('input[type="checkbox"]'))) {
      boxes.push({ el: label, ...visibleRect(label, label.getBoundingClientRect()) });
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]!;
        const b = boxes[j]!;
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (w > 1 && h > 1)
          report('overlap', a.el, `covers ${describe(b.el)} by ${Math.round(w)} x ${Math.round(h)}px`);
      }
    }
  }

  // ── Contrast
  if (run('contrast')) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const rgba = (color: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const over = (
      top: [number, number, number, number],
      under: [number, number, number, number],
    ): [number, number, number, number] => {
      const a = top[3] + under[3] * (1 - top[3]);
      if (a === 0) return [0, 0, 0, 0];
      const mix = (i: 0 | 1 | 2) => (top[i] * top[3] + under[i] * under[3] * (1 - top[3])) / a;
      return [mix(0), mix(1), mix(2), a];
    };
    const background = (el: Element): [number, number, number, number] => {
      const layers: [number, number, number, number][] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const c = rgba(css(node).backgroundColor);
        if (c[3] > 0) layers.push(c);
        if (c[3] === 1) break;
      }
      let result: [number, number, number, number] = [255, 255, 255, 1];
      for (const layer of layers.reverse()) result = over(layer, result);
      return result;
    };
    const opacityOf = (el: Element): number => {
      let o = 1;
      for (let node: Element | null = el; node; node = node.parentElement) o *= Number(css(node).opacity);
      return o;
    };
    const luminance = ([r, g, b]: [number, number, number, number]) => {
      const f = (v: number) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const check = (el: Element, colorText: string, what: string) => {
      const bg = background(el);
      let fg = rgba(colorText);
      fg = [fg[0], fg[1], fg[2], fg[3] * opacityOf(el)];
      const text = over(fg, bg);
      const l1 = luminance(text);
      const l2 = luminance(bg);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      if (ratio < options.minContrast)
        report(
          'contrast',
          el,
          `${what} ${ratio.toFixed(2)}:1 (needs ${options.minContrast}), text ${colorText} on rgb(${bg.slice(0, 3).map(Math.round).join(' ')})`,
        );
    };
    for (const el of els) {
      if (decorative(el) || (el as HTMLButtonElement).disabled || el.closest('[inert]')) continue;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) continue;
        if (el.value !== '') check(el, css(el).color, 'value');
        else if (el.placeholder) check(el, getComputedStyle(el, '::placeholder').color, 'placeholder');
        continue;
      }
      if (el instanceof HTMLSelectElement) {
        check(el, css(el).color, 'selected option');
        continue;
      }
      const hasText = [...el.childNodes].some(
        (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '',
      );
      if (hasText) check(el, css(el).color, 'text');
    }
    // The hint drawn inside an empty date field is aria-hidden, but it is the only text the person sees there
    for (const hint of els.filter((el) => el.matches('.ui-date__hint'))) check(hint, css(hint).color, 'hint');
  }

  return out;
}
