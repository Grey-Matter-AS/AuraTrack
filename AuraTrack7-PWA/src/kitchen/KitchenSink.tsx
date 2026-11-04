import KitchenM4 from './KitchenM4';
import { useState } from 'react';
import {
  AppHeader,
  BottomSheet,
  Button,
  ButtonRow,
  Card,
  Checkbox,
  ChipGroup,
  ChoiceList,
  Cluster,
  DateTimeField,
  DecimalField,
  Dialog,
  EmptyState,
  FieldRow,
  IconButton,
  Inset,
  NumberField,
  Screen,
  ScrollArea,
  Section,
  Select,
  Stack,
  Tabs,
  TextArea,
  TextField,
  Toggle,
  CloseIcon,
  ToastProvider,
  createScreenStack,
  useToast,
} from '@auratrack/ui';

// Every component of the kit in every state, on one page. It is what the layout audit walks (apps/web/e2e/audit.spec.ts)
// and what the visual baselines photograph, in each device size, theme, accent colour and text size.
// The texts include the longest labels of the nine languages, because those are what break a layout.

const LONG = 'Medikamenteneinnahmeprotokoll';
const FINNISH = 'Epilepsiakohtauksen jälkitila';
const options = [
  { value: 'a', label: 'Short' },
  { value: 'b', label: 'A somewhat longer label' },
  { value: 'c', label: LONG },
  { value: 'd', label: FINNISH },
];

function Tabbed({ count, labels }: { count: number; labels?: string[] }) {
  const all = ['Before', 'During', 'After', 'Details', 'Review', 'Medication'].slice(0, count);
  const tabs = all.map((label, i) => ({
    id: `t${i}`,
    label: labels?.[i] ?? label,
    ...(i === 1 ? { state: '2 added' } : {}),
  }));
  const [active, setActive] = useState('t0');
  return (
    <Tabs tabs={tabs} activeTab={active} onTabChange={setActive} label={`${count} tabs`}>
      <Stack>
        <p>Content of {tabs.find((t) => t.id === active)?.label}</p>
        <Button>Action inside the tab</Button>
      </Stack>
    </Tabs>
  );
}

const stack = createScreenStack({ first: First, second: Second });
function First() {
  const nav = stack.useNavigator();
  return (
    <Stack>
      <p>First screen</p>
      <Button onClick={() => nav.push('second')}>Open the second screen</Button>
    </Stack>
  );
}
function Second() {
  const nav = stack.useNavigator();
  return (
    <Stack>
      <p>Second screen</p>
      <Button onClick={() => nav.pop()}>Back</Button>
    </Stack>
  );
}

function Overlays() {
  const [open, setOpen] = useState<null | 'sheet' | 'long' | 'dialog' | 'danger' | 'stacked'>(null);
  const toast = useToast();
  const close = () => setOpen(null);
  return (
    <Section title="Overlays">
      <ButtonRow>
        <Button data-open="sheet" onClick={() => setOpen('sheet')}>
          Sheet
        </Button>
        <Button data-open="long" onClick={() => setOpen('long')}>
          Long sheet
        </Button>
        <Button data-open="dialog" onClick={() => setOpen('dialog')}>
          Dialog
        </Button>
        <Button data-open="danger" onClick={() => setOpen('danger')}>
          Danger dialog
        </Button>
        <Button data-open="stacked" onClick={() => setOpen('stacked')}>
          Dialog over sheet
        </Button>
        <Button
          data-open="toast"
          onClick={() => toast('Saved. This message is a little long to test wrapping.', 'success')}
        >
          Toast
        </Button>
      </ButtonRow>
      {open === 'sheet' ? (
        <BottomSheet
          title="Add a dose"
          onClose={close}
          footer={
            <Button variant="primary" fullWidth onClick={close}>
              Save
            </Button>
          }
        >
          <TextField label="Name" value="" onChange={() => {}} />
          <FieldRow split>
            <DecimalField label="Dose" value="" onChange={() => {}} />
            <Select label="Unit" options={[{ value: 'mg', label: 'mg' }]} value="mg" onChange={() => {}} />
          </FieldRow>
        </BottomSheet>
      ) : null}
      {open === 'long' ? (
        <BottomSheet
          title="Long content scrolls inside"
          onClose={close}
          footer={
            <Button fullWidth onClick={close}>
              Done
            </Button>
          }
        >
          {Array.from({ length: 24 }, (_, i) => (
            <Inset key={i}>Row {i + 1}: the body scrolls, the footer stays in view.</Inset>
          ))}
        </BottomSheet>
      ) : null}
      {open === 'dialog' || open === 'danger' ? (
        <Dialog
          title={open === 'danger' ? 'Delete this record?' : 'Stop recording?'}
          tone={open === 'danger' ? 'danger' : undefined}
          message="This message explains what happens next, in a few careful words."
          onClose={close}
          actions={
            <>
              <Button variant={open === 'danger' ? 'danger' : 'primary'} onClick={close}>
                Confirm
              </Button>
              <Button onClick={close}>Cancel</Button>
            </>
          }
        />
      ) : null}
      {open === 'stacked' ? (
        <BottomSheet title="Sheet below" onClose={close}>
          <Dialog
            title="Dialog on top"
            message="Only this one reacts to Escape."
            onClose={() => setOpen('sheet')}
            actions={<Button onClick={() => setOpen('sheet')}>OK</Button>}
          />
        </BottomSheet>
      ) : null}
    </Section>
  );
}

