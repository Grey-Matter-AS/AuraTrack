/* global cy, expect */

import { richCaretakerScenario } from '../support/scenarios';

describe('AuraTrack mobile layout', () => {
  beforeEach(() => {
    cy.viewport(320, 568);
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

  it('keeps the recording page fully scrollable on small phones', () => {
    cy.launchAuraTrack(richCaretakerScenario());
    cy.contains('button', 'START').click();

    cy.window().then((win) => {
      const scrollRegion = win.document.querySelector('[data-scroll-region="recording"]');
      const stopButton = [...win.document.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'STOP');
      const stopWrapper = stopButton?.parentElement;
      const beforeRect = stopButton?.getBoundingClientRect();

      expect(scrollRegion).to.not.equal(null);
      expect(stopButton).to.not.equal(undefined);
      expect(win.getComputedStyle(stopWrapper).position).to.not.equal('sticky');
      expect(win.getComputedStyle(stopWrapper).position).to.not.equal('fixed');
      expect(scrollRegion.scrollHeight).to.be.greaterThan(scrollRegion.clientHeight);
      expect(beforeRect.top).to.be.greaterThan(win.innerHeight);

      scrollRegion.scrollTop = scrollRegion.scrollHeight;
      scrollRegion.dispatchEvent(new win.Event('scroll'));

      const afterRect = stopButton.getBoundingClientRect();
      expect(afterRect.bottom).to.be.at.most(win.innerHeight);
      expect(afterRect.top).to.be.at.least(0);
    });
  });
});
