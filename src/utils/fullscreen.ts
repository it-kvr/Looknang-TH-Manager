type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  mozFullScreenEnabled?: boolean;
  msFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
};

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
};

export function isStandaloneDisplayMode(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.matchMedia?.('(display-mode: fullscreen)').matches ||
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as FullscreenDoc;
  return (
    doc.fullscreenElement ||
    doc.webkitFullscreenElement ||
    doc.mozFullScreenElement ||
    doc.msFullscreenElement ||
    null
  );
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as FullscreenDoc;
  const el = document.documentElement as FullscreenEl;

  if (typeof doc.fullscreenEnabled === 'boolean') {
    return doc.fullscreenEnabled && Boolean(el.requestFullscreen);
  }
  if (typeof doc.webkitFullscreenEnabled === 'boolean') {
    return doc.webkitFullscreenEnabled && Boolean(el.webkitRequestFullscreen);
  }
  if (typeof doc.mozFullScreenEnabled === 'boolean') {
    return doc.mozFullScreenEnabled && Boolean(el.mozRequestFullScreen);
  }
  if (typeof doc.msFullscreenEnabled === 'boolean') {
    return doc.msFullscreenEnabled && Boolean(el.msRequestFullscreen);
  }

  return Boolean(
    el.requestFullscreen ||
      el.webkitRequestFullscreen ||
      el.mozRequestFullScreen ||
      el.msRequestFullscreen
  );
}

export function syncFullscreenClass(isFs: boolean) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('is-fullscreen', isFs);
  document.documentElement.classList.toggle('is-standalone', isStandaloneDisplayMode());
}

export async function lockLandscapeOrientation(): Promise<void> {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return;
  if (!isMobileDevice()) return;
  if (!getFullscreenElement() && !isStandaloneDisplayMode()) return;
  try {
    const orientation = (screen as Screen & { orientation?: { lock?: (mode: string) => Promise<void> } }).orientation;
    if (orientation?.lock) {
      try {
        await orientation.lock('landscape');
      } catch {
        await orientation.lock('landscape-primary');
      }
    }
  } catch {
    // Ignore when browser or OS restricts orientation lock
  }
}

export async function enterImmersiveFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  if (getFullscreenElement()) {
    syncFullscreenClass(true);
    lockLandscapeOrientation().catch(() => undefined);
    return true;
  }

  if (!isFullscreenSupported()) {
    return false;
  }

  const el = document.documentElement as FullscreenEl;
  try {
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      } catch {
        await el.requestFullscreen();
      }
    } else if (el.webkitRequestFullscreen) {
      await Promise.resolve(el.webkitRequestFullscreen());
    } else if (el.mozRequestFullScreen) {
      await Promise.resolve(el.mozRequestFullScreen());
    } else if (el.msRequestFullscreen) {
      await Promise.resolve(el.msRequestFullscreen());
    }
  } catch {
    syncFullscreenClass(Boolean(getFullscreenElement()));
    return false;
  }

  const active = Boolean(getFullscreenElement());
  syncFullscreenClass(active);
  if (active) {
    lockLandscapeOrientation().catch(() => undefined);
  }
  return active;
}

export async function exitFullscreenSafe(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as FullscreenDoc;
  try {
    if (doc.fullscreenElement && doc.exitFullscreen) {
      await doc.exitFullscreen();
    } else if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
      await Promise.resolve(doc.webkitExitFullscreen());
    } else if (doc.mozFullScreenElement && doc.mozCancelFullScreen) {
      await Promise.resolve(doc.mozCancelFullScreen());
    } else if (doc.msFullscreenElement && doc.msExitFullscreen) {
      await Promise.resolve(doc.msExitFullscreen());
    }
  } catch {
    // Ignore errors if document is no longer in fullscreen
  } finally {
    await unlockOrientationSafe();
    syncFullscreenClass(Boolean(getFullscreenElement()));
  }
}

export async function unlockOrientationSafe(): Promise<void> {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return;
  try {
    const orientation = (
      screen as Screen & { orientation?: { unlock?: () => void; lock?: (mode: string) => Promise<void> } }
    ).orientation;
    orientation?.unlock?.();
  } catch {
    // Ignore unsupported orientation unlock
  }
}

