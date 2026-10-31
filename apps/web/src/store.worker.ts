// The Web Worker that owns the unlocked store: keys, the decrypted working set, merge, backup and import all live here,
// so the interface never stalls. The page talks to it through the typed interface in @auratrack/store.
import { createStoreApi } from '@auratrack/store';
import { serve, type PortLike } from '@auratrack/store/rpc';

const { api } = createStoreApi({ name: 'auratrack' });
serve(self as unknown as PortLike, api);
