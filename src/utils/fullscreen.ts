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
      window.matchMedia?.('(display-mode: minimal-ui)').matches ||
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

  if (Boolean(el.requestFullscreen) && doc.fullscreenEnabled !== false) return true;
  if (Boolean(el.webkitRequestFullscreen) && doc.webkitFullscreenEnabled !== false) return true;
  if (Boolean(el.mozRequestFullScreen) && doc.mozFullScreenEnabled !== false) return true;
  if (Boolean(el.msRequestFullscreen) && doc.msFullscreenEnabled !== false) return true;

  return false;
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

let pendingEnterFs: Promise<boolean> | null = null;
let pendingFromClick = false;

export async function enterImmersiveFullscreen(fromClick = false): Promise<boolean> {
  if (typeof document === 'undefined') return false;

  if (getFullscreenElement()) {
    syncFullscreenClass(true);
    lockLandscapeOrientation().catch(() => undefined);
    return true;
  }

  if (!isFullscreenSupported()) {
    return false;
  }

  if (pendingEnterFs && (pendingFromClick || !fromClick)) {
    return pendingEnterFs;
  }

  const el = document.documentElement as FullscreenEl;
  const doc = document as FullscreenDoc;
  pendingFromClick = fromClick;

  const attemptPromise = (async () => {
    try {
      if (el.requestFullscreen && doc.fullscreenEnabled !== false) {
        try {
          await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
        } catch {
          await el.requestFullscreen();
        }
      } else if (el.webkitRequestFullscreen && doc.webkitFullscreenEnabled !== false) {
        await Promise.resolve(el.webkitRequestFullscreen());
      } else if (el.mozRequestFullScreen && doc.mozFullScreenEnabled !== false) {
        await Promise.resolve(el.mozRequestFullScreen());
      } else if (el.msRequestFullscreen && doc.msFullscreenEnabled !== false) {
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
  })().finally(() => {
    if (pendingEnterFs === attemptPromise) {
      pendingEnterFs = null;
      pendingFromClick = false;
    }
  });

  pendingEnterFs = attemptPromise;
  return attemptPromise;
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
  let lastClickAttempt = 0;
  let lastTouchAttempt = 0;

  const isAppleDevice =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent || '');
  const isAppleStandalone =
    isAppleDevice && (navigator as unknown as { standalone?: boolean }).standalone === true;

  const shouldSkipTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof Element)) return false;
    return Boolean(
      target.closest('input, textarea, select, option, [contenteditable="true"], [data-no-auto-fs="1"]')
    );
  };

  const tryEngage = (target: EventTarget | null, source: 'click' | 'touch') => {
    if (shouldSkipTarget(target)) return;
    if (!shouldAutoMobileFullscreen()) return;

    if (isAppleStandalone || getFullscreenElement() || !isFullscreenSupported()) {
      lockLandscapeOrientation().catch(() => undefined);
      return;
    }

    const now = Date.now();
    // Never let a failed/pending touchend block click (click is the most reliable user activation on Android WebAPK)
    if (source === 'click') {
      if (now - lastClickAttempt < 120) return;
      lastClickAttempt = now;
    } else {
      if (now - lastTouchAttempt < 280) return;
      lastTouchAttempt = now;
    }

    enterImmersiveFullscreen(source === 'click').catch(() => undefined);
  };

  const rootStyle = document.documentElement.style;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText =
    'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;z-index:-1;' +
    'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);' +
    'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);';
  document.body?.appendChild(probe);

  const lvhProbe = document.createElement('div');
  lvhProbe.setAttribute('aria-hidden', 'true');
  lvhProbe.style.cssText =
    'position:fixed;top:0;left:0;width:100vw;width:100lvw;height:100vh;height:100lvh;visibility:hidden;pointer-events:none;z-index:-1;';
  document.body?.appendChild(lvhProbe);

  type SafeInsets = { t: number; r: number; b: number; l: number };
  type LockedViewport = { w: number; h: number };
  const lockedByOri = new Map<string, SafeInsets>();
  const maxViewportByOri = new Map<string, LockedViewport>();
  let settleTimer: number | null = null;
  let fsSettleTimer: number | null = null;
  let initTimer1: number | null = null;
  let initTimer2: number | null = null;
  let focusTimer: number | null = null;

  const isEditingTextActive = (): boolean => {
    const active = document.activeElement;
    return (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      (active instanceof HTMLElement && active.isContentEditable)
    );
  };

  const getOriKey = (): string => {
    const scrOri = (screen as Screen & { orientation?: { angle?: number } }).orientation;
    const winOri = (window as unknown as { orientation?: number }).orientation;
    const angle = typeof scrOri?.angle === 'number' ? scrOri.angle : typeof winOri === 'number' ? winOri : 0;
    const scrW = Math.round(window.screen?.width || 0);
    const scrH = Math.round(window.screen?.height || 0);
    const isLand = window.innerWidth >= window.innerHeight;
    return `${scrW}x${scrH}-${angle}-${isLand ? 'L' : 'P'}`;
  };

  const readProbeInsets = (activeFs: boolean): SafeInsets => {
    const cs = window.getComputedStyle(probe);
    const isLand = window.innerWidth >= window.innerHeight;
    const rawT = Math.max(0, Math.round(parseFloat(cs.paddingTop) || 0));
    const rawR = Math.max(0, Math.round(parseFloat(cs.paddingRight) || 0));
    const rawB = Math.max(0, Math.round(parseFloat(cs.paddingBottom) || 0));
    const rawL = Math.max(0, Math.round(parseFloat(cs.paddingLeft) || 0));
    if (!isAppleDevice) {
      if (isLand) {
        // In Android landscape fullscreen/standalone, top & bottom bars are transient overlays (never cutouts)
        return {
          t: 0,
          r: rawR < 120 ? rawR : 0,
          b: 0,
          l: rawL < 120 ? rawL : 0
        };
      }
      // In Android portrait fullscreen/standalone, bottom navigation bar is transient (not a notch)
      return {
        t: activeFs ? 0 : rawT,
        r: rawR < 120 ? rawR : 0,
        b: 0,
        l: rawL < 120 ? rawL : 0
      };
    }
    return { t: rawT, r: rawR, b: rawB, l: rawL };
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

  const clearLockedViewport = () => {
    document.documentElement.classList.remove('kb-open');
    rootStyle.removeProperty('--locked-vw');
    rootStyle.removeProperty('--locked-vh');
    rootStyle.removeProperty('--app-w');
    rootStyle.removeProperty('--app-h');
    rootStyle.removeProperty('--app-dvh');
  };

  const updateViewportLock = (standalone: boolean, activeFs: boolean) => {
    if (!isMobileDevice() || (!standalone && !activeFs)) {
      clearLockedViewport();
      return;
    }

    const curW = Math.round(window.innerWidth || 0);
    const curH = Math.round(window.innerHeight || 0);
    const lvhRect = lvhProbe.getBoundingClientRect();
    const lvwW = Math.round(lvhRect.width || 0);
    const lvhH = Math.round(lvhRect.height || 0);
    const refH = Math.max(curH, lvhH);
    const vvH = Math.round(window.visualViewport?.height || curH);

    const kbOpen = isEditingTextActive() && refH > 0 && vvH < refH * 0.78;
    document.documentElement.classList.toggle('kb-open', kbOpen);
    if (kbOpen) {
      return;
    }

    const oriKey = getOriKey();
    const candW = Math.max(curW, lvwW);
    const candH = Math.max(curH, lvhH);
    const prev = maxViewportByOri.get(oriKey);
    const nextW = Math.max(prev?.w || 0, candW);
    const nextH = Math.max(prev?.h || 0, candH);
    if (nextW > 0 && nextH > 0) {
      maxViewportByOri.set(oriKey, { w: nextW, h: nextH });
      rootStyle.setProperty('--locked-vw', `${nextW}px`);
      rootStyle.setProperty('--locked-vh', `${nextH}px`);
      rootStyle.setProperty('--app-w', `${nextW}px`);
      rootStyle.setProperty('--app-h', `${nextH}px`);
      rootStyle.setProperty('--app-dvh', `${(nextH / 100).toFixed(4)}px`);
    }
  };

  const updateSafeAreas = () => {
    const standalone = isStandaloneDisplayMode();
    const activeFs = Boolean(getFullscreenElement());
    syncFullscreenClass(activeFs);
    updateViewportLock(standalone, activeFs);

    if (!standalone && !activeFs) {
      clearLockedInsets();
      return;
    }

    const oriKey = getOriKey();
    const isLand = window.innerWidth >= window.innerHeight;
    const cur = readProbeInsets(activeFs);
    const prev = lockedByOri.get(oriKey);

    let next: SafeInsets;
    if (!isAppleDevice && isLand) {
      // Lock top & bottom to 0 in Android landscape so transient bars never push UI;
      // preserve side cutout insets detected while immersive fullscreen is active.
      next = {
        t: 0,
        b: 0,
        r: activeFs ? Math.max(prev?.r || 0, cur.r) : prev ? prev.r : cur.r,
        l: activeFs ? Math.max(prev?.l || 0, cur.l) : prev ? prev.l : cur.l
      };
    } else {
      next = !prev
        ? cur
        : {
            t: Math.min(prev.t, cur.t),
            r: activeFs ? Math.max(prev.r, cur.r) : Math.min(prev.r, cur.r),
            b: Math.min(prev.b, cur.b),
            l: activeFs ? Math.max(prev.l, cur.l) : Math.min(prev.l, cur.l)
          };
    }

    lockedByOri.set(oriKey, next);
    applyLockedInsets(next);
  };

  const guardViewportScroll = () => {
    if (!isEditingTextActive() && (window.scrollX !== 0 || window.scrollY !== 0)) {
      window.scrollTo(0, 0);
    }
  };

  const onClick = (e: MouseEvent) => {
    tryEngage(e.target, 'click');
  };

  const onTouchEnd = (e: TouchEvent) => {
    if (e.changedTouches.length > 1) return;
    tryEngage(e.target, 'touch');
  };

  const onVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible') {
      updateSafeAreas();
      guardViewportScroll();
      if (shouldAutoMobileFullscreen()) {
        if (!isAppleStandalone && !getFullscreenElement() && isFullscreenSupported()) {
          enterImmersiveFullscreen().catch(() => undefined);
        } else {
          lockLandscapeOrientation().catch(() => undefined);
        }
      }
    }
  };

  const onFsChange = () => {
    const active = Boolean(getFullscreenElement());
    syncFullscreenClass(active);
    updateSafeAreas();
    guardViewportScroll();
    if (fsSettleTimer) window.clearTimeout(fsSettleTimer);
    fsSettleTimer = window.setTimeout(() => {
      updateSafeAreas();
      guardViewportScroll();
    }, 250);
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
    updateSafeAreas();
    settleTimer = window.setTimeout(() => {
      updateSafeAreas();
      guardViewportScroll();
    }, 260);
  };

  const onViewportResize = () => {
    updateSafeAreas();
    guardViewportScroll();
  };

  const onFocusStateChange = () => {
    if (focusTimer) window.clearTimeout(focusTimer);
    focusTimer = window.setTimeout(() => {
      updateSafeAreas();
      guardViewportScroll();
    }, 120);
  };

  window.addEventListener('click', onClick, { capture: true, passive: true });
  window.addEventListener('touchend', onTouchEnd, { capture: true, passive: true });
  window.addEventListener('focus', onVisibilityOrFocus);
  window.addEventListener('resize', onViewportResize, { passive: true });
  window.addEventListener('orientationchange', onOrientationChange, { passive: true });
  window.visualViewport?.addEventListener('resize', onViewportResize, { passive: true });
  window.visualViewport?.addEventListener('scroll', guardViewportScroll, { passive: true });
  document.addEventListener('focusin', onFocusStateChange, { passive: true });
  document.addEventListener('focusout', onFocusStateChange, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityOrFocus);
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  document.addEventListener('mozfullscreenchange', onFsChange);
  document.addEventListener('MSFullscreenChange', onFsChange);

  const displayModeQueries = [
    window.matchMedia?.('(display-mode: fullscreen)'),
    window.matchMedia?.('(display-mode: standalone)'),
    window.matchMedia?.('(display-mode: minimal-ui)')
  ].filter((m): m is MediaQueryList => Boolean(m));
  displayModeQueries.forEach((m) => m.addEventListener?.('change', updateSafeAreas));

  updateSafeAreas();
  initTimer1 = window.setTimeout(() => updateSafeAreas(), 250);
  initTimer2 = window.setTimeout(() => updateSafeAreas(), 800);
  if (isStandaloneDisplayMode() && shouldAutoMobileFullscreen()) {
    if (!isAppleStandalone && !getFullscreenElement() && isFullscreenSupported()) {
      enterImmersiveFullscreen().catch(() => undefined);
    } else {
      lockLandscapeOrientation().catch(() => undefined);
    }
  }

  return () => {
    if (settleTimer) window.clearTimeout(settleTimer);
    if (fsSettleTimer) window.clearTimeout(fsSettleTimer);
    if (initTimer1) window.clearTimeout(initTimer1);
    if (initTimer2) window.clearTimeout(initTimer2);
    if (focusTimer) window.clearTimeout(focusTimer);
    probe.remove();
    lvhProbe.remove();
    clearLockedInsets();
    clearLockedViewport();
    displayModeQueries.forEach((m) => m.removeEventListener?.('change', updateSafeAreas));
    window.removeEventListener('click', onClick, { capture: true });
    window.removeEventListener('touchend', onTouchEnd, { capture: true });
    window.removeEventListener('focus', onVisibilityOrFocus);
    window.removeEventListener('resize', onViewportResize);
    window.removeEventListener('orientationchange', onOrientationChange);
    window.visualViewport?.removeEventListener('resize', onViewportResize);
    window.visualViewport?.removeEventListener('scroll', guardViewportScroll);
    document.removeEventListener('focusin', onFocusStateChange);
    document.removeEventListener('focusout', onFocusStateChange);
    document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    document.removeEventListener('fullscreenchange', onFsChange);
    document.removeEventListener('webkitfullscreenchange', onFsChange);
    document.removeEventListener('mozfullscreenchange', onFsChange);
    document.removeEventListener('MSFullscreenChange', onFsChange);
  };
}
