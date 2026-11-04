import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// The rules that keep screens inside the kit (eslint.config.js) are checked here, so they cannot quietly stop working.
const eslint = new ESLint({ cwd: process.cwd() });
const lint = async (code: string, filePath: string): Promise<string[]> => {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) => m.ruleId === 'no-restricted-syntax').map((m) => m.message);
};
const screen = 'AuraTrack7-PWA/src/screens/Example.tsx';

describe('lint rules for screens', () => {
  it.each([
    ['a raw button', 'export const A = () => <button>x</button>;'],
    ['a raw input', 'export const A = () => <input />;'],
    ['a raw select', 'export const A = () => <select />;'],
    ['a raw textarea', 'export const A = () => <textarea />;'],
    ['a raw dialog', 'export const A = () => <dialog />;'],
    ['a raw form', 'export const A = () => <form />;'],
    ['a raw link', 'export const A = () => <a href="/">x</a>;'],
  ])('refuses %s', async (_name, code) => {
    expect((await lint(code, screen))[0]).toContain('kit components');
  });

  it('refuses an own overlay and a z-index', async () => {
    expect((await lint("export const A = () => <div style={{ position: 'fixed' }} />;", screen))[0]).toContain(
      'Overlays',
    );
    expect((await lint("export const A = () => <div style={{ position: 'sticky' }} />;", screen))[0]).toContain(
      'Overlays',
    );
    expect((await lint('export const A = () => <div style={{ zIndex: 5 }} />;', screen))[0]).toContain('Overlays');
  });

  it('allows other positions', async () => {
    expect(await lint("export const A = () => <div style={{ position: 'relative' }} />;", screen)).toEqual([]);
  });

  it('refuses the browser dialogs', async () => {
    expect((await lint("export const f = () => window.confirm('x');", screen))[0]).toContain('kit Dialog');
    expect((await lint("export const f = () => alert('x');", screen))[0]).toContain('kit Dialog');
    expect((await lint("export const f = () => window.prompt('x');", screen))[0]).toContain('kit Dialog');
  });

  it('refuses toISOString in screens, for a day or for anything else', async () => {
    expect((await lint('export const f = () => new Date().toISOString().slice(0, 10);', screen))[0]).toContain('UTC');
    expect(await lint('export const f = () => new Date().toISOString();', screen)).toEqual([
      expect.stringContaining('Screens never need toISOString'),
    ]);
  });

  it('accepts kit components', async () => {
    const code = "import { Button } from '@auratrack/ui';\nexport const A = () => <Button>x</Button>;";
    expect(await lint(code, screen)).toEqual([]);
  });

  it('does not apply to the developer page, the entry file or tests', async () => {
    expect(await lint('export const A = () => <button>x</button>;', 'AuraTrack7-PWA/src/dev/DevPage.tsx')).toEqual([]);
    expect(await lint('export const A = () => <button>x</button>;', 'AuraTrack7-PWA/src/main.tsx')).toEqual([]);
    expect(await lint('export const A = () => <button>x</button>;', 'AuraTrack7-PWA/src/screens/A.test.tsx')).toEqual(
      [],
    );
  });
});

describe('lint rule for calendar days, everywhere', () => {
  it.each(['slice(0, 10)', 'substring(0, 10)', "split('T')[0]", 'substr(0, 10)'])(
    'refuses toISOString().%s',
    async (call) => {
      const code = `export const f = () => new Date().toISOString().${call};`;
      expect((await lint(code, 'AuraTrack7-Shared/packages/store/src/x.ts'))[0]).toContain('local-date helpers');
    },
  );

  it('allows toISOString for a timestamp outside screens', async () => {
    expect(
      await lint('export const f = () => new Date().toISOString();', 'AuraTrack7-Shared/packages/store/src/x.ts'),
    ).toEqual([]);
  });
});
