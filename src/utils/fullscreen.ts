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

let landscapeLockSucceeded = false;
let explicitExitAt = 0;
let desktopExplicitExit = false;

export function isPortraitViewport(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
}

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

export async function lockLandscapeOrientation(): Promise<boolean> {
  if (typeof window === 'undefined' || typeof screen === 'undefined') return false;
  if (!isMobileDevice()) return false;
  if (!getFullscreenElement() && !isStandaloneDisplayMode()) return false;
  try {
    const orientation = (
      screen as Screen & { orientation?: { type?: string; lock?: (mode: string) => Promise<void> } }
    ).orientation;
    if (landscapeLockSucceeded && orientation?.type?.startsWith('landscape')) {
      return true;
    }
    if (orientation?.lock) {
      try {
        await orientation.lock('landscape');
        landscapeLockSucceeded = true;
        return true;
      } catch {
        await orientation.lock('landscape-primary');
        landscapeLockSucceeded = true;
        return true;
      }
    }
  } catch {
    // Ignore when browser or OS restricts orientation lock
  }
  return false;
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

export async function enterLandscapeFullscreen(
  fromClick = true
): Promise<{ fullscreen: boolean; landscape: boolean }> {
  if (fromClick) {
    desktopExplicitExit = false;
  }
  const fullscreen = await enterImmersiveFullscreen(fromClick);
  const landscape = await lockLandscapeOrientation();
  return { fullscreen, landscape };
}

export async function exitFullscreenSafe(): Promise<void> {
  if (typeof document === 'undefined') return;
  explicitExitAt = Date.now();
  if (!isMobileDevice()) {
    desktopExplicitExit = true;
  }
  document.documentElement.classList.remove('is-fs-peek');
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
  landscapeLockSucceeded = false;
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
  desktopExplicitExit = false;
  const res = await enterLandscapeFullscreen(true);
  return res.fullscreen;
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
  let barPeekUntil = 0;
  let wasFs = Boolean(getFullscreenElement());
  let desktopAutoTried = false;

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
  const fsCutoutByOri = new Map<string, SafeInsets>();
  const maxViewportByOri = new Map<string, LockedViewport>();
  let settleTimer: number | null = null;
  let fsSettleTimer: number | null = null;
  let barPeekTimer: number | null = null;
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
    const isLand = window.innerWidth >= window.innerHeight;
    return `${angle}-${isLand ? 'L' : 'P'}`;
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

  const updateViewportLock = (standalone: boolean, activeFs: boolean, barPeek: boolean) => {
    if (!isMobileDevice() || (!standalone && !activeFs && !barPeek)) {
      clearLockedViewport();
      return;
    }

    const curW = Math.round(window.innerWidth || 0);
    const curH = Math.round(window.innerHeight || 0);
    const lvhRect = lvhProbe.getBoundingClientRect();
    const lvhH = Math.round(lvhRect.height || 0);
    const refH = Math.max(curH, lvhH);
    const vvH = Math.round(window.visualViewport?.height || curH);

    const kbOpen = isEditingTextActive() && refH > 0 && vvH < refH * 0.78;
    document.documentElement.classList.toggle('kb-open', kbOpen);
    if (kbOpen) {
      return;
    }

    const oriKey = getOriKey();
    if (barPeek) {
      const lvwW = Math.round(lvhRect.width || 0);
      const prev = maxViewportByOri.get(oriKey);
      const nextW = Math.max(prev?.w || 0, Math.max(curW, lvwW));
      const nextH = Math.max(prev?.h || 0, Math.max(curH, lvhH));
      if (nextW > 0 && nextH > 0) {
        maxViewportByOri.set(oriKey, { w: nextW, h: nextH });
        rootStyle.setProperty('--locked-vw', `${nextW}px`);
        rootStyle.setProperty('--locked-vh', `${nextH}px`);
        rootStyle.setProperty('--app-w', `${nextW}px`);
        rootStyle.setProperty('--app-h', `${nextH}px`);
        rootStyle.setProperty('--app-dvh', `${(nextH / 100).toFixed(4)}px`);
      }
      return;
    }

    if (curW > 0 && curH > 0) {
      maxViewportByOri.set(oriKey, { w: curW, h: curH });
      rootStyle.setProperty('--locked-vw', `${curW}px`);
      rootStyle.setProperty('--locked-vh', `${curH}px`);
      rootStyle.setProperty('--app-w', `${curW}px`);
      rootStyle.setProperty('--app-h', `${curH}px`);
      rootStyle.setProperty('--app-dvh', `${(curH / 100).toFixed(4)}px`);
    }
  };

  const updateSafeAreas = () => {
    const standalone = isStandaloneDisplayMode();
    const activeFs = Boolean(getFullscreenElement());
    const barPeek = !activeFs && Date.now() < barPeekUntil;
    document.documentElement.classList.toggle('is-fs-peek', barPeek);
    syncFullscreenClass(activeFs);
    updateViewportLock(standalone, activeFs, barPeek);

    if (!standalone && !activeFs && !barPeek) {
      clearLockedInsets();
      return;
    }

    const oriKey = getOriKey();
    const isLand = window.innerWidth >= window.innerHeight;
    const frozenFsCutout = fsCutoutByOri.get(oriKey);
    if (!isAppleDevice && isLand && frozenFsCutout) {
      // Once settled in fullscreen, freeze landscape cutout insets so transient system bars
      // sliding in from any edge never push or move the game UI inward.
      applyLockedInsets(frozenFsCutout);
      return;
    }

    const cur = readProbeInsets(activeFs);
    const prev = lockedByOri.get(oriKey);

    let next: SafeInsets;
    if (!isAppleDevice && isLand) {
      // Never expand side cutouts upward via Math.max before/during bar reveals;
      // use Math.min so temporary navigation bars fade back out cleanly.
      next = !prev
        ? { t: 0, b: 0, r: cur.r, l: cur.l }
        : {
            t: 0,
            b: 0,
            r: Math.min(prev.r, cur.r),
            l: Math.min(prev.l, cur.l)
          };
    } else {
      next = !prev
        ? cur
        : {
            t: Math.min(prev.t, cur.t),
            r: Math.min(prev.r, cur.r),
            b: Math.min(prev.b, cur.b),
            l: Math.min(prev.l, cur.l)
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

  const tryEngageFromClick = (target: EventTarget | null) => {
    if (shouldSkipTarget(target)) return;
    if (!getAutoFullscreenPref()) return;

    if (!isMobileDevice()) {
      if (desktopAutoTried || desktopExplicitExit || getFullscreenElement() || !isFullscreenSupported()) {
        return;
      }
      desktopAutoTried = true;
      enterImmersiveFullscreen(true).catch(() => undefined);
      return;
    }

    if (isAppleStandalone || getFullscreenElement() || !isFullscreenSupported()) {
      lockLandscapeOrientation().catch(() => undefined);
      return;
    }

    // Give the user ~1.5s to inspect/use mobile system bars after swiping them out
    if (Date.now() < barPeekUntil - 1100) {
      return;
    }

    const now = Date.now();
    if (now - lastClickAttempt < 160) return;
    lastClickAttempt = now;

    enterImmersiveFullscreen(true).catch(() => undefined);
  };

  const onClick = (e: MouseEvent) => {
    tryEngageFromClick(e.target);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') return;
    tryEngageFromClick(e.target);
  };

  const onVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible') {
      updateSafeAreas();
      guardViewportScroll();
      if (Date.now() < barPeekUntil) return;
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
    const prevWasFs = wasFs;
    wasFs = active;

    if (barPeekTimer) {
      window.clearTimeout(barPeekTimer);
      barPeekTimer = null;
    }
    if (fsSettleTimer) {
      window.clearTimeout(fsSettleTimer);
      fsSettleTimer = null;
    }

    if (active) {
      barPeekUntil = 0;
      document.documentElement.classList.remove('is-fs-peek');
    } else if (prevWasFs && !isMobileDevice()) {
      desktopExplicitExit = true;
    } else if (prevWasFs && Date.now() - explicitExitAt > 1200 && shouldAutoMobileFullscreen()) {
      // User swiped to show mobile bars and Chrome exited DOM fullscreen:
      // keep UI locked underneath and let bars display briefly before auto-hiding.
      barPeekUntil = Date.now() + 2600;
      barPeekTimer = window.setTimeout(() => {
        barPeekTimer = null;
        barPeekUntil = 0;
        document.documentElement.classList.remove('is-fs-peek');
        updateSafeAreas();
        if (
          document.visibilityState === 'visible' &&
          shouldAutoMobileFullscreen() &&
          !getFullscreenElement() &&
          isFullscreenSupported()
        ) {
          enterImmersiveFullscreen(false).catch(() => undefined);
        }
      }, 2600);
    }

    syncFullscreenClass(active);
    updateSafeAreas();
    guardViewportScroll();

    fsSettleTimer = window.setTimeout(() => {
      fsSettleTimer = null;
      if (Boolean(getFullscreenElement()) && !isAppleDevice && window.innerWidth >= window.innerHeight) {
        const oriKey = getOriKey();
        const settled = readProbeInsets(true);
        const curFrozen = fsCutoutByOri.get(oriKey);
        const lockedCutout: SafeInsets = curFrozen
          ? {
              t: 0,
              b: 0,
              r: Math.min(curFrozen.r, settled.r),
              l: Math.min(curFrozen.l, settled.l)
            }
          : { t: 0, b: 0, r: settled.r, l: settled.l };
        fsCutoutByOri.set(oriKey, lockedCutout);
        lockedByOri.set(oriKey, lockedCutout);
      }
      updateSafeAreas();
      guardViewportScroll();
    }, 300);

    if (active && shouldAutoMobileFullscreen()) {
      lockLandscapeOrientation().catch(() => undefined);
    }
  };

  const onOrientationChange = () => {
    landscapeLockSucceeded = false;
    if (settleTimer) window.clearTimeout(settleTimer);
    updateSafeAreas();
    settleTimer = window.setTimeout(() => {
      updateSafeAreas();
      guardViewportScroll();
      if (shouldAutoMobileFullscreen() && (Boolean(getFullscreenElement()) || isStandaloneDisplayMode())) {
        lockLandscapeOrientation().catch(() => undefined);
      }
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

  // Capture clicks (never touchend swipes) so edge swipes reveal mobile system bars smoothly
  window.addEventListener('click', onClick, { capture: true, passive: true });
  window.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
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
  if (getAutoFullscreenPref()) {
    if (isStandaloneDisplayMode() || (!isAppleStandalone && !getFullscreenElement() && isFullscreenSupported())) {
      enterImmersiveFullscreen(false).catch(() => undefined);
    }
    if (isMobileDevice()) {
      lockLandscapeOrientation().catch(() => undefined);
    }
  }

  return () => {
    if (settleTimer) window.clearTimeout(settleTimer);
    if (fsSettleTimer) window.clearTimeout(fsSettleTimer);
    if (barPeekTimer) window.clearTimeout(barPeekTimer);
    if (initTimer1) window.clearTimeout(initTimer1);
    if (initTimer2) window.clearTimeout(initTimer2);
    if (focusTimer) window.clearTimeout(focusTimer);
    probe.remove();
    lvhProbe.remove();
    document.documentElement.classList.remove('is-fs-peek');
    clearLockedInsets();
    clearLockedViewport();
    displayModeQueries.forEach((m) => m.removeEventListener?.('change', updateSafeAreas));
    window.removeEventListener('click', onClick, { capture: true });
    window.removeEventListener('keydown', onKeyDown, { capture: true });
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
