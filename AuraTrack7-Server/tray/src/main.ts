import { spawn } from 'node:child_process';
import SysTray from 'systray2';
import { iconFor } from './icons';
import { trayModel, type HubStatusJson } from './model';

// The tray icon for AuraTrack Hub: a coloured dot, a few lines of facts, and a way to the status page. It only talks to the hub
// over localhost; if the hub is not running the dot is red. Quit it from its menu. Settings: HUB_PORT (8420).
const port = Number(process.env.HUB_PORT ?? 8420);
const base = `http://localhost:${port}`;

async function readStatus(): Promise<HubStatusJson | null> {
  try {
    const res = await fetch(`${base}/status.json`, { signal: AbortSignal.timeout(3000) });
    return res.ok ? ((await res.json()) as HubStatusJson) : null;
  } catch {
    return null;
  }
}

function openPage(url: string) {
  const [cmd, args] =
    process.platform === 'darwin'
      ? ['open', [url]]
      : process.platform === 'win32'
        ? ['cmd', ['/c', 'start', '', url]]
        : ['xdg-open', [url]];
  spawn(cmd as string, args as string[], { stdio: 'ignore', detached: true }).unref();
}

async function main() {
  let model = trayModel(await readStatus(), Date.now());
  const tray = new SysTray({
    menu: {
      icon: iconFor(model.light, process.platform),
      title: '',
      tooltip: model.tooltip,
      items: model.items.map((i) => ({ title: i.title, tooltip: '', enabled: i.enabled, checked: false })),
    },
    debug: false,
    copyDir: true,
  });
  tray.onClick((action) => {
    const item = model.items[action.seq_id];
    if (item?.id === 'open') openPage(`${base}/status`);
    if (item?.id === 'quit') {
      void tray.kill(true);
      process.exit(0);
    }
  });
  const refresh = async () => {
    const next = trayModel(await readStatus(), Date.now());
    if (JSON.stringify(next) === JSON.stringify(model)) return;
    model = next;
    await tray.sendAction({
      type: 'update-menu',
      menu: {
        icon: iconFor(model.light, process.platform),
        title: '',
        tooltip: model.tooltip,
        items: model.items.map((i) => ({ title: i.title, tooltip: '', enabled: i.enabled, checked: false })),
      },
      seq_id: -1,
    } as never);
  };
  setInterval(() => void refresh(), 10_000);
}

void main();
