interface FullscreenDoc extends Document {
    webkitFullscreenElement?: Element | null;
    webkitExitFullscreen?: () => Promise<void> | void;
}

interface FullscreenEl extends HTMLElement {
    webkitRequestFullscreen?: () => Promise<void> | void;
}

export function supportsFullscreen(): boolean {
    if (typeof document === 'undefined') return false;
    const el = document.documentElement as FullscreenEl;
    return Boolean(el.requestFullscreen || el.webkitRequestFullscreen);
}

export function isFullscreenActive(): boolean {
    if (typeof document === 'undefined') return false;
    const doc = document as FullscreenDoc;
    return Boolean(doc.fullscreenElement || doc.webkitFullscreenElement);
}

export async function requestMobileFullscreen(): Promise<void> {
    if (typeof document === 'undefined') return;
    const el = document.documentElement as FullscreenEl;

    try {
        if (!isFullscreenActive()) {
            if (el.requestFullscreen) {
                await el.requestFullscreen({ navigationUI: 'hide' } as FullscreenOptions);
            } else if (el.webkitRequestFullscreen) {
                await el.webkitRequestFullscreen();
            }
        }
    } catch {
        // Ignore browser blocks (e.g., iOS Safari non-PWA)
    }

    try {
        const orientation = screen.orientation as ScreenOrientation & {
            lock?: (orientation: 'landscape' | 'portrait') => Promise<void>;
        };
        if (orientation?.lock) {
            await orientation.lock('landscape');
        }
    } catch {
        // Orientation lock is only supported on some mobile browsers while fullscreen
    }
}

export async function exitMobileFullscreen(): Promise<void> {
    if (typeof document === 'undefined' || !isFullscreenActive()) return;
    const doc = document as FullscreenDoc;
    try {
        if (doc.exitFullscreen) {
            await doc.exitFullscreen();
        } else if (doc.webkitExitFullscreen) {
            await doc.webkitExitFullscreen();
        }
    } catch {
        // Ignore
    }
}

export async function toggleMobileFullscreen(): Promise<void> {
    if (isFullscreenActive()) {
        await exitMobileFullscreen();
    } else {
        await requestMobileFullscreen();
    }
}
