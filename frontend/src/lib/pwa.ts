// PWA: registro do service worker e notificações locais (as lembranças só disparam com o app aberto ou instalado em segundo plano recente).
export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const go = () => { navigator.serviceWorker.register('/sw.js').catch(() => undefined); };
  if (document.readyState === 'complete') go(); else window.addEventListener('load', go);
}

export async function notifyUser(title: string, body: string): Promise<void> {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) { await reg.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: 'nutrisnap-lembrete' }); return; }
    new Notification(title, { body, icon: '/icons/icon-192.png' });
  } catch { /* sem suporte */ }
}
