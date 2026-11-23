import React, { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let cachedDeferredPrompt: BeforeInstallPromptEvent | null = null;
let listenersInitialized = false;
const promptSubscribers = new Set<(ev: BeforeInstallPromptEvent | null) => void>();
const installedSubscribers = new Set<(installed: boolean) => void>();

function ensureGlobalPWAListeners() {
  if (listenersInitialized || typeof window === 'undefined') return;
  listenersInitialized = true;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    cachedDeferredPrompt = e as BeforeInstallPromptEvent;
    promptSubscribers.forEach((cb) => cb(cachedDeferredPrompt));
  });

  window.addEventListener('appinstalled', () => {
    cachedDeferredPrompt = null;
    promptSubscribers.forEach((cb) => cb(null));
    installedSubscribers.forEach((cb) => cb(true));
  });
}

let swRegistered = false;
export function registerPWA() {
  if (swRegistered || typeof window === 'undefined') return;
  swRegistered = true;
  ensureGlobalPWAListeners();
  registerSW({
    immediate: true,
    onOfflineReady() {
      // Cached assets ready for offline play
    },
  });
}

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => cachedDeferredPrompt
  );
  const [isInstalled, setIsInstalled] = useState<boolean>(() => detectStandalone());
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    ensureGlobalPWAListeners();
    setIsInstalled(detectStandalone());

    const ua = window.navigator.userAgent.toLowerCase();
    const ios =
      /iphone|ipad|ipod/.test(ua) ||
      (ua.includes('mac') && typeof document !== 'undefined' && 'ontouchend' in document);
    setIsIOS(ios);
    setIsAndroid(/android/.test(ua));
    try {
      setInIframe(window.self !== window.top);
    } catch {
      setInIframe(true);
    }

    const onPrompt = (ev: BeforeInstallPromptEvent | null) => setDeferredPrompt(ev);
    const onInstalled = (val: boolean) => setIsInstalled(val);
    promptSubscribers.add(onPrompt);
    installedSubscribers.add(onInstalled);

    const mq = window.matchMedia('(display-mode: standalone)');
    const onMqChange = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true);
    };
    mq.addEventListener?.('change', onMqChange);

    return () => {
      promptSubscribers.delete(onPrompt);
      installedSubscribers.delete(onInstalled);
      mq.removeEventListener?.('change', onMqChange);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    const promptEv = deferredPrompt || cachedDeferredPrompt;
    if (!promptEv) return false;
    await promptEv.prompt();
    const { outcome } = await promptEv.userChoice;
    if (outcome === 'accepted') {
      cachedDeferredPrompt = null;
      setDeferredPrompt(null);
      setIsInstalled(true);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    isAndroid,
    inIframe,
    install,
  };
}

