import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ErrorBoundary } from './ErrorBoundary.jsx'
import PrivateModeGate from './PrivateModeGate.jsx'
import { checkFeatures } from './utils/checkFeatures.js'

const root = createRoot(document.getElementById('root'));

function renderApp() {
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}

checkFeatures().then((blocked) => {
  if (blocked.some(f => f.critical)) {
    root.render(
      <StrictMode>
        <PrivateModeGate blockedFeatures={blocked} onContinueAnyway={renderApp} />
      </StrictMode>
    );
  } else {
    renderApp();
  }
}).catch(() => renderApp());
