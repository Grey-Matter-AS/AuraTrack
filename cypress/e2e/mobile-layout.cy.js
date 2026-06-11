/* global cy, expect */

import { richCaretakerScenario } from '../support/scenarios';

describe('AuraTrack mobile layout', () => {
  it('separates the header actions cleanly on narrow phones', () => {
    cy.viewport(320, 568);
    cy.launchAuraTrack(richCaretakerScenario());

    cy.window().then((win) => {
      const historyButton = [...win.document.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('HISTORY'));
      const settingsButton = [...win.document.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('SETTINGS'));
      const helpButton = [...win.document.querySelectorAll('button')]
        .find((button) => button.getAttribute('aria-label') === 'Help');

      expect(historyButton).to.not.equal(undefined);
      expect(settingsButton).to.not.equal(undefined);
      expect(helpButton).to.not.equal(undefined);

      const historyRect = historyButton.getBoundingClientRect();
      const settingsRect = settingsButton.getBoundingClientRect();
      const helpRect = helpButton.getBoundingClientRect();

      expect(Math.abs(historyRect.top - settingsRect.top)).to.be.lessThan(2);
      expect(settingsRect.left).to.be.greaterThan(historyRect.right);
      expect(settingsRect.top).to.be.greaterThan(helpRect.bottom - 2);
      expect(win.document.documentElement.scrollWidth - win.document.documentElement.clientWidth).to.be.lessThan(3);
    });
  });

  it('keeps export date selectors stacked on narrow screens', () => {
    cy.viewport(320, 568);
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
    cy.viewport(320, 568);
    cy.launchAuraTrack(richCaretakerScenario());
    cy.contains('button', 'START TIMER').click();

    cy.window().then((win) => {
      const scrollRegion = win.document.querySelector('[data-scroll-region="recording"]');
      const stopButton = [...win.document.querySelectorAll('button')]
        .find((button) => button.textContent?.trim() === 'STOP TIMER');
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

  [
    { name: 'phone landscape', width: 568, height: 320 },
    { name: 'tablet portrait', width: 820, height: 1180 },
    { name: 'tablet landscape', width: 1180, height: 820 },
  ].forEach(({ name, width, height }) => {
    it(`keeps key timer controls readable and unclipped on ${name}`, () => {
      cy.viewport(width, height);
      cy.launchAuraTrack(richCaretakerScenario());
      cy.contains('button', 'START TIMER').should('be.visible');

      cy.window().then((win) => {
        const root = win.document.documentElement;
        const startButton = [...win.document.querySelectorAll('button')]
          .find((button) => button.textContent?.includes('START TIMER'));

        expect(root.scrollWidth - root.clientWidth).to.be.lessThan(3);
        expect(startButton).to.not.equal(undefined);
        expect(startButton.scrollWidth - startButton.clientWidth).to.be.lessThan(3);
      });

      cy.contains('button', 'START TIMER').click();
      cy.contains('button', 'END AURA TIMER').should(height < 500 ? 'exist' : 'be.visible');

      cy.window().then((win) => {
        const root = win.document.documentElement;
        const scrollRegion = win.document.querySelector('[data-scroll-region="recording"]');
        const labels = ['END AURA TIMER', 'END SEIZURE TIMER', '+ EVENT NOTE', 'STOP TIMER'];

        expect(root.scrollWidth - root.clientWidth).to.be.lessThan(3);
        labels.forEach((label) => {
          const button = [...win.document.querySelectorAll('button')]
            .find((candidate) => candidate.textContent?.includes(label));

          expect(button, `${label} exists`).to.not.equal(undefined);
          expect(button.scrollWidth - button.clientWidth, `${label} text fits`).to.be.lessThan(3);
        });

        if (height < 500) {
          expect(scrollRegion.scrollHeight).to.be.greaterThan(scrollRegion.clientHeight);
        }
      });
    });
  });
});
