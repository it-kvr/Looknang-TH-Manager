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
  return Boolean(
    doc.fullscreenEnabled ||
      doc.webkitFullscreenEnabled ||
      doc.mozFullScreenEnabled ||
      doc.msFullscreenEnabled ||
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
  try {
    const orientation = (screen as Screen & { orientation?: { lock?: (mode: string) => Promise<void> } }).orientation;
    if (orientation?.lock) {
      await orientation.lock('landscape');
    }
  } catch {
    // Ignore when browser or desktop environment restricts orientation lock
  }
}

export async function enterImmersiveFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  if (getFullscreenElement()) {
    syncFullscreenClass(true);
    await lockLandscapeOrientation();
    return true;
  }
  const el = document.documentElement as FullscreenEl;
  try {
    if (el.requestFullscreen) {
      try {
        await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      } catch {
        await el.requestFullscreen();
      }
      syncFullscreenClass(true);
      await lockLandscapeOrientation();
      return true;
    }
    if (el.webkitRequestFullscreen) {
      await Promise.resolve(el.webkitRequestFullscreen());
      syncFullscreenClass(true);
      await lockLandscapeOrientation();
      return true;
    }
    if (el.mozRequestFullScreen) {
      await Promise.resolve(el.mozRequestFullScreen());
      syncFullscreenClass(true);
      await lockLandscapeOrientation();
      return true;
    }
    if (el.msRequestFullscreen) {
      await Promise.resolve(el.msRequestFullscreen());
      syncFullscreenClass(true);
      await lockLandscapeOrientation();
      return true;
    }
  } catch {
    await lockLandscapeOrientation();
    return false;
  }
  // Fallback for mobile browsers without Fullscreen API (e.g. iOS Safari): nudge address bar
  try {
    window.scrollTo(0, 1);
  } catch {
    // ignore
  }
  await lockLandscapeOrientation();
  return false;
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
  } finally {
    syncFullscreenClass(Boolean(getFullscreenElement()));
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
    return Boolean(target.closest('input, textarea, select, option, [contenteditable="true"], [data-no-auto-fs="1"]'));
  };

  const tryEngage = (target: EventTarget | null) => {
    if (shouldSkipTarget(target)) return;
    if (!shouldAutoMobileFullscreen()) return;

    const now = Date.now();
    if (inFlight || now - lastAttempt < 600) return;

    if (isStandaloneDisplayMode() || getFullscreenElement() || !isFullscreenSupported()) {
      lastAttempt = now;
      lockLandscapeOrientation().catch(() => undefined);
      return;
    }

    inFlight = true;
    lastAttempt = now;
    enterImmersiveFullscreen()
      .catch(() => undefined)
      .finally(() => {
        inFlight = false;
      });
  };

  const onClick = (e: MouseEvent) => tryEngage(e.target);
  const onKeyDown = (e: KeyboardEvent) => tryEngage(e.target);
  const onFsChange = () => {
    const active = Boolean(getFullscreenElement());
    syncFullscreenClass(active);
    if (active && isMobileDevice()) lockLandscapeOrientation().catch(() => undefined);
  };

  window.addEventListener('click', onClick, { capture: true, passive: true });
  window.addEventListener('keydown', onKeyDown, { capture: true, passive: true });
  document.addEventListener('fullscreenchange', onFsChange);
  document.addEventListener('webkitfullscreenchange', onFsChange);
  syncFullscreenClass(Boolean(getFullscreenElement()));

  return () => {
    window.removeEventListener('click', onClick, { capture: true });
    window.removeEventListener('keydown', onKeyDown, { capture: true });
    document.removeEventListener('fullscreenchange', onFsChange);
    document.removeEventListener('webkitfullscreenchange', onFsChange);
  };
}
