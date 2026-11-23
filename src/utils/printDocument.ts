/**
 * Imprime um documento HTML completo em um iframe oculto e isolado.
 * Evita páginas em branco causadas por overlays `fixed`, `overflow: hidden` ou temas escuros de SPAs.
 * Funciona sem ser bloqueado por bloqueadores de pop-up em Chrome, Edge, Safari e Firefox.
 */
export function printHtmlDocument(title: string, bodyHtml: string, extraCss: string = ''): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const existing = document.getElementById('condor-print-iframe');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = 'condor-print-iframe';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    window.print();
    return;
  }

  const safeTitle = title.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const fullHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${safeTitle}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff !important;
      color: #0f172a !important;
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 12px;
      line-height: 1.45;
    }
    ${extraCss}
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`;

  doc.open();
  doc.write(fullHtml);
  doc.close();

  const triggerPrint = () => {
    const win = iframe.contentWindow;
    if (!win) return;
    win.focus();
    win.print();
    setTimeout(() => {
      iframe.remove();
    }, 1500);
  };

  // Aguarda todas as imagens (incluindo QR Code dataURL) carregarem antes de disparar o diálogo de impressão
  const images = Array.from(doc.images || []);
  if (images.length === 0) {
    setTimeout(triggerPrint, 120);
    return;
  }

  let loadedCount = 0;
  let printed = false;
  const done = () => {
    loadedCount += 1;
    if (!printed && loadedCount >= images.length) {
      printed = true;
      setTimeout(triggerPrint, 80);
    }
  };

  images.forEach((img) => {
    if (img.complete) {
      done();
    } else {
      img.onload = done;
      img.onerror = done;
    }
  });

  // Fallback de segurança caso alguma imagem não dispare onload
  setTimeout(() => {
    if (!printed) {
      printed = true;
      triggerPrint();
    }
  }, 1000);
}

export function escapeHtml(str: string | number | null | undefined): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
