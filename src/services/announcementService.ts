import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';
import { auditService } from './auditService';

export type AnnouncementCategory =
  | 'Urgente'
  | 'Manutenção'
  | 'Assembleia'
  | 'Convivência'
  | 'Comunicado';

export interface Announcement {
  id: string;
  condominiumId?: string;
  title: string;
  category: AnnouncementCategory;
  priority?: 'normal' | 'media' | 'alta';
  viewsCount?: number;
  date: string;
  author: string;
  content: string;
  isPinned?: boolean;
  createdAtIso: string;
}

export interface UpsertAnnouncementInput {
  title: string;
  category: AnnouncementCategory;
  priority?: 'normal' | 'media' | 'alta';
  date?: string;
  content: string;
  author: string;
  isPinned?: boolean;
}

const DEMO_ANNOUNCEMENTS_PREFIX = 'condor_demo_announcements_';

// Cache em memória isolado por condominiumId
const announcementsCache = new Map<string, Announcement[]>();

function formatPtBrDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    const datePart = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    const timePart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${datePart} • ${timePart}`;
  } catch {
    return 'Recente';
  }
}

function mapDbRowToAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    condominiumId: row.condominium_id,
    title: row.title,
    category: (row.category as AnnouncementCategory) || 'Comunicado',
    priority: row.is_pinned ? 'alta' : 'normal',
    viewsCount: Number(row.views_count ?? 1),
    date: formatPtBrDateTime(row.created_at),
    author: row.author_name || 'Administração',
    content: row.content,
    isPinned: Boolean(row.is_pinned),
    createdAtIso: row.created_at || new Date().toISOString(),
  };
}

function sortAnnouncements(list: Announcement[]): Announcement[] {
  return [...list].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return (b.createdAtIso || '').localeCompare(a.createdAtIso || '');
  });
}

export const announcementService = {
  /**
   * Retorna comunicados em cache do condomínio específico (sem misturar condomínios).
   */
  getAnnouncements(condominiumId: string = ''): Announcement[] {
    if (!condominiumId) return [];

    if (isDemoSessionActive()) {
      try {
        const raw = localStorage.getItem(`${DEMO_ANNOUNCEMENTS_PREFIX}${condominiumId}`);
        if (raw) {
          return sortAnnouncements(JSON.parse(raw));
        }
      } catch {
        // ignore
      }
      return [];
    }

    return sortAnnouncements(announcementsCache.get(condominiumId) || []);
  },

  /**
   * Busca os comunicados reais do condomínio na tabela public.announcements do Supabase.
   */
  async fetchAnnouncements(condominiumId: string = ''): Promise<{
    data: Announcement[];
    error: { message: string } | null;
  }> {
    if (!condominiumId) {
      return { data: [], error: null };
    }

    if (isDemoSessionActive()) {
      return { data: this.getAnnouncements(condominiumId), error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: [], error: { message: 'Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.from('announcements') as any)
        .select('*')
        .eq('condominium_id', condominiumId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) {
        return { data: [], error: { message: error.message } };
      }

      const mapped = sortAnnouncements(((data as any[]) || []).map(mapDbRowToAnnouncement));
      announcementsCache.set(condominiumId, mapped);
      return { data: mapped, error: null };
    } catch (err: any) {
      return {
        data: [],
        error: { message: err?.message || 'Erro ao buscar comunicados no Supabase.' },
      };
    }
  },

  /**
   * Publica um novo comunicado no Supabase para o condomínio ativo.
   */
  async createAnnouncementAsync(
    input: UpsertAnnouncementInput,
    condominiumId: string = ''
  ): Promise<{
    data: Announcement | null;
    error: { message: string } | null;
  }> {
    if (!condominiumId) {
      return { data: null, error: { message: 'Condomínio ativo não identificado.' } };
    }

    if (isDemoSessionActive()) {
      const nowIso = new Date().toISOString();
      const newItem: Announcement = {
        id: `demo-anc-${Date.now()}`,
        condominiumId,
        title: input.title.trim(),
        category: input.category,
        date: formatPtBrDateTime(nowIso),
        author: input.author.trim() || 'Administração',
        content: input.content.trim(),
        isPinned: Boolean(input.isPinned),
        createdAtIso: nowIso,
      };
      const updated = sortAnnouncements([newItem, ...this.getAnnouncements(condominiumId)]);
      localStorage.setItem(`${DEMO_ANNOUNCEMENTS_PREFIX}${condominiumId}`, JSON.stringify(updated));
      announcementsCache.set(condominiumId, updated);
      window.dispatchEvent(new CustomEvent('condor:announcements-updated'));
      return { data: newItem, error: null };
    }

    if (!isSupabaseConfigured) {
      return {
        data: null,
        error: { message: 'Publicação bloqueada: banco de dados Supabase não configurado.' },
      };
    }

    try {
      const { data: authData } = await supabase.auth.getUser();
      const { data, error } = await (supabase.from('announcements') as any)
        .insert({
          condominium_id: condominiumId,
          title: input.title.trim(),
          category: input.category,
          content: input.content.trim(),
          author_name: input.author.trim() || 'Administração',
          author_user_id: authData?.user?.id || null,
          is_pinned: Boolean(input.isPinned),
        })
        .select('*')
        .single();

      if (error || !data) {
        return {
          data: null,
          error: {
            message:
              error?.message ||
              'Não foi possível publicar o comunicado no Supabase (verifique se a migration foi executada e suas permissões).',
          },
        };
      }

      const created = mapDbRowToAnnouncement(data);
      const updated = sortAnnouncements([
        created,
        ...(announcementsCache.get(condominiumId) || []),
      ]);
      announcementsCache.set(condominiumId, updated);

      await auditService.log({
        condominiumId,
        action: 'ANNOUNCEMENT_CREATED',
        entityTable: 'announcements',
        entityId: created.id,
        metadata: { title: created.title, category: created.category },
      });

      window.dispatchEvent(new CustomEvent('condor:announcements-updated'));
      return { data: created, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Erro ao publicar comunicado no Supabase.' },
      };
    }
  },

  /**
   * Atualiza um comunicado existente no Supabase.
   */
  async updateAnnouncementAsync(
    id: string,
    input: UpsertAnnouncementInput,
    condominiumId: string
  ): Promise<{
    data: Announcement | null;
    error: { message: string } | null;
  }> {
    if (!condominiumId) {
      return { data: null, error: { message: 'Condomínio ativo não identificado.' } };
    }

    if (isDemoSessionActive()) {
      const current = this.getAnnouncements(condominiumId);
      let edited: Announcement | null = null;
      const updated = sortAnnouncements(
        current.map((item) => {
          if (item.id === id) {
            edited = {
              ...item,
              title: input.title.trim(),
              category: input.category,
              content: input.content.trim(),
              author: input.author.trim() || item.author,
              isPinned: Boolean(input.isPinned),
            };
            return edited;
          }
          return item;
        })
      );
      localStorage.setItem(`${DEMO_ANNOUNCEMENTS_PREFIX}${condominiumId}`, JSON.stringify(updated));
      announcementsCache.set(condominiumId, updated);
      window.dispatchEvent(new CustomEvent('condor:announcements-updated'));
      return { data: edited, error: null };
    }

    if (!isSupabaseConfigured) {
      return { data: null, error: { message: 'Edição bloqueada: Supabase não configurado.' } };
    }

    try {
      const { data, error } = await (supabase.from('announcements') as any)
        .update({
          title: input.title.trim(),
          category: input.category,
          content: input.content.trim(),
          author_name: input.author.trim(),
          is_pinned: Boolean(input.isPinned),
        })
        .eq('id', id)
        .eq('condominium_id', condominiumId)
        .select('*')
        .single();

      if (error || !data) {
        return {
          data: null,
          error: {
            message: error?.message || 'Não foi possível atualizar o comunicado no Supabase.',
          },
        };
      }

      const updatedItem = mapDbRowToAnnouncement(data);
      const updatedList = sortAnnouncements(
        (announcementsCache.get(condominiumId) || []).map((a) =>
          a.id === id ? updatedItem : a
        )
      );
      announcementsCache.set(condominiumId, updatedList);
      window.dispatchEvent(new CustomEvent('condor:announcements-updated'));
      return { data: updatedItem, error: null };
    } catch (err: any) {
      return {
        data: null,
        error: { message: err?.message || 'Erro ao atualizar comunicado no Supabase.' },
      };
    }
  },

  /**
   * Exclui um comunicado no Supabase.
   */
  async deleteAnnouncementAsync(
    id: string,
    condominiumId: string = ''
  ): Promise<{ error: { message: string } | null }> {
    if (!condominiumId) {
      return { error: { message: 'Condomínio ativo não identificado.' } };
    }

    if (isDemoSessionActive()) {
      const updated = this.getAnnouncements(condominiumId).filter((a) => a.id !== id);
      localStorage.setItem(`${DEMO_ANNOUNCEMENTS_PREFIX}${condominiumId}`, JSON.stringify(updated));
      announcementsCache.set(condominiumId, updated);
      window.dispatchEvent(new CustomEvent('condor:announcements-updated'));
      return { error: null };
    }

    if (!isSupabaseConfigured) {
      return { error: { message: 'Exclusão bloqueada: Supabase não configurado.' } };
    }

    try {
      const { error } = await (supabase.from('announcements') as any)
        .delete()
        .eq('id', id)
        .eq('condominium_id', condominiumId);

      if (error) {
        return { error: { message: error.message } };
      }

      const updated = (announcementsCache.get(condominiumId) || []).filter((a) => a.id !== id);
      announcementsCache.set(condominiumId, updated);

      await auditService.log({
        condominiumId,
        action: 'ANNOUNCEMENT_DELETED',
        entityTable: 'announcements',
        entityId: id,
      });

      window.dispatchEvent(new CustomEvent('condor:announcements-updated'));
      return { error: null };
    } catch (err: any) {
      return { error: { message: err?.message || 'Erro ao excluir comunicado no Supabase.' } };
    }
  },

  /**
   * Alterna fixação (pin) de um comunicado no Supabase.
   */
  async togglePinAsync(
    id: string,
    condominiumId: string = ''
  ): Promise<{ error: { message: string } | null }> {
    const current = this.getAnnouncements(condominiumId);
    const target = current.find((a) => a.id === id);
    if (!target) return { error: null };

    return (
      await this.updateAnnouncementAsync(
        id,
        {
          title: target.title,
          category: target.category,
          content: target.content,
          author: target.author,
          isPinned: !target.isPinned,
        },
        condominiumId
      )
    );
  },

  clearCache(): void {
    announcementsCache.clear();
  },
};
