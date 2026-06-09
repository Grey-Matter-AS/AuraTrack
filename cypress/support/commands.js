/* global Cypress, cy */

import { launchAuraTrackWithState, countRowsInStore } from './database';

Cypress.Commands.add('launchAuraTrack', (seed = {}) => {
  launchAuraTrackWithState(seed);
});

Cypress.Commands.add('countStoreRows', (storeName) => {
  return cy.window().then((win) => countRowsInStore(win, storeName));
});
