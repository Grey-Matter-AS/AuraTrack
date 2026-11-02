import { createScreenStack } from '@auratrack/ui';
import { Editor } from '../editor/Editor';
import { holder, type Nav } from '../editor/nav';
import { Review } from '../editor/Review';
import { About } from './About';
import { Backup } from './Backup';
import { Detail } from './Detail';
import { DoseGrid } from './DoseGrid';
import { Eeg } from './Eeg';
import { EegSession } from './EegSession';
import { Help } from './Help';
import { History } from './History';
import { Home } from './Home';
import { MedDetail } from './MedDetail';
import { MedEdit } from './MedEdit';
import { Medicines } from './Medicines';
import { More } from './More';
import { Patients } from './Patients';
import { ReportPreview } from './ReportPreview';
import { Reports } from './Reports';
import { Settings, SettingsGroup } from './Settings';
import { Sets } from './Sets';
import { Wellbeing } from './Wellbeing';

// The screens: the main places (Home, History, Medicines, More), and what opens from them. Recording takes over the whole
// screen instead (see AppRoot), so there is nothing to navigate away from while it runs.
export const stack = createScreenStack({
  home: Home,
  history: History,
  meds: Medicines,
  more: More,
  editor: Editor,
  review: Review,
  sets: Sets,
  patients: Patients,
  settings: Settings,
  settingsGroup: SettingsGroup,
  help: Help,
  about: About,
  backup: Backup,
  reports: Reports,
  reportPreview: ReportPreview,
  detail: Detail,
  medEdit: MedEdit,
  medDetail: MedDetail,
  doseGrid: DoseGrid,
  eeg: Eeg,
  eegSession: EegSession,
  wellbeing: Wellbeing,
});
holder.useNavigator = stack.useNavigator as unknown as () => Nav;
