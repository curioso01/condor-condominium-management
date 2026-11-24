import { supabase, isSupabaseConfigured, isDemoSessionActive } from '../lib/supabase';

/**
 * Redimensiona e comprime a imagem no cliente (máx 256x256 JPEG/WebP < ~40 KB),
 * evitando payloads gigantes de 5 MB em base64 no banco de dados.
 */
async function compressAvatarFile(file: File, maxSize: number = 256): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Falha ao inicializar canvas de compressão.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(objectUrl);
            if (!blob) {
              reject(new Error('Falha ao comprimir imagem.'));
              return;
            }
            resolve(blob);
          },
          'image/webp',
          0.82
        );
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Não foi possível ler o arquivo de imagem.'));
    };

    img.src = objectUrl;
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler imagem comprimida.'));
    reader.readAsDataURL(blob);
  });
}

export const avatarService = {
  /**
   * Comprime a imagem no cliente (256x256 WebP) e envia para o bucket `avatars` no Supabase Storage.
   * Se o bucket ainda não tiver sido provisionado no ambiente, retorna a versão ultra-comprimida (<40 KB)
   * garantindo que nenhum blob de 5 MB seja salvo no PostgreSQL.
   */
  async uploadAvatar(
    file: File,
    userId: string
  ): Promise<{ url: string | null; storageUsed: boolean; error: { message: string } | null }> {
    if (!file.type.startsWith('image/')) {
      return {
        url: null,
        storageUsed: false,
        error: { message: 'Selecione um arquivo de imagem válido (PNG, JPG ou WEBP).' },
      };
    }

    if (file.size > 5 * 1024 * 1024) {
      return {
        url: null,
        storageUsed: false,
        error: { message: 'A imagem excede o limite de 5 MB. Escolha um arquivo menor.' },
      };
    }

    try {
      const compressedBlob = await compressAvatarFile(file, 256);

      if (isSupabaseConfigured && !isDemoSessionActive() && userId) {
        const filePath = `${userId}/avatar-${Date.now()}.webp`;
        const { error: uploadErr } = await supabase.storage
          .from('avatars')
          .upload(filePath, compressedBlob, {
            contentType: 'image/webp',
            upsert: true,
          });

        if (!uploadErr) {
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
          if (publicUrlData?.publicUrl) {
            return { url: publicUrlData.publicUrl, storageUsed: true, error: null };
          }
        }
      }

      // Fallback seguro e ultra-leve (<40 KB) caso o bucket ainda não exista no ambiente
      const compactDataUrl = await blobToDataUrl(compressedBlob);
      return { url: compactDataUrl, storageUsed: false, error: null };
    } catch (err: any) {
      return {
        url: null,
        storageUsed: false,
        error: { message: err?.message || 'Erro ao processar a foto de perfil.' },
      };
    }
  },
};
