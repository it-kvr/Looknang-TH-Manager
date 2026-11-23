import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { registerSW } from 'virtual:pwa-register';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type GuidePlatform = 'ios' | 'android' | 'desktop';

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

const GUIDE_STEPS: Record<
  GuidePlatform,
  { label: string; browserHint: string; steps: { title: string; detail: string }[] }
> = {
  ios: {
    label: 'iPhone / iPad',
    browserHint: 'ต้องเปิดด้วย Safari เท่านั้นจึงจะเพิ่มลงหน้าจอโฮมได้',
    steps: [
      {
        title: 'เปิดเกมใน Safari',
        detail: 'หากเปิดผ่านแอปอื่นหรือหน้าต่างตัวอย่าง ให้กดเปิดลิงก์ใน Safari',
      },
      {
        title: 'แตะปุ่ม "แชร์" (Share)',
        detail: 'รูปสี่เหลี่ยมมีลูกศรชี้ขึ้น บริเวณแถบเมนูด้านล่างหรือด้านบน',
      },
      {
        title: 'เลือก "เพิ่มไปยังหน้าจอโฮม"',
        detail: 'เลื่อนรายการลงมาแล้วแตะ Add to Home Screen',
      },
      {
        title: 'แตะ "เพิ่ม" (Add) มุมขวาบน',
        detail: 'ไอคอนลูกหนังไทยจะขึ้นบนหน้าจอหลัก พร้อมเล่นเต็มจอแบบออฟไลน์',
      },
    ],
  },
  android: {
    label: 'Android',
    browserHint: 'แนะนำให้ใช้เบราว์เซอร์ Google Chrome',
    steps: [
      {
        title: 'เปิดเกมใน Chrome',
        detail: 'เข้าเล่นผ่าน URL ของเว็บเกมโดยตรงบน Chrome',
      },
      {
        title: 'แตะปุ่มเมนู ⋮ มุมขวาบน',
        detail: 'เปิดเมนูตัวเลือกของเบราว์เซอร์ Chrome',
      },
      {
        title: 'เลือก "ติดตั้งแอป" หรือ "เพิ่มลงหน้าจอหลัก"',
        detail: 'หากมีปุ่ม Install app สามารถกดติดตั้งได้ทันที',
      },
      {
        title: 'กดยืนยัน "ติดตั้ง"',
        detail: 'แอปจะถูกเพิ่มลงหน้าจอหลัก เปิดเล่นเต็มจอและเซฟออฟไลน์ได้',
      },
    ],
  },
  desktop: {
    label: 'คอมพิวเตอร์',
    browserHint: 'รองรับ Google Chrome และ Microsoft Edge',
    steps: [
      {
        title: 'เปิดเกมใน Chrome หรือ Edge',
        detail: 'เข้าเล่นผ่านหน้าต่างเบราว์เซอร์หลัก (ไม่ใช่หน้าต่างตัวอย่าง)',
      },
      {
        title: 'คลิกไอคอนติดตั้งบนแถบ URL',
        detail: 'สังเกตรูปหน้าจอมีลูกศรลงที่มุมขวาของช่องกรอกเว็บไซต์ หรือเปิดเมนู ⋮',
      },
      {
        title: 'เลือก "ติดตั้ง ลูกหนังไทย"',
        detail: 'คลิกยืนยัน Install เพื่อสร้างหน้าต่างแอปแยกเฉพาะเกม',
      },
    ],
  },
};

