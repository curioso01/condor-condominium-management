import { toast } from 'sonner';
import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';

export type NotificationPermissionState = NotificationPermission | 'unsupported';

export function getBrowserNotificationPermission(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission;
}

/**
 * Solicita permissão de notificação push/nativa do navegador ou PWA instalado
 * e registra o dispositivo em public.push_subscriptions para o condomínio ativo.
 */
export async function requestPushPermissionAndRegister(params: {
  userId?: string;
  condominiumId?: string;
}): Promise<{ granted: boolean; status: NotificationPermissionState }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { granted: false, status: 'unsupported' };
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }

  if (permission === 'granted' && params.userId && params.condominiumId && isSupabaseConfigured && !isDemoSessionActive()) {
    try {
      const endpoint = `pwa-realtime://${window.location.origin}/${params.userId}/${params.condominiumId}`;
      await (supabase.from('push_subscriptions') as any).upsert(
        {
          user_id: params.userId,
          condominium_id: params.condominiumId,
          endpoint,
          user_agent: navigator.userAgent.slice(0, 240),
          enabled: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,condominium_id,endpoint' }
      );
    } catch {
      // Não bloqueia notificações nativas locais caso a gravação falhe
    }
  }

  return { granted: permission === 'granted', status: permission };
}

/**
 * Dispara notificação nativa do SO/PWA via Service Worker (preferencial) ou Notification API.
 */
export async function showNativeNotification(params: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const options: NotificationOptions & { vibrate?: number[] } = {
    body: params.body,
    icon: '/icons/icon-192x192.png',
    badge: '/favicon-32x32.png',
    tag: params.tag || `condor-${Date.now()}`,
    data: { url: params.url || '/' },
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && typeof registration.showNotification === 'function') {
        await registration.showNotification(params.title, options);
        return true;
      }
    }
  } catch {
    // Fallback abaixo
  }

  try {
    const notif = new Notification(params.title, options);
    notif.onclick = () => {
      window.focus();
      if (params.url?.includes('mural=open')) {
        window.dispatchEvent(new CustomEvent('condor:open-mural'));
      }
      notif.close();
    };
    return true;
  } catch {
    return false;
  }
}

/**
 * Inscreve o aplicativo no Supabase Realtime para receber alertas instantâneos (push + toast)
 * sempre que a síndica publicar um novo comunicado no Mural ou a portaria registrar uma encomenda.
 */
export function subscribeToCondoRealtimePush(params: {
  condominiumId: string;
  condominiumName: string;
  userId?: string;
  userUnitId?: string | null;
  userUnitNumber?: string | null;
  userFullName?: string | null;
  isMorador: boolean;
  onNavigateTab?: (tab: 'my_packages' | 'overview') => void;
}): () => void {
  if (!params.condominiumId || !isSupabaseConfigured || isDemoSessionActive()) {
    return () => {};
  }

  const channelName = `condor-push-${params.condominiumId}-${params.userId || 'anon'}`;
  const channel = supabase
    .channel(channelName)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'announcements',
        filter: `condominium_id=eq.${params.condominiumId}`,
      },
      (payload: any) => {
        const row = payload?.new;
        if (!row) return;

        window.dispatchEvent(new CustomEvent('condor:announcements-updated'));

        // Não duplica alerta intrusivo para quem acabou de publicar, mas ainda notifica os demais
        const isAuthor = params.userId && row.author_user_id === params.userId;
        const notifTitle = `Novo Comunicado • ${params.condominiumName}`;
        const notifBody = `${row.title}${row.content ? ` — ${String(row.content).slice(0, 120)}` : ''}`;

        if (!isAuthor) {
          toast.info(row.title, {
            description: `${row.category || 'Comunicado'} • ${String(row.content || '').slice(0, 110)}`,
            duration: 8000,
            action: {
              label: 'Ver Mural',
              onClick: () => window.dispatchEvent(new CustomEvent('condor:open-mural')),
            },
          });

          void showNativeNotification({
            title: notifTitle,
            body: notifBody,
            tag: `announcement-${row.id}`,
            url: '/?mural=open',
          });
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'packages',
        filter: `condominium_id=eq.${params.condominiumId}`,
      },
      (payload: any) => {
        const row = payload?.new;
        if (!row) return;

        window.dispatchEvent(new CustomEvent('condor:packages-updated'));

        // Para morador, valida correspondência pela unidade ou nome do destinatário
        if (params.isMorador) {
          const matchesUnitId = Boolean(params.userUnitId && row.unit_id === params.userUnitId);
          const matchesUnitNum = Boolean(
            params.userUnitNumber &&
              String(row.unit_number || '')
                .toLowerCase()
                .includes(params.userUnitNumber.trim().toLowerCase())
          );
          const matchesName = Boolean(
            params.userFullName &&
              String(row.recipient_name || '')
                .toLowerCase()
                .includes(params.userFullName.trim().split(' ')[0].toLowerCase())
          );

          if (!matchesUnitId && !matchesUnitNum && !matchesName) {
            return;
          }

          const title = `Encomenda recebida na Portaria (${row.courier})`;
          const body = `Registrada para ${row.recipient_name} (${row.unit_number}) • Local: ${row.locker_compartment} • PIN: ${row.pickup_pin}`;

          toast.success(title, {
            description: body,
            duration: 10000,
            action: {
              label: 'Ver Encomendas',
              onClick: () => params.onNavigateTab?.('my_packages'),
            },
          });

          void showNativeNotification({
            title,
            body,
            tag: `package-${row.id}`,
            url: '/?tab=my_packages',
          });
        }
      }
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
