import { useLayoutEffect, type DependencyList, type RefObject } from 'react';

export function resetScrollInTree(root: ParentNode | null | undefined): void {
  if (!root) return;
  if (root instanceof HTMLElement && root.scrollTop > 0 && !root.hasAttribute('data-preserve-scroll')) {
    root.scrollTop = 0;
  }
  if ('querySelectorAll' in root) {
    const nodes = root.querySelectorAll<HTMLElement>('*');
    for (let i = 0; i < nodes.length; i++) {
      const el = nodes[i];
      if (el.scrollTop > 0 && !el.hasAttribute('data-preserve-scroll')) {
        el.scrollTop = 0;
      }
    }
  }
}

export function resetAncestorScrolls(el: HTMLElement | null | undefined, stopAt?: HTMLElement | null): void {
  let cur: HTMLElement | null = el ? el.parentElement : null;
  while (cur) {
    if (cur.scrollTop > 0 && !cur.hasAttribute('data-preserve-scroll')) {
      cur.scrollTop = 0;
    }
    if (stopAt && cur === stopAt) break;
    cur = cur.parentElement;
  }
  if (typeof window !== 'undefined' && window.scrollY > 0) {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }
}

export function useScrollTopOnChange(
  ref: RefObject<HTMLElement | null>,
  deps: DependencyList,
  options?: { includeAncestors?: boolean }
): void {
  const includeAncestors = options?.includeAncestors ?? true;
  useLayoutEffect(() => {
    const run = () => {
      resetScrollInTree(ref.current);
      if (includeAncestors) {
        resetAncestorScrolls(ref.current);
      }
    };
    run();
    const raf = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
