export interface Announcement {
  id: string;
  title: string;
  category: 'Urgente' | 'Assembleia' | 'Manutenção' | 'Convivência' | 'Geral';
  priority: 'alta' | 'media' | 'normal';
  author: string;
  date: string;
  content: string;
  isPinned: boolean;
  viewsCount: number;
}

export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'anc-1',
    title: 'Assembleia Geral Ordinária (AGO) - Previsão Orçamentária 2027',
    category: 'Assembleia',
    priority: 'alta',
    author: 'Dra. Patrícia Lima • Síndica Geral',
    date: '28 de Outubro às 19:30',
    content:
      'Convocamos todos os condôminos para a Assembleia Geral no Salão de Festas Principal (Bloco A) e via transmissão online no app Condor. Pautas: Prestação de contas do exercício atual, eleição do conselho fiscal e aprovação da modernização dos elevadores.',
    isPinned: true,
    viewsCount: 178,
  },
  {
    id: 'anc-2',
    title: 'Manutenção Preventiva dos Elevadores Atlas & Barramento Elétrico',
    category: 'Manutenção',
    priority: 'media',
    author: 'Engenharia Predial Condor',
    date: 'Amanhã, das 09:00 às 13:00',
    content:
      'Informamos que os elevadores sociais da Torre 1 passarão por manutenção preventiva periódica. Durante o período, o elevador de serviço estará operando normalmente com prioridade a idosos e gestantes.',
    isPinned: true,
    viewsCount: 152,
  },
  {
    id: 'anc-3',
    title: "Aviso Importante: Limpeza Semestral das Caixas d'Água",
    category: 'Urgente',
    priority: 'alta',
    author: 'Administração Predial',
    date: '15 de Novembro (Feriado)',
    content:
      'Haverá interrupção temporária no fornecimento de água potável entre 08:00 e 14:00 para desinfecção e laudo bacteriológico das caixas superiores. Solicitamos que economizem água.',
    isPinned: false,
    viewsCount: 134,
  },
  {
    id: 'anc-4',
    title: 'Campanha de Convivência: Recolhimento de Dejetos Pets nas Áreas Verdes',
    category: 'Convivência',
    priority: 'normal',
    author: 'Comissão de Moradores',
    date: '02 de Outubro',
    content:
      'Lembramos aos tutores que é obrigatório o uso de guia e o recolhimento imediato dos dejetos nas praças internas e pista de caminhada. Estações de saquinhos biodegradáveis já foram instaladas no Pet Place.',
    isPinned: false,
    viewsCount: 165,
  },
];

class AnnouncementService {
  private getStorageKey(condominiumId?: string): string {
    return `condor_announcements_${condominiumId || 'condo-imperial-001'}`;
  }

  public getAnnouncements(condominiumId?: string): Announcement[] {
    try {
      const stored = localStorage.getItem(this.getStorageKey(condominiumId));
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }

    // Initialize with default announcements
    this.saveAnnouncements(INITIAL_ANNOUNCEMENTS, condominiumId);
    return [...INITIAL_ANNOUNCEMENTS];
  }

  public saveAnnouncements(items: Announcement[], condominiumId?: string): void {
    try {
      localStorage.setItem(this.getStorageKey(condominiumId), JSON.stringify(items));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('condor:announcements-updated'));
      }
    } catch {
      // ignore
    }
  }

  public createAnnouncement(
    input: Omit<Announcement, 'id' | 'viewsCount'>,
    condominiumId?: string
  ): Announcement {
    const list = this.getAnnouncements(condominiumId);
    const newItem: Announcement = {
      id: `anc-${Date.now()}`,
      ...input,
      viewsCount: 1,
    };
    const updated = [newItem, ...list];
    this.saveAnnouncements(updated, condominiumId);
    return newItem;
  }

  public deleteAnnouncement(id: string, condominiumId?: string): void {
    const list = this.getAnnouncements(condominiumId);
    const updated = list.filter((a) => a.id !== id);
    this.saveAnnouncements(updated, condominiumId);
  }

  public togglePin(id: string, condominiumId?: string): void {
    const list = this.getAnnouncements(condominiumId);
    const updated = list.map((a) => (a.id === id ? { ...a, isPinned: !a.isPinned } : a));
    this.saveAnnouncements(updated, condominiumId);
  }

  public incrementViews(id: string, condominiumId?: string): void {
    const list = this.getAnnouncements(condominiumId);
    const updated = list.map((a) => (a.id === id ? { ...a, viewsCount: a.viewsCount + 1 } : a));
    this.saveAnnouncements(updated, condominiumId);
  }
}

export const announcementService = new AnnouncementService();
