// The words of the hub screens (M7): connecting a hub, its status, switching it off, and (later) push alerts, in English: the
// source for the other languages in ./tr.ts. Keys start with `hub.` or `push.`.
export const m7en = {
  'hub.title': 'Hub',
  'hub.none':
    'A hub is a program on a household computer (or a Raspberry Pi or NAS) that is always on. With one, devices update while their apps are closed, and the household has a daily backup. It only ever holds sealed data that it cannot read.',
  'hub.noneLimit':
    'Without a hub everything keeps working: devices update each other when two of them are open at the same time.',
  'hub.connect': 'Connect a hub',
  'hub.address': 'Hub address',
  'hub.addressHelp': 'It starts with https:// and is shown on the hub’s status page.',
  'hub.code': 'Code from the hub',
  'hub.codeHelp': 'The hub’s status page shows it. It is only for setting up.',
  'hub.go': 'Connect',
  'hub.connected': 'Connected to {address}',
  'hub.state.idle': 'In step with the hub',
  'hub.state.syncing': 'Syncing with the hub…',
  'hub.state.unreachable':
    'The hub did not answer. Recording and saving are not affected, and devices still update each other.',
  'hub.state.not_allowed':
    'The hub does not let this device in. It may have been removed from the household, or the hub was set up again.',
  'hub.state.off': 'No hub',
  'hub.last': 'Last in step {when}',
  'hub.never': 'Not in step yet',
  'hub.syncNow': 'Sync with the hub now',
  'hub.off': 'Switch the hub off',
  'hub.offTitle': 'Switch the hub off?',
  'hub.offText':
    'Devices go back to updating each other when two of them are open at the same time. The hub keeps what it holds until you delete it there.',
  'hub.offConfirm': 'Switch off',
  'hub.err.unreachable':
    'Nothing answered at that address. Check the address, and that the hub is running and reachable from here.',
  'hub.err.wrong_code': 'That code is not the hub’s. It is on the hub’s status page.',
  'hub.err.not_a_hub': 'That address answered, but it is not an AuraTrack Hub.',
  'hub.err.not_allowed': 'The hub did not accept this device.',
  'hub.err.no_household': 'Start a household first.',
  'hub.err.insecure': 'The address must start with https://. The app only talks to https addresses.',
  'hub.openFromHub':
    'If this app is open at a different address from the hub’s (for example the one on Vercel), the browser blocks the hub on purpose. Open the app from the hub’s own address instead: {address}',
  'hub.unreadable':
    'Changes at the hub that this device cannot open yet: {count}. They open as soon as this device meets another device of the household, which brings the new keys.',
  'hub.row': 'Hub',
  'hub.note': 'Changes from the hub: {count}',
  'hub.sealed':
    'The hub holds only sealed data. It has no key, so it cannot read a name, a note or a time inside a record.',
  'push.title': 'Alerts on this device',
  'push.help':
    'Get a notification when another device of the household starts recording, passes the alert time or has recorded a seizure, even when this app is closed. The notification says only “AuraTrack” and asks you to open the app: nothing about health is shown on the lock screen.',
  'push.on': 'Alerts on this device',
  'push.events': 'Tell me when',
  'push.event.started': 'a recording starts',
  'push.event.alert': 'a seizure passes the alert time',
  'push.event.recorded': 'a seizure has been recorded',
  'push.people': 'For these people',
  'push.everyone': 'Everyone',
  'push.requirements':
    'iPhone and iPad: alerts work only after AuraTrack is added to the Home Screen, on iOS 16.4 or later. The maker of the device’s push service carries the message: it sees that a message went to this device, not what it says.',
  'push.state.needs_home_screen': 'Add AuraTrack to the Home Screen first (Share, then Add to Home Screen).',
  'push.state.unsupported': 'This browser cannot show alerts.',
  'push.state.blocked': 'Notifications are blocked for this site in the browser’s settings.',
  'push.err.denied': 'Notifications were not allowed, so alerts are off.',
  'push.err.failed': 'Alerts could not be turned on. Check that the hub can be reached, and try again.',
  'push.limit':
    'Alerts need the hub and this device’s permission. They are best effort: they can be late or missing if the device is off, saving battery or offline. They never replace watching the person or following the emergency plan.',
  'push.locked': 'A recording started from the PIN screen sends its alert once the app is unlocked.',
  'push.notificationTitle': 'AuraTrack',
  'push.notificationBody': 'Open AuraTrack',
} as const;