export async function exitFullscreenAndUnlockOrientation(): Promise<void> {
  await unlockOrientationSafe();
  if (getFullscreenElement()) {
    await exitFullscreenSafe().catch(() => undefined);
  }
}

export async function toggleImmersiveFullscreen(): Promise<boolean> {
  if (getFullscreenElement()) {
    await exitFullscreenSafe();
    return Boolean(getFullscreenElement());
  }
  return enterImmersiveFullscreen();
}

export function isMobileDevice(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1) return true;
  const coarse = Boolean(window.matchMedia?.('(pointer: coarse)').matches);
  return coarse && (navigator.maxTouchPoints || 0) > 0;
}

export function getAutoFullscreenPref(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem('lkset');
    if (!raw) return true;
    const parsed = JSON.parse(raw) as { preferFullscreen?: boolean } | null;
    return parsed?.preferFullscreen !== false;
  } catch {
    return true;
  }
}

export function shouldAutoMobileFullscreen(): boolean {
  return isMobileDevice() && getAutoFullscreenPref();
}

export async function enterAutoMobileFullscreen(): Promise<boolean> {
  if (!shouldAutoMobileFullscreen()) return false;
  return enterImmersiveFullscreen();
}

export function onFullscreenChange(cb: (isFs: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = () => {
    const active = Boolean(getFullscreenElement());
    syncFullscreenClass(active);
    if (active && isMobileDevice()) lockLandscapeOrientation().catch(() => undefined);
    cb(active);
  };
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  document.addEventListener('mozfullscreenchange', handler);
  document.addEventListener('MSFullscreenChange', handler);
  syncFullscreenClass(Boolean(getFullscreenElement()));
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
    document.removeEventListener('mozfullscreenchange', handler);
    document.removeEventListener('MSFullscreenChange', handler);
  };
}

