/* global cy, expect */

import { richCaretakerScenario } from '../support/scenarios';

describe('AuraTrack mobile layout', () => {
  beforeEach(() => {
    cy.viewport(390, 844);
  });

  it('keeps export date selectors stacked on narrow screens', () => {
    cy.launchAuraTrack(richCaretakerScenario());
    cy.contains('button', 'HISTORY').click();
    cy.contains('button', /^Export$/).click();

    cy.window().then((win) => {
      const stacks = [...win.document.querySelectorAll('.date-selector-stack')].map((stack) => {
        return [...stack.children].map((child) => child.getBoundingClientRect());
      });
      const monthRect = win.document.querySelector('input[type="month"]')?.getBoundingClientRect();
      const actionRect = win.document.querySelector('.date-selector-actions')?.getBoundingClientRect();

      expect(stacks.length).to.be.greaterThan(0);
      stacks.forEach((children) => {
        for (let index = 1; index < children.length; index += 1) {
          expect(children[index].top).to.be.at.least(children[index - 1].bottom);
          expect(Math.abs(children[index].left - children[index - 1].left)).to.be.lessThan(2);
        }
      });
      expect(monthRect).to.not.equal(undefined);
      expect(actionRect).to.not.equal(undefined);
      expect(actionRect.top).to.be.at.least(monthRect.bottom);
    });
  });

  it('keeps the stop button reachable on small recording screens', () => {
    cy.launchAuraTrack();
    cy.contains('button', 'START').click();

    cy.window().then((win) => {
      const stopButton = [...win.document.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'STOP');
      const rect = stopButton?.getBoundingClientRect();

      expect(rect).to.not.equal(undefined);
      expect(rect.bottom).to.be.at.most(win.innerHeight);
    });
  });
});
