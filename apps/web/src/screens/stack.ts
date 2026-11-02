import { createScreenStack } from '@auratrack/ui';
import { Editor } from '../editor/Editor';
import { holder, type Nav } from '../editor/nav';
import { Review } from '../editor/Review';
import { Home } from './Home';
import { Sets } from './Sets';

// The screens behind Home: the seizure editor, Review, and the saved sets. Recording takes over the whole screen instead
// (see AppRoot), so there is nothing to navigate away from while it runs.
export const stack = createScreenStack({ home: Home, editor: Editor, review: Review, sets: Sets });
holder.useNavigator = stack.useNavigator as unknown as () => Nav;
