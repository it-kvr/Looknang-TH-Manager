import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {registerPWA} from './pwa.tsx';

registerPWA();

if (typeof document !== 'undefined') {
  const blockMultiTouch = (e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault();
  };
  document.addEventListener('touchstart', blockMultiTouch, {passive: false});
  document.addEventListener('touchmove', blockMultiTouch, {passive: false});
  const blockGesture = (e: Event) => e.preventDefault();
  document.addEventListener('gesturestart', blockGesture, {passive: false});
  document.addEventListener('gesturechange', blockGesture, {passive: false});
  document.addEventListener('gestureend', blockGesture, {passive: false});
  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) e.preventDefault();
    },
    {passive: false}
  );
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0', '_'].includes(e.key)) {
      e.preventDefault();
    }
  });
  const isEditableOrSelectable = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('input, textarea, [contenteditable="true"], .select-text, .select-all'));
  };
  document.addEventListener('selectstart', (e: Event) => {
    if (!isEditableOrSelectable(e.target)) {
      e.preventDefault();
    }
  });
  document.addEventListener('contextmenu', (e: Event) => {
    if (!isEditableOrSelectable(e.target)) {
      e.preventDefault();
    }
  });
}

class RootErrorBoundary extends React.Component<
  {children: React.ReactNode},
  {error: Error | null}
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {error: null};
  }

  static getDerivedStateFromError(error: Error) {
    return {error};
  }

  handleClearCacheAndReload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      // ignore cleanup errors
    }
    window.location.reload();
  };

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center p-4 bg-[var(--bg)] text-[var(--ink)]">
          <div className="max-w-md w-full rounded-2xl bg-[var(--surface)] border border-[var(--line)] p-5 space-y-3 shadow-lg">
            <h1 className="text-lg font-bold font-display">เกิดข้อผิดพลาดระหว่างเปิดเกม</h1>
            <p className="text-xs text-[var(--mut)]">
              ลองล้างแคชและโหลดหน้าใหม่ หากเพิ่งอัปเดตเวอร์ชันบนเว็บ
            </p>
            <pre className="text-[11px] p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] overflow-x-auto text-[var(--red)]">
              {this.state.error.message}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[var(--g)] text-white text-xs font-bold cursor-pointer"
              >
                ล้างแคชและโหลดใหม่
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="py-2.5 px-4 rounded-xl bg-[var(--surface-2)] border border-[var(--line)] text-xs font-bold cursor-pointer"
              >
                รีเฟรช
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
