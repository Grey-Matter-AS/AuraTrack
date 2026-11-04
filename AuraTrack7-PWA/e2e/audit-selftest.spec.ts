import { expect, test } from '@playwright/test';
import { auditInPage, type AuditOptions } from './audit-checks';

// An audit that cannot fail proves nothing. These pages are broken on purpose, one rule each, and the audit must name it;
// the clean page must pass.

const options = (checks: AuditOptions['checks']): AuditOptions => ({
  scope: null,
  minTap: 44,
  minContrast: 4.5,
  vertical: false,
  checks,
});
const page = (body: string) =>
  `<!doctype html><html><body style="margin:0;font:16px sans-serif;background:#fff;color:#000">${body}</body></html>`;

const cases: { name: string; kind: AuditOptions['checks'][number]; html: string }[] = [
  {
    name: 'two buttons covering each other',
    kind: 'overlap',
    html: '<button style="position:absolute;left:10px;top:10px;width:120px;height:50px">One</button><button style="position:absolute;left:60px;top:30px;width:120px;height:50px">Two</button>',
  },
  {
    name: 'text running over a button',
    kind: 'overlap',
    html: '<button style="position:absolute;left:10px;top:10px;width:150px;height:50px">Save</button><p style="position:absolute;left:20px;top:20px;margin:0">Some text</p>',
  },
  {
    name: 'a control off the side of the screen',
    kind: 'offscreen',
    html: '<button style="position:absolute;left:-40px;top:10px;width:120px;height:50px">Gone</button>',
  },
  {
    name: 'a control wider than the screen',
    kind: 'offscreen',
    html: '<div style="width:3000px;height:50px">wide</div>',
  },
  {
    name: 'a tap target under 44px',
    kind: 'tap-target',
    html: '<button style="width:30px;height:30px">x</button>',
  },
  {
    name: 'light grey text on white',
    kind: 'contrast',
    html: '<p style="color:#aaa">Hard to read</p>',
  },
  {
    name: 'text that fades with opacity',
    kind: 'contrast',
    html: '<p style="opacity:0.4">Faded</p>',
  },
  {
    name: 'an empty field whose hint is too faint',
    kind: 'contrast',
    html: '<style>input::placeholder{color:#bbb}</style><input placeholder="Name" style="height:48px">',
  },
  {
    name: 'text cut off by a box that hides overflow',
    kind: 'clipped',
    html: '<div style="width:60px;overflow:hidden;white-space:nowrap">A long line that does not fit</div>',
  },
  {
    name: 'a button whose text spills out of it',
    kind: 'clipped',
    html: '<button style="width:60px;height:48px;white-space:nowrap">Medikamenteneinnahme</button>',
  },
];

for (const c of cases) {
  test(`the audit catches ${c.name}`, async ({ page: p }) => {
    await p.setContent(page(c.html));
    const found = await p.evaluate(auditInPage, options([c.kind]));
    expect(found.map((v) => v.kind)).toContain(c.kind);
  });
}

test('the audit passes a clean page', async ({ page: p }) => {
  await p.setContent(
    page(`
      <button style="display:block;min-height:48px;min-width:120px">Save</button>
      <p style="margin:8px 0">Readable text</p>
      <label style="display:flex;gap:8px;min-height:48px;align-items:center"><input type="checkbox">Remember</label>
      <div style="width:100px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" class="ui-patient__name">An allowed truncated name</div>
    `),
  );
  const found = await p.evaluate(auditInPage, options(['overlap', 'clipped', 'offscreen', 'tap-target', 'contrast']));
  expect(found).toEqual([]);
});

test('text inside a scrolling area that is scrolled out of view does not count as overlapping what is below', async ({
  page: p,
}) => {
  await p.setContent(
    page(`
      <div style="height:60px;overflow-y:auto"><p style="margin:0;height:40px">Row 1</p><p style="margin:0;height:40px">Row 2</p><p style="margin:0;height:40px">Row 3</p></div>
      <p style="margin:0">Below</p>`),
  );
  expect(await p.evaluate(auditInPage, options(['overlap']))).toEqual([]);
});