export const PWAInstallButton: React.FC<{
  variant?: 'compact' | 'card' | 'settings';
  onToast?: (msg: string) => void;
}> = ({ variant = 'compact', onToast }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, inIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    if (variant === 'settings') {
      return (
        <div className="p-3 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 text-xs font-semibold text-[var(--g)] flex items-center gap-2">
          <span>✅</span>
          <span>ติดตั้งเป็นแอปบนเครื่องแล้ว (โหมดเต็มหน้าจอ)</span>
        </div>
      );
    }
    return null;
  }

  // In compact top HUD, only display when Chromium prompt is ready or on iOS
  if (variant === 'compact' && !isInstallable && !isIOS) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        onToast?.('ติดตั้งแอป "ลูกหนังไทย" ลงหน้าจอหลักแล้ว!');
      }
      return;
    }
    setShowGuide(true);
  };

  const renderGuideModal = () => {
    if (!showGuide) return null;
    return (
      <div
        className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-hidden"
        onClick={() => setShowGuide(false)}
      >
        <div
          className="w-full max-w-sm rounded-3xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="ลูกหนังไทย" className="w-8 h-8 rounded-xl" />
              <div>
                <h3 className="font-bold text-sm font-display">📲 ติดตั้งแอป "ลูกหนังไทย"</h3>
                <p className="text-[11px] text-[var(--mut)]">เล่นเต็มจอและเล่นออฟไลน์บนมือถือได้</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-7 h-7 rounded-full bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-3 text-xs leading-relaxed">
            {inIframe && (
              <div className="p-2.5 rounded-xl bg-[var(--lamp-soft)] border border-[var(--lamp)] text-[11px]">
                <b>หมายเหตุ:</b> ขณะนี้เกมกำลังเปิดอยู่ในหน้าต่างตัวอย่าง (Iframe) ให้เปิดลิงก์แอปโดยตรงในเบราว์เซอร์ <b>Chrome</b> หรือ <b>Safari</b> ก่อนจึงจะกดติดตั้งลงหน้าจอโฮมได้
              </div>
            )}

            {isIOS ? (
              <div className="space-y-2 p-3 rounded-2xl bg-[var(--surface-2)]">
                <div className="font-bold text-[var(--g)]">วิธีติดตั้งบน iPhone / iPad (Safari)</div>
                <ol className="list-decimal list-inside space-y-1.5 text-[var(--ink)]">
                  <li>
                    เปิดเกมด้วยเบราว์เซอร์ <b>Safari</b>
                  </li>
                  <li>
                    แตะปุ่ม <b>แชร์ (Share)</b> รูปสี่เหลี่ยมมีลูกศรชี้ขึ้นด้านล่าง/บน
                  </li>
                  <li>
                    เลื่อนลงแล้วเลือก <b>&quot;เพิ่มไปยังหน้าจอโฮม&quot; (Add to Home Screen)</b>
                  </li>
                  <li>
                    แตะ <b>เพิ่ม (Add)</b> ที่มุมขวาบน เพื่อเข้าเล่นเต็มจอเหมือนแอป!
                  </li>
                </ol>
              </div>
            ) : (
              <div className="space-y-2 p-3 rounded-2xl bg-[var(--surface-2)]">
                <div className="font-bold text-[var(--g)]">
                  วิธีติดตั้งบน {isAndroid ? 'Android (Chrome)' : 'มือถือ / คอมพิวเตอร์'}
                </div>
                <ol className="list-decimal list-inside space-y-1.5 text-[var(--ink)]">
                  <li>
                    เปิดเกมด้วยเบราว์เซอร์ <b>Chrome</b> หรือ <b>Edge</b>
                  </li>
                  <li>
                    แตะปุ่มเมนู <b>⋮</b> (มุมขวาบน)
                  </li>
                  <li>
                    เลือก <b>&quot;ติดตั้งแอป&quot; (Install app)</b> หรือ <b>&quot;เพิ่มลงหน้าจอหลัก&quot;</b>
                  </li>
                </ol>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-xl bg-[var(--g)] text-white font-bold text-xs cursor-pointer"
            >
              เข้าใจแล้ว
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (variant === 'compact') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          title="ติดตั้งแอปลงมือถือ"
          className="px-2.5 py-1.5 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 text-[var(--g)] font-bold text-[11px] flex items-center gap-1 cursor-pointer shrink-0 hover:bg-[var(--g)] hover:text-white transition-colors"
        >
          <span>📲</span>
          <span className="hidden sm:inline">ติดตั้งแอป</span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  if (variant === 'settings') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-[var(--g-soft)] border border-[var(--g)]/40 text-left cursor-pointer hover:brightness-95 transition"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img src="/pwa-192x192.png" alt="ลูกหนังไทย" className="w-9 h-9 rounded-xl shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[var(--g)]">
                {isInstallable ? '📲 ติดตั้งแอปลงเครื่องทันที' : '📲 วิธีติดตั้งแอปบนมือถือ'}
              </div>
              <div className="text-[11px] text-[var(--mut)] truncate">
                เล่นเต็มจอ ไม่มีแถบเบราว์เซอร์ และเล่นออฟไลน์ได้
              </div>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-[var(--g)] text-white text-[11px] font-bold shrink-0">
            {isInstallable ? 'ติดตั้ง' : 'ดูวิธี'}
          </span>
        </button>
        {renderGuideModal()}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="w-full p-3 rounded-2xl bg-[var(--surface)] border border-[var(--g)]/45 hover:border-[var(--g)] flex items-center justify-between gap-3 text-left cursor-pointer transition-all shadow-xs"
      >
        <div className="flex items-center gap-3 min-w-0">
          <img src="/pwa-192x192.png" alt="ลูกหนังไทย" className="w-10 h-10 rounded-xl shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm text-[var(--ink)]">
              {isInstallable ? '📲 ติดตั้ง "ลูกหนังไทย" ลงมือถือ' : '📱 เล่นในมือถือ? ติดตั้งเป็นแอปได้'}
            </div>
            <div className="text-[11px] text-[var(--mut)] truncate">
              {isInstallable
                ? 'กดเพื่อติดตั้งลงหน้าจอโฮม เล่นเต็มจอและออฟไลน์ได้'
                : isIOS
                  ? 'กดดูวิธีเพิ่มลงหน้าจอโฮมบน iPhone / iPad (Safari)'
                  : 'รองรับ Android, iOS และคอมพิวเตอร์ (เล่นออฟไลน์ได้)'}
            </div>
          </div>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-[var(--g)] text-white text-xs font-bold shrink-0">
          {isInstallable ? 'ติดตั้งเลย' : 'วิธีติดตั้ง'}
        </span>
      </button>
      {renderGuideModal()}
    </>
  );
};

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-4 left-3 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-lg">
      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
      โหมดออฟไลน์ — เล่นต่อได้ตามปกติ เซฟอยู่ในเครื่อง
    </div>
  );
};
