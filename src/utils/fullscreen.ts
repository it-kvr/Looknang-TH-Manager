export function getFullscreenElement(): Element | null {
  if (typeof document === 'undefined') return null;
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return doc.fullscreenElement || doc.webkitFullscreenElement || null;
}

export function isFullscreenSupported(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as Document & { webkitFullscreenEnabled?: boolean };
  const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
  return Boolean(doc.fullscreenEnabled || doc.webkitFullscreenEnabled || el.requestFullscreen || el.webkitRequestFullscreen);
}

export async function enterImmersiveFullscreen(): Promise<boolean> {
  if (typeof document === 'undefined') return false;
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: (options?: FullscreenOptions) => Promise<void> | void;
  };
  if (el.requestFullscreen) {
    try {
      await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
      return true;
    } catch {
      await el.requestFullscreen();
      return true;
    }
  }
  if (el.webkitRequestFullscreen) {
    await Promise.resolve(el.webkitRequestFullscreen());
    return true;
  }
  return false;
}

export async function exitFullscreenSafe(): Promise<void> {
  if (typeof document === 'undefined') return;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  if (doc.fullscreenElement && doc.exitFullscreen) {
    await doc.exitFullscreen();
    return;
  }
  if (doc.webkitFullscreenElement && doc.webkitExitFullscreen) {
    await Promise.resolve(doc.webkitExitFullscreen());
  }
}

export function onFullscreenChange(cb: (isFs: boolean) => void): () => void {
  if (typeof document === 'undefined') return () => {};
  const handler = () => cb(Boolean(getFullscreenElement()));
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}
