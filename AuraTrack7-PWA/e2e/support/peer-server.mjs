// A PeerJS signalling server for the end-to-end tests, on this computer only. It stands in for the public broker, so the
// tests never reach the internet. Started by playwright.config.ts.
import { PeerServer } from 'peer';

PeerServer({ port: 9199, path: '/', allow_discovery: false });
console.log('peer server on 9199');
