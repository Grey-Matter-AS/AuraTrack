import { ToastProvider, createScreenStack } from '@auratrack/ui';
import './prototype.css';
import { Editor } from './Editor';
import { Home } from './Home';
import { Lock } from './Lock';
import { Recording } from './Recording';
import { Review } from './Review';
import { holder, type Nav } from './nav';
import { PrototypeProvider } from './state';

// M3, slice 4: the clickable prototype of recording and logging. Made-up data; nothing is saved. It exists so the flow can
// be tried on a phone and changed before the real build. Route: #/prototype.

const stack = createScreenStack({ home: Home, record: Recording, editor: Editor, review: Review, lock: Lock });
holder.useNavigator = stack.useNavigator as unknown as () => Nav;

export default function Prototype() {
  return (
    <PrototypeProvider>
      <ToastProvider>
        <stack.ScreenStack initial="home" />
      </ToastProvider>
    </PrototypeProvider>
  );
}
