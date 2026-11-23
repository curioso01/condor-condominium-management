import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode } from 'lucide-react';

export interface QrCodeDisplayProps {
  value: string;
  size?: number;
  alt?: string;
  className?: string;
}

/**
 * Renderiza um QR Code real e escaneável gerado dinamicamente a partir do payload fornecido
 * (ex: BR Code EMVCo Pix oficial com CRC16-CCITT ou Token de visitante).
 */
export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({
  value,
  size = 160,
  alt = 'QR Code',
  className = '',
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!value || !value.trim()) {
      setDataUrl('');
      setFailed(false);
      return;
    }

    QRCode.toDataURL(value, {
      width: size * 2,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) {
          setDataUrl(url);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl('');
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!value || failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-xl bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400 p-3 text-center ${className}`}
      >
        <QrCode className="w-7 h-7 mb-1 opacity-60" />
        <span className="text-[10px] font-semibold">QR indisponível</span>
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse ${className}`}
        aria-label="Gerando QR Code"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      alt={alt}
      width={size}
      height={size}
      className={`rounded-lg block ${className}`}
      style={{ width: size, height: size, imageRendering: 'pixelated' }}
    />
  );
};
