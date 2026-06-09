/* global cy */

import { richCaretakerScenario } from '../support/scenarios';

describe('AuraTrack core flows', () => {
  it('navigates seeded caretaker data across history, medications, EEG, and export', () => {
    cy.launchAuraTrack(richCaretakerScenario());

    cy.contains('button', 'START').should('be.visible');
    cy.contains('Focal Aware').should('exist');

    cy.contains('button', 'HISTORY').click();
    cy.contains('EEG Diary').should('be.visible');
    cy.contains('2 EVENTS').should('be.visible');

    cy.get('input[type="date"]').eq(0).clear().type('2026-06-08');
    cy.get('input[type="date"]').eq(1).clear().type('2026-06-08');
    cy.contains('No events found.').should('be.visible');

    cy.contains('button', 'Clear').click();
    cy.contains('Tonic-Clonic').should('be.visible');

    cy.contains('button', /^EEG Diary$/).click();
    cy.contains('Home EEG Session').should('be.visible');
    cy.contains(/Seizure reference/i).should('be.visible');

    cy.contains('button', /^Export$/).click();
    cy.contains('Neurologist Report').should('exist');
    cy.contains('Seizure Diary (Monthly)').scrollIntoView().should('be.visible');
    cy.get('input[type="month"]').should('have.value', '2026-06');

    cy.contains('button', 'SETTINGS').click();
    cy.contains('button', /^Medications$/).click();
    cy.contains('Lamotrigine').should('be.visible');
    cy.contains('Diazepam').should('be.visible');
  });

  it('adds a medication and logs a manual seizure through the UI', () => {
    cy.launchAuraTrack();

    cy.contains('button', 'SETTINGS').click();
    cy.contains('button', /^Medications$/).click();
    cy.contains('button', '+ Add Medication').click();

    cy.get('input[placeholder="Drug name (e.g. Levetiracetam)"]').type('Test Med');
    cy.get('input[placeholder="Dose"]').type('50');
    cy.contains('button', /^Add$/).click();

    cy.contains('Test Med').should('be.visible');

    cy.contains('button', 'BACK').click();
    cy.contains('button', '+ Log Past Seizure').click();

    cy.get('input[type="number"]').eq(0).clear().type('1');
    cy.get('input[type="number"]').eq(1).clear().type('30');
    cy.contains('button', 'Continue').click();

    cy.contains('Step 1: Seizure Type').should('be.visible');
    cy.contains('button', 'Skip for now').click();

    cy.contains('LAST 5').should('be.visible');
    cy.contains('button', 'HISTORY').click();
    cy.contains('Uncategorized').should('be.visible');
    cy.contains('Manual Entry').should('be.visible');
  });
});
