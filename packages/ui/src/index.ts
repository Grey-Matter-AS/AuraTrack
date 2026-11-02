// @auratrack/ui: the design system. Tokens (tokens.css), kit styles (ui.css), layout primitives and typed components.
// Screens use only these: no raw buttons, fields or overlays (enforced by lint).
export {
  Button,
  ButtonRow,
  CloseButton,
  IconButton,
  RoundButton,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  type IconButtonProps,
  type RoundButtonProps,
} from './Buttons';
export {
  Checkbox,
  ChipGroup,
  ChoiceList,
  Toggle,
  type CheckboxProps,
  type ChipGroupProps,
  type ChoiceListProps,
  type Option,
  type ToggleProps,
} from './Choices';
export { Card, EmptyState, Inset, Section, type CardProps } from './Containers';
export {
  DateTimeField,
  DecimalField,
  FieldRow,
  NumberField,
  Select,
  TextArea,
  TextField,
  type DateTimeFieldProps,
  type DateTimeType,
  type DecimalFieldProps,
  type NumberFieldProps,
  type SelectOption,
  type SelectProps,
  type TextAreaProps,
  type TextFieldProps,
} from './Fields';
export { FilePicker, type FilePickerProps } from './FilePicker';
export { AppHeader, type AppHeaderProps } from './Header';
export { Cluster, ScrollArea, Screen, Stack } from './Layout';
export { NavBar, type NavBarItem, type NavBarProps } from './NavBar';
export {
  PhaseStrip,
  PhaseTimeline,
  type PhaseStripProps,
  type TimelineEntry,
  type TimelinePhase,
} from './PhaseTimeline';
export { EventChart, TrendChart, type ChartEvent, type EventKind, type TrendBar, type TrendMarker } from './Charts';
export { createScreenStack, type Navigator, type ScreenMap } from './Navigator';
export { BottomSheet, Dialog, ToastProvider, useToast, type ToastTone } from './Overlays';
export { prefersReducedMotion, useReducedMotion } from './motion';
export { ENGLISH, UiStringsProvider, useUiStrings, type UiStrings } from './strings';
export { Tabs, type TabItem, type TabsProps } from './Tabs';
export { BackIcon, CalendarIcon, ChevronDownIcon, ClockIcon, CloseIcon } from './icons';