function Fields() {
  const [text, setText] = useState('Ola Nordmann');
  const [chosen, setChosen] = useState<string | null>('b');
  const [many, setMany] = useState<string[]>(['a', 'c']);
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [minutes, setMinutes] = useState(4);
  const [unit, setUnit] = useState('');
  return (
    <>
      <Section title="Choices">
        <ChipGroup label="Single" options={options} value={chosen} onChange={setChosen} />
        <ChipGroup label="Multiple, filling the row" fill multiple options={options} value={many} onChange={setMany} />
        <ChoiceList
          label="List"
          options={options.map((o) => ({ ...o, detail: 'A second line with detail' }))}
          value={chosen}
          onChange={setChosen}
        />
        <Cluster>
          <Toggle label="On" value={on} onChange={setOn} />
          <Toggle label="Off" value={false} onChange={() => {}} />
        </Cluster>
        <Checkbox
          checked={checked}
          onChange={setChecked}
          label={`Assume taken: ${LONG}`}
          help="Fills in doses without a tap, from the day it is turned on."
        />
        <Checkbox checked={false} onChange={() => {}} label="Not checked" />
      </Section>
      <Section title="Fields">
        <TextField label="Name" value={text} onChange={setText} help="As on the card" />
        <TextField label="Empty, so the label is the hint" value="" onChange={() => {}} />
        <TextField label="With an error" value="x" onChange={() => {}} error="This cannot be empty" />
        <TextArea label="Notes" value="" onChange={() => {}} />
        <FieldRow min="12rem">
          <DateTimeField label="Date" value="" onChange={() => {}} />
          <DateTimeField label="Date, filled" value="2026-10-31" onChange={() => {}} />
          <DateTimeField type="time" label="Time" value="" onChange={() => {}} />
          <DateTimeField type="time" label="Time, filled" value="08:30" onChange={() => {}} />
          <DateTimeField type="datetime-local" label="Date and time" value="" onChange={() => {}} />
          <DateTimeField type="month" label="Month" value="" onChange={() => {}} />
        </FieldRow>
        <FieldRow>
          <NumberField label="Minutes" value={minutes} onChange={setMinutes} />
          <NumberField label="Timer" compact value={12} onChange={() => {}} />
          <DecimalField label="Dose" value="0.5" onChange={() => {}} />
        </FieldRow>
        <FieldRow split>
          <TextField label="Medication" value={LONG} onChange={() => {}} />
          <Select
            label="Unit"
            options={[
              { value: 'mg', label: 'mg' },
              { value: 'ml', label: 'ml' },
            ]}
            value={unit}
            onChange={setUnit}
          />
        </FieldRow>
        <Select label="Select with a long option" options={options} value="c" onChange={() => {}} />
        <Select label="Value not in the list" options={options} value="own code" onChange={() => {}} />
      </Section>
    </>
  );
}

export default function KitchenSink() {
  if (window.location.hash === '#/kitchen/m4') return <KitchenM4 />;
  return (
    <ToastProvider>
      <Screen>
        <AppHeader
          title="Kitchen sink"
          patient={{ name: 'Ola Nordmann-Hansen with a very long name' }}
          onPatientClick={() => {}}
          onBack={() => {}}
          actions={<Button>Help</Button>}
        />
        <Section title="Buttons">
          <ButtonRow>
            <Button variant="primary">Primary</Button>
            <Button>Secondary</Button>
            <Button variant="success">Success</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="warning">Warning</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" size="lg">
              Large
            </Button>
            <Button disabled>Disabled</Button>
          </ButtonRow>
          <ButtonRow stack>
            <Button variant="primary" fullWidth>
              {LONG}
            </Button>
          </ButtonRow>
          <Cluster>
            <IconButton label="Close">
              <CloseIcon />
            </IconButton>
            <IconButton label="Accent" tone="accent">
              <CloseIcon />
            </IconButton>
            <IconButton label="Success" tone="success">
              <CloseIcon />
            </IconButton>
            <IconButton label="Danger" tone="danger">
              <CloseIcon />
            </IconButton>
          </Cluster>
        </Section>
        <Fields />
        <Section title="Containers">
          <Card>A plain card</Card>
          <Card tone="accent" compact>
            An accent card, compact: {FINNISH}
          </Card>
          <Card tone="danger">A danger card</Card>
          <Inset>An inset</Inset>
          <EmptyState>Nothing here yet</EmptyState>
          <ScrollArea maxHeight="8rem">
            {Array.from({ length: 6 }, (_, i) => (
              <Inset key={i}>Scrolling row {i + 1}</Inset>
            ))}
          </ScrollArea>
        </Section>
        <Section title="Tabs">
          <Tabbed count={2} />
          <Tabbed count={4} />
          <Tabbed count={6} labels={[LONG, FINNISH, 'Details', 'Review', 'Medication', 'Short']} />
        </Section>
        <Section title="Screen stack">
          <Card>
            <stack.ScreenStack initial="first" />
          </Card>
        </Section>
        <Overlays />
      </Screen>
    </ToastProvider>
  );
}