export const PWAInstallButton: React.FC<{
  variant?: 'compact' | 'card' | 'settings';
  onToast?: (msg: string) => void;
}> = ({ variant = 'compact', onToast }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, inIframe, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [tab, setTab] = useState<GuidePlatform>('android');
  const iconUrl = `${import.meta.env.BASE_URL}icon.svg`;

  useEffect(() => {
    setTab(isIOS ? 'ios' : isAndroid ? 'android' : 'desktop');
  }, [isIOS, isAndroid]);

  useEffect(() => {
    if (!showGuide) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowGuide(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showGuide]);

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
    if (!showGuide || typeof document === 'undefined') return null;
    const guide = GUIDE_STEPS[tab];

    return createPortal(
      <div
        className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
        onClick={() => setShowGuide(false)}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-guide-title"
          className="w-full max-w-md rounded-3xl bg-[var(--surface)] border border-[var(--line)] overflow-hidden shadow-2xl my-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3.5 bg-[var(--surface-2)] border-b border-[var(--line)] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={iconUrl} alt="ลูกหนังไทย" className="w-10 h-10 rounded-2xl shrink-0 shadow-xs" />
              <div className="min-w-0">
                <h3 id="pwa-guide-title" className="font-bold text-sm sm:text-base font-display truncate">
                  วิธีติดตั้งแอป &quot;ลูกหนังไทย&quot;
                </h3>
                <p className="text-[11px] text-[var(--mut)] truncate">
                  เล่นเต็มจอ ไร้แถบเบราว์เซอร์ และเล่นแบบออฟไลน์ได้
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              aria-label="ปิดหน้าต่าง"
              className="w-8 h-8 rounded-full bg-[var(--surface)] border border-[var(--line)] text-xs font-bold cursor-pointer shrink-0 hover:border-[var(--g)] transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-3.5 text-xs">
            {inIframe && (
              <div className="p-3 rounded-2xl bg-[var(--lamp-soft)] border border-[var(--lamp)]/70 text-[11px] leading-relaxed text-[var(--ink)]">
                <div className="font-bold mb-0.5">⚠️ กำลังเปิดผ่านหน้าต่างตัวอย่าง (Iframe)</div>
                <p className="text-[var(--mut)]">
                  เบราว์เซอร์ไม่อนุญาตให้ติดตั้งแอปจากหน้าต่างตัวอย่าง กรุณาเปิดลิงก์แอปโดยตรงใน{' '}
                  <b className="text-[var(--ink)]">Safari</b> หรือ <b className="text-[var(--ink)]">Chrome</b> ก่อนทำตามขั้นตอนด้านล่าง
                </p>
              </div>
            )}

            {/* Platform Tabs */}
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--line)]">
              {(['ios', 'android', 'desktop'] as GuidePlatform[]).map((key) => {
                const active = tab === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setTab(key)}
                    className={`py-1.5 px-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                      active
                        ? 'bg-[var(--g)] text-white shadow-xs'
                        : 'text-[var(--mut)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {GUIDE_STEPS[key].label}
                  </button>
                );
              })}
            </div>

            {/* Steps Card */}
            <div className="rounded-2xl bg-[var(--surface-2)] border border-[var(--line)] p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--line)]/70">
                <span className="font-bold text-[var(--g)] text-xs">
                  ขั้นตอนสำหรับ {guide.label}
                </span>
                <span className="text-[10px] text-[var(--mut)] font-medium">
                  {guide.browserHint}
                </span>
              </div>

              <div className="space-y-2.5">
                {guide.steps.map((step, idx) => (
                  <div key={step.title} className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[var(--g)] text-white text-[11px] font-extrabold flex items-center justify-center shrink-0 mt-0.5 tabular">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 leading-snug">
                      <div className="font-bold text-[var(--ink)]">{step.title}</div>
                      <div className="text-[11px] text-[var(--mut)] mt-0.5">{step.detail}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              {isInstallable && (
                <button
                  type="button"
                  onClick={async () => {
                    const ok = await install();
                    if (ok) {
                      setShowGuide(false);
                      onToast?.('ติดตั้งแอป "ลูกหนังไทย" ลงหน้าจอหลักแล้ว!');
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--lamp)] text-[#261900] font-bold text-xs cursor-pointer hover:brightness-105 transition"
                >
                  ติดตั้งทันที
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="flex-1 py-2.5 rounded-xl bg-[var(--g)] text-white font-bold text-xs cursor-pointer hover:brightness-105 transition"
              >
                เข้าใจแล้ว
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
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
            <img src={iconUrl} alt="ลูกหนังไทย" className="w-9 h-9 rounded-xl shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-bold text-[var(--g)]">
                {isInstallable ? '📲 ติดตั้งแอปลงเครื่องทันที' : '📲 วิธีติดตั้งแอปบนมือถือ / คอมพิวเตอร์'}
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
          <img src={iconUrl} alt="ลูกหนังไทย" className="w-10 h-10 rounded-xl shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-xs sm:text-sm text-[var(--ink)]">
              {isInstallable ? '📲 ติดตั้ง "ลูกหนังไทย" ลงมือถือ' : '📱 เล่นในมือถือ? ติดตั้งเป็นแอปได้'}
            </div>
            <div className="text-[11px] text-[var(--mut)] truncate">
              {isInstallable
                ? 'กดเพื่อติดตั้งลงหน้าจอโฮม เล่นเต็มจอและออฟไลน์ได้'
                : isIOS
                  ? 'กดดูวิธีเพิ่มลงหน้าจอโฮมบน iPhone / iPad (Safari)'
                  : 'กดดูขั้นตอนติดตั้งสำหรับ Android, iOS และคอมพิวเตอร์'}
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
