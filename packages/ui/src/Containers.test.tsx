// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Card, EmptyState, Inset, Section } from './Containers';
import { Cluster, ScrollArea, Screen, Stack } from './Layout';

afterEach(cleanup);

describe('Section', () => {
  it('has a heading when given a title, and none without', () => {
    const { rerender } = render(<Section title="Medication">body</Section>);
    expect(screen.getByRole('heading', { name: 'Medication' })).toBeTruthy();
    rerender(<Section>body</Section>);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('body')).toBeTruthy();
  });
});

describe('Card, Inset, EmptyState', () => {
  it('Card takes a tone, a compact size and another element', () => {
    const { container } = render(
      <Card tone="danger" compact as="article" aria-label="warning">
        x
      </Card>,
    );
    const card = container.firstElementChild!;
    expect(card.tagName).toBe('ARTICLE');
    expect(card.className).toBe('ui-card ui-card--compact ui-card--danger');
    expect(card.getAttribute('aria-label')).toBe('warning');
  });

  it('Card is a plain div without options', () => {
    const { container } = render(<Card>x</Card>);
    expect(container.firstElementChild?.tagName).toBe('DIV');
    expect(container.firstElementChild?.className).toBe('ui-card');
  });

  it('Inset and EmptyState render their content', () => {
    render(
      <>
        <Inset data-testid="inset">in</Inset>
        <EmptyState>Nothing yet</EmptyState>
      </>,
    );
    expect(screen.getByTestId('inset').className).toBe('ui-inset');
    expect(screen.getByText('Nothing yet').className).toBe('ui-empty');
  });
});

describe('layout primitives', () => {
  it('Screen wraps its content; ScrollArea can be capped; Stack and Cluster take a gap', () => {
    const { container } = render(
      <Screen>
        <ScrollArea maxHeight="10rem">a</ScrollArea>
        <Stack gap="2rem">b</Stack>
        <Cluster gap="1rem">c</Cluster>
        <Stack>d</Stack>
        <ScrollArea>e</ScrollArea>
      </Screen>,
    );
    expect(container.querySelector('.ui-screen > .ui-screen__content')).toBeTruthy();
    const scrolls = container.querySelectorAll<HTMLElement>('.ui-scroll');
    expect(scrolls[0]?.style.maxHeight).toBe('10rem');
    expect(scrolls[1]?.getAttribute('style')).toBeNull();
    const stacks = container.querySelectorAll<HTMLElement>('.ui-stack');
    expect(stacks[0]?.style.getPropertyValue('--ui-gap')).toBe('2rem');
    expect(stacks[1]?.getAttribute('style')).toBeNull();
    expect(container.querySelector<HTMLElement>('.ui-cluster')?.style.getPropertyValue('--ui-gap')).toBe('1rem');
  });
});