export function bindAutoLandscapeFullscreen(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  let inFlight = false;
  let lastAttempt = 0;

  const shouldSkipTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('input, textarea, select, option, [contenteditable="true"], [data-no-auto-fs="1"]')
    );
  };

  const tryEngage = (target: EventTarget | null) => {
    if (shouldSkipTarget(target)) return;
    if (!shouldAutoMobileFullscreen()) return;

    if (isStandaloneDisplayMode() || getFullscreenElement() || !isFullscreenSupported()) {
      lockLandscapeOrientation().catch(() => undefined);
      return;
    }

    const now = Date.now();
    if (inFlight || now - lastAttempt < 250) return;

    inFlight = true;
    lastAttempt = now;
    enterImmersiveFullscreen()
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
      });
  };

  const rootStyle = document.documentElement.style;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);' +
    'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);';
  document.body?.appendChild(probe);

  type SafeInsets = { t: number; r: number; b: number; l: number };
  const lockedByOri = new Map<string, SafeInsets>();
  let lastOriKey = '';
  let settleTimer: number | null = null;

  const getOriKey = (): string => {
    const scrOri = (screen as Screen & { orientation?: { angle?: number } }).orientation;
    const winOri = (window as unknown as { orientation?: number }).orientation;
    const angle = typeof scrOri?.angle === 'number' ? scrOri.angle : typeof winOri === 'number' ? winOri : 0;
    const isLand = window.innerWidth >= window.innerHeight;
    return `${angle}-${isLand ? 'L' : 'P'}`;
  };

  const readProbeInsets = (): SafeInsets => {
    const cs = window.getComputedStyle(probe);
    return {
      t: Math.max(0, Math.round(parseFloat(cs.paddingTop) || 0)),
      r: Math.max(0, Math.round(parseFloat(cs.paddingRight) || 0)),
      b: Math.max(0, Math.round(parseFloat(cs.paddingBottom) || 0)),
      l: Math.max(0, Math.round(parseFloat(cs.paddingLeft) || 0))
    };
  };

  const applyLockedInsets = (ins: SafeInsets) => {
    rootStyle.setProperty('--sat', `${ins.t}px`);
    rootStyle.setProperty('--sar', `${ins.r}px`);
    rootStyle.setProperty('--sab', `${ins.b}px`);
    rootStyle.setProperty('--sal', `${ins.l}px`);
  };

  const clearLockedInsets = () => {
    rootStyle.removeProperty('--sat');
    rootStyle.removeProperty('--sar');
    rootStyle.removeProperty('--sab');
    rootStyle.removeProperty('--sal');
  };

  const updateSafeAreas = (forceReset = false) => {
    const standalone = isStandaloneDisplayMode();
    const activeFs = Boolean(getFullscreenElement());
    syncFullscreenClass(activeFs);

    if (!standalone && !activeFs) {
      clearLockedInsets();
      return;
    }

    const oriKey = getOriKey();
    if (forceReset || oriKey !== lastOriKey) {
      lastOriKey = oriKey;
      lockedByOri.delete(oriKey);
    }

    const cur = readProbeInsets();
    const prev = lockedByOri.get(oriKey);
    const next: SafeInsets = !prev
      ? cur
      : {
          t: Math.min(prev.t, cur.t),
          r: Math.min(prev.r, cur.r),
          b: Math.min(prev.b, cur.b),
          l: Math.min(prev.l, cur.l)
        };
    lockedByOri.set(oriKey, next);
    applyLockedInsets(next);
  };

  const guardViewportScroll = () => {
    const active = document.activeElement;
    const editingText =
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLElement && active.isContentEditable);
    if (!editingText && (window.scrollX !== 0 || window.scrollY !== 0)) {
      window.scrollTo(0, 0);
    }
  };

  // Use trusted click event so Chrome/Android never wastes the user activation on touchend
  const onClick = (e: MouseEvent) => {
    tryEngage(e.target);
  };

  const onVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible') {
      updateSafeAreas(false);
      guardViewportScroll();
      if (shouldAutoMobileFullscreen()) {
        lockLandscapeOrientation().catch(() => undefined);
      }
    }
  };

  const onFsChange = () => {
    const active = Boolean(getFullscreenElement());
    syncFullscreenClass(active);
    updateSafeAreas(true);
    guardViewportScroll();
    if (active && shouldAutoMobileFullscreen()) {
      lockLandscapeOrientation().catch(() => undefined);
      window.setTimeout(() => {
        if (Boolean(getFullscreenElement()) && shouldAutoMobileFullscreen()) {
          lockLandscapeOrientation().catch(() => undefined);
        }
      }, 100);
    }
  };

  const onOrientationChange = () => {
    if (settleTimer) window.clearTimeout(settleTimer);
    updateSafeAreas(true);
    settleTimer = window.setTimeout(() => {
      updateSafeAreas(false);
      guardViewportScroll();
    }, 200);
  };

  const onViewportResize = () => {
    updateSafeAreas(false);
    guardViewportScroll();
  };

  window.addEventListener('click', onClick, { capture: true, passive: true });
  window.addEventListener('focus', onVisibilityOrFocus);
  window.addEventListener('resize', onViewportResize, { passive: true });
  window.addEventListener('orientationchange', onOrientationChange, { passive: true });
  window.visualViewport?.addEventListener('resize', onViewportResize, { passive: true });
  window.visualViewport?.addEventListener('scroll', guardViewportScroll, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityOrFocus);
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  document.addEventListener('mozfullscreenchange', onFsChange);
  document.addEventListener('MSFullscreenChange', onFsChange);

  updateSafeAreas(true);
  if (isStandaloneDisplayMode() && shouldAutoMobileFullscreen()) {
    lockLandscapeOrientation().catch(() => undefined);
  }

  return () => {
    if (settleTimer) window.clearTimeout(settleTimer);
    probe.remove();
    clearLockedInsets();
    window.removeEventListener('click', onClick, { capture: true });
    window.removeEventListener('focus', onVisibilityOrFocus);
    window.removeEventListener('resize', onViewportResize);
    window.removeEventListener('orientationchange', onOrientationChange);
    window.visualViewport?.removeEventListener('resize', onViewportResize);
    window.visualViewport?.removeEventListener('scroll', guardViewportScroll);
    document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    document.removeEventListener('fullscreenchange', onFsChange);
    document.removeEventListener('webkitfullscreenchange', onFsChange);
    document.removeEventListener('mozfullscreenchange', onFsChange);
    document.removeEventListener('MSFullscreenChange', onFsChange);
  };
}
