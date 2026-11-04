// The screens open each other through the stack that Prototype.tsx builds; they find it here so the files do not import each other in a circle.
export type ScreenName = 'home' | 'record' | 'editor' | 'review' | 'lock';

export interface Nav {
  push: (name: ScreenName, props?: object) => void;
  replace: (name: ScreenName, props?: object) => void;
  pop: () => void;
  depth: number;
}

export const holder: { useNavigator: () => Nav } = {
  useNavigator: () => {
    throw new Error('The prototype stack is not ready');
  },
};

export const useNav = (): Nav => holder.useNavigator();

/** Back to the first screen, whatever is open. */
export function goHome(nav: Nav): void {
  if (nav.depth > 1) window.history.go(-(nav.depth - 1));
}
