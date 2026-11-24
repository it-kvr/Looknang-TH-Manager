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

  // Use trusted click event so Chrome/Android never wastes the user activation on touchend
  const onClick = (e: MouseEvent) => {
    tryEngage(e.target);
  };

  const onVisibilityOrFocus = () => {
    if (document.visibilityState === 'visible' && shouldAutoMobileFullscreen()) {
      lockLandscapeOrientation().catch(() => undefined);
    }
  };

  const onFsChange = () => {
    const active = Boolean(getFullscreenElement());
    syncFullscreenClass(active);
    if (active && shouldAutoMobileFullscreen()) {
      lockLandscapeOrientation().catch(() => undefined);
      window.setTimeout(() => {
        if (Boolean(getFullscreenElement()) && shouldAutoMobileFullscreen()) {
          lockLandscapeOrientation().catch(() => undefined);
        }
      }, 100);
    }
  };

  window.addEventListener('click', onClick, { capture: true, passive: true });
  window.addEventListener('focus', onVisibilityOrFocus);
  document.addEventListener('visibilitychange', onVisibilityOrFocus);
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  document.addEventListener('mozfullscreenchange', onFsChange);
  document.addEventListener('MSFullscreenChange', onFsChange);
  syncFullscreenClass(Boolean(getFullscreenElement()));
  if (isStandaloneDisplayMode() && shouldAutoMobileFullscreen()) {
    lockLandscapeOrientation().catch(() => undefined);
  }

  return () => {
    window.removeEventListener('click', onClick, { capture: true });
    window.removeEventListener('focus', onVisibilityOrFocus);
    document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    document.removeEventListener('fullscreenchange', onFsChange);
    document.removeEventListener('webkitfullscreenchange', onFsChange);
    document.removeEventListener('mozfullscreenchange', onFsChange);
    document.removeEventListener('MSFullscreenChange', onFsChange);
  };
}
