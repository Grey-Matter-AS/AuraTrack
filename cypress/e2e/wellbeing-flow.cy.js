/* global cy, expect */

describe('AuraTrack wellbeing flow', () => {
  it('keeps key wellbeing and manual-entry controls usable on small screens', () => {
    cy.viewport(320, 568);
    cy.launchAuraTrack();

    cy.contains('button', /Log Past Seizure/i)
      .should('be.visible')
      .then(($button) => {
        const styles = getComputedStyle($button[0]);
        expect(styles.backgroundColor).to.not.equal('rgba(0, 0, 0, 0)');
        expect(styles.borderTopStyle).to.not.equal('none');
      });

    cy.contains('Daily wellbeing check-in').should('be.visible');
    cy.contains('button', /^Log$/).click();

    cy.get('[data-testid="wellbeing-entry-sheet"]').should('be.visible');
    cy.get('[data-testid="wellbeing-entry-scroll"]').then(($scroll) => {
      const el = $scroll[0];
      expect(el.scrollHeight).to.be.greaterThan(el.clientHeight);
      expect(getComputedStyle(el).overflowY).to.match(/auto|scroll/);
    });

    cy.contains('Sleep quality').scrollIntoView().should('be.visible');
    ['Poor', 'Fair', 'Good', 'Restful'].forEach((label) => {
      cy.contains('button', label).should('exist');
    });
    cy.contains('button', 'Restful').click();
    cy.contains('button', 'Save').click();

    cy.countStoreRows('wellbeingEntries').should('eq', 1);
  });
});
