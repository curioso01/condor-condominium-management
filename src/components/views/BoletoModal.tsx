import React, { useState, useMemo, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Printer,
  Copy,
  Check,
  QrCode,
  ShieldCheck,
  Landmark,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  bankAccountService,
  generateOfficialPixPayload,
  isValidPixKeyConfigured,
  type CondominiumBankSettings,
} from '../../services/bankAccountService';
import { QrCodeDisplay } from '../common/QrCodeDisplay';
import { printHtmlDocument, escapeHtml } from '../../utils/printDocument';

export interface BoletoInvoiceData {
  id: string;
  unitNumber: string;
  block: string;
  residentName: string;
  description: string;
  dueDate: string;
  amount: number;
  documentNumber?: string;
  cpf?: string;
}

interface BoletoModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice?: BoletoInvoiceData | null;
  customBankSettings?: CondominiumBankSettings;
  onConfigureBank?: () => void;
}

export const BoletoModal: React.FC<BoletoModalProps> = ({
  isOpen,
  onClose,
  invoice,
  customBankSettings,
  onConfigureBank,
}) => {
  const { currentCondominium, isSindico, isSuperAdmin } = useAuth();
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const bank = useMemo(() => {
    return (
      customBankSettings ||
      bankAccountService.getSettings(
        currentCondominium?.id || '',
        currentCondominium?.name || 'Condomínio',
        currentCondominium?.cnpj || ''
      )
    );
  }, [customBankSettings, currentCondominium?.id, currentCondominium?.name, currentCondominium?.cnpj]);

  const currentInvoice: BoletoInvoiceData = useMemo(() => {
    if (invoice) return invoice;
    return {
      id: 'PREVIA-PIX-01',
      unitNumber: '101',
      block: 'Bloco A',
      residentName: 'Modelo de Pré-visualização',
      description: 'Cota Condominial Ordinária (Prévia da Chave Pix)',
      dueDate: new Date().toLocaleDateString('pt-BR'),
      amount: 850.0,
    };
  }, [invoice]);

  const pixConfigured = isValidPixKeyConfigured(bank);

  // Payload Pix EMVCo BR Code oficial com CRC16-CCITT real (chave cadastrada pela síndica)
  const pixPayload = useMemo(() => {
    if (!pixConfigured) return '';
    return generateOfficialPixPayload({
      pixKey: bank.pixKey,
      pixKeyType: bank.pixKeyType,
      merchantName: bank.pixMerchantName || bank.beneficiaryName || currentCondominium?.name || 'CONDOMINIO',
      merchantCity: bank.pixMerchantCity || currentCondominium?.city || 'SAO PAULO',
      amount: currentInvoice.amount,
      txid: `CONDOR${currentInvoice.unitNumber}${currentInvoice.id}`.replace(/[^A-Za-z0-9]/g, '').slice(0, 25),
      description: `Cota ${currentInvoice.unitNumber} ${currentInvoice.block}`.slice(0, 30),
    });
  }, [bank, pixConfigured, currentInvoice, currentCondominium?.name, currentCondominium?.city]);

  if (!isOpen) return null;

  const handleCopyPix = () => {
    if (!pixPayload) return;
    navigator.clipboard.writeText(pixPayload);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleCopyPixKey = () => {
    if (!bank.pixKey) return;
    navigator.clipboard.writeText(bank.pixKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2500);
  };

  const handlePrint = async () => {
    let qrDataUrl = '';
    if (pixConfigured && pixPayload) {
      try {
        qrDataUrl = await QRCode.toDataURL(pixPayload, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#0f172a', light: '#ffffff' },
        });
      } catch (err) {
        console.warn('[BoletoModal] Erro ao gerar QR Code para impressão:', err);
      }
    }

    const beneficiary = escapeHtml(bank.beneficiaryName || currentCondominium?.name || 'Condomínio');
    const cnpj = escapeHtml(bank.beneficiaryCnpj || currentCondominium?.cnpj || 'Não informado');
    const bankLine = escapeHtml(bank.bankName || 'Conta do Condomínio');
    const unitLine = escapeHtml(`Unidade ${currentInvoice.unitNumber} • ${currentInvoice.block}`);
    const resident = escapeHtml(currentInvoice.residentName);
    const desc = escapeHtml(currentInvoice.description);
    const due = escapeHtml(currentInvoice.dueDate);
    const docId = escapeHtml(currentInvoice.documentNumber || currentInvoice.id);
    const issuedAt = escapeHtml(new Date().toLocaleString('pt-BR'));

    const pixSection = pixConfigured
      ? `
        <div class="pix-box">
          <div class="pix-grid">
            ${qrDataUrl ? `<div class="qr-wrap"><img src="${qrDataUrl}" alt="QR Code Pix Oficial" width="156" height="156" /></div>` : ''}
            <div class="pix-info">
              <div class="badge">PIX OFICIAL • BR CODE BACEN (CRC16)</div>
              <h3>Pague via Pix no aplicativo do seu banco</h3>
              <p>Escaneie o QR Code ao lado ou utilize a chave Pix oficial cadastrada pela administração deste condomínio:</p>
              <div class="key-pill"><strong>Chave Pix (${escapeHtml(bank.pixKeyType)}):</strong> ${escapeHtml(bank.pixKey)}</div>
              <div class="copy-box">
                <div class="copy-label">Pix Copia e Cola (EMVCo):</div>
                <div class="copy-code">${escapeHtml(pixPayload)}</div>
              </div>
            </div>
          </div>
        </div>
      `
      : `
        <div class="warn-box">
          <strong>Chave Pix do condomínio ainda não cadastrada.</strong><br/>
          Cadastre a chave Pix oficial em Configurações &gt; Banco de Recebimento &amp; Boletos para exibir o QR Code neste demonstrativo.
        </div>
      `;

    const bodyHtml = `
      <div class="sheet">
        <div class="header">
          <div>
            <div class="brand">CONDOR • GESTÃO CONDOMINIAL</div>
            <h1>${beneficiary}</h1>
            <div class="meta">CNPJ: ${cnpj} &nbsp;•&nbsp; ${bankLine}</div>
          </div>
          <div class="amount-box">
            <div class="amount-label">VALOR A PAGAR</div>
            <div class="amount-value">${escapeHtml(formattedAmount)}</div>
            <div class="due-label">Vencimento: <strong>${due}</strong></div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-card">
            <div class="label">Pagador / Responsável</div>
            <div class="val">${resident}</div>
          </div>
          <div class="info-card">
            <div class="label">Unidade / Bloco</div>
            <div class="val">${unitLine}</div>
          </div>
          <div class="info-card">
            <div class="label">Referência / Descrição</div>
            <div class="val">${desc}</div>
          </div>
          <div class="info-card">
            <div class="label">Identificador do Documento</div>
            <div class="val mono">${docId}</div>
          </div>
        </div>

        ${pixSection}

        <div class="instructions">
          <div class="inst-title">Instruções de Pagamento e Baixa</div>
          <ul>
            <li>Este demonstrativo utiliza o padrão oficial Pix BR Code (BACEN) direcionado diretamente à conta bancária do condomínio.</li>
            <li>Após efetuar o pagamento via Pix, guarde o comprovante bancário. A confirmação e baixa no painel financeiro são registradas pela administração.</li>
            <li>Em caso de dúvidas sobre a cobrança, entre em contato com a administração do condomínio.</li>
          </ul>
        </div>

        <div class="footer">
          <span>Documento emitido eletronicamente via Plataforma Condor em ${issuedAt}</span>
          <span>Via do Condômino</span>
        </div>
      </div>
    `;

    const css = `
      .sheet { max-width: 100%; border: 1.5px solid #cbd5e1; border-radius: 14px; padding: 22px 24px; background: #fff; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #0f172a; padding-bottom: 14px; margin-bottom: 16px; }
      .brand { font-size: 10px; font-weight: 800; letter-spacing: 0.1em; color: #059669; margin-bottom: 4px; }
      h1 { margin: 0; font-size: 19px; font-weight: 800; color: #0f172a; }
      .meta { font-size: 11px; color: #475569; margin-top: 4px; }
      .amount-box { text-align: right; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; min-width: 175px; }
      .amount-label { font-size: 9px; font-weight: 800; letter-spacing: 0.08em; color: #64748b; }
      .amount-value { font-size: 22px; font-weight: 900; color: #0f172a; margin-top: 2px; }
      .due-label { font-size: 11px; color: #334155; margin-top: 2px; }
      .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
      .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; }
      .label { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #64748b; letter-spacing: 0.05em; }
      .val { font-size: 12.5px; font-weight: 700; color: #0f172a; margin-top: 3px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
      .pix-box { background: #ecfdf5; border: 1.5px solid #6ee7b7; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
      .pix-grid { display: flex; align-items: flex-start; gap: 16px; }
      .qr-wrap { background: #ffffff; border: 1px solid #a7f3d0; border-radius: 10px; padding: 8px; flex-shrink: 0; }
      .qr-wrap img { display: block; }
      .pix-info { flex: 1; min-width: 0; }
      .badge { display: inline-block; font-size: 9px; font-weight: 800; letter-spacing: 0.06em; color: #065f46; background: #d1fae5; padding: 3px 8px; border-radius: 999px; }
      .pix-info h3 { margin: 6px 0 4px; font-size: 14px; font-weight: 800; color: #064e3b; }
      .pix-info p { margin: 0 0 8px; font-size: 11px; color: #065f46; }
      .key-pill { background: #ffffff; border: 1px solid #a7f3d0; border-radius: 8px; padding: 6px 10px; font-size: 11.5px; color: #0f172a; margin-bottom: 8px; word-break: break-all; }
      .copy-box { background: #ffffff; border: 1px dashed #6ee7b7; border-radius: 8px; padding: 8px 10px; }
      .copy-label { font-size: 9px; font-weight: 800; text-transform: uppercase; color: #047857; margin-bottom: 3px; }
      .copy-code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 9.5px; color: #334155; word-break: break-all; line-height: 1.35; }
      .warn-box { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 10px; padding: 14px; color: #78350f; margin-bottom: 16px; font-size: 11.5px; }
      .instructions { border-top: 1px solid #e2e8f0; padding-top: 12px; margin-bottom: 14px; }
      .inst-title { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: #475569; margin-bottom: 6px; }
      .instructions ul { margin: 0; padding-left: 18px; color: #334155; font-size: 11px; }
      .instructions li { margin-bottom: 3px; }
      .footer { border-top: 1px solid #e2e8f0; padding-top: 10px; display: flex; justify-content: space-between; font-size: 10px; color: #64748b; }
    `;

    printHtmlDocument(`Demonstrativo Pix — Unidade ${currentInvoice.unitNumber}`, bodyHtml, css);
  };

  const formattedAmount = currentInvoice.amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const isAdmin = isSindico || isSuperAdmin;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boleto-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #condor-printable-boleto, #condor-printable-boleto * { visibility: visible; }
          #condor-printable-boleto {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 16px;
          }
          .no-print { display: none !important; }
        }
      `}</style>

      <div className="relative w-full max-w-3xl max-h-[92vh] flex flex-col bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Barra superior */}
        <div className="no-print shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="boleto-modal-title"
                className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap"
              >
                <span>Demonstrativo de Cobrança &amp; Pix Oficial</span>
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  BR Code BACEN
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unidade {currentInvoice.unitNumber} • {currentInvoice.block} • {currentInvoice.residentName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Fechar demonstrativo"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Área imprimível */}
        <div id="condor-printable-boleto" className="flex-1 min-h-0 overflow-y-auto p-6 sm:p-8 space-y-6 text-slate-900 bg-white">
          {/* Cabeçalho do Beneficiário */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  {bank.beneficiaryName || currentCondominium?.name || 'Condomínio'}
                </h4>
                <span className="text-xs font-semibold text-slate-500">
                  CNPJ: {bank.beneficiaryCnpj || currentCondominium?.cnpj || 'Não informado'} • {bank.bankName}
                </span>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Valor a Pagar</span>
              <span className="text-2xl font-black text-slate-900 tabular-nums">{formattedAmount}</span>
            </div>
          </div>

          {/* Alerta se chave Pix ainda não foi configurada pela síndica */}
          {!pixConfigured ? (
            <div className="p-5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-sm font-bold">Chave Pix do Condomínio ainda não cadastrada</h5>
                  <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                    Para gerar o QR Code Pix oficial e o código Copia e Cola válidos para este condomínio, a síndica precisa cadastrar a chave Pix em <strong>Configurações &gt; Banco de Recebimento &amp; Boletos</strong>.
                  </p>
                </div>
              </div>
              {isAdmin && onConfigureBank && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onConfigureBank();
                  }}
                  className="no-print px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Cadastrar Chave Pix Agora</span>
                </button>
              )}
            </div>
          ) : (
            /* Bloco Pix Oficial com QR Code Real Dinâmico */
            <div className="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="p-2.5 bg-white rounded-2xl shadow-sm border border-emerald-200 shrink-0">
                  <QrCodeDisplay
                    value={pixPayload}
                    size={136}
                    alt={`QR Code Pix de ${formattedAmount} para ${bank.beneficiaryName}`}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>QR Code Pix Oficial (CRC16 Validado)</span>
                  </div>
                  <h5 className="text-sm font-extrabold text-slate-900">
                    Aponte a câmera do aplicativo do seu banco
                  </h5>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                    Pagamento direcionado diretamente à chave Pix ({bank.pixKeyType}) cadastrada pela administração do condomínio. Após pagar, aguarde a confirmação/baixa manual pela síndica.
                  </p>
                  <div className="pt-1 flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                    <span className="text-[11px] font-mono font-bold bg-white px-2.5 py-1 rounded-lg border border-emerald-200 text-slate-800">
                      Chave ({bank.pixKeyType}): {bank.pixKey}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyPixKey}
                      className="no-print text-[11px] font-bold text-emerald-700 hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey ? 'Chave copiada!' : 'Copiar chave'}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="no-print w-full md:w-auto flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleCopyPix}
                  className="w-full md:w-auto px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  {copiedPix ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedPix ? 'Pix Copia e Cola Copiado!' : 'Copiar Pix Copia e Cola'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Pix Copia e Cola legível para impressão/conferência */}
          {pixConfigured && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-500 block mb-1">
                Código Pix Copia e Cola (Padrão EMVCo BACEN)
              </span>
              <p className="font-mono text-[10px] text-slate-700 break-all select-all leading-relaxed">
                {pixPayload}
              </p>
            </div>
          )}

          {/* Ficha de Detalhamento da Cobrança */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border border-slate-200 rounded-2xl p-4 bg-slate-50/60">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Pagador / Morador</span>
              <span className="font-bold text-slate-900 mt-0.5 block">{currentInvoice.residentName}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Unidade / Bloco</span>
              <span className="font-bold text-slate-900 mt-0.5 block">
                {currentInvoice.unitNumber} • {currentInvoice.block}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Vencimento</span>
              <span className="font-bold text-slate-900 mt-0.5 block tabular-nums">{currentInvoice.dueDate}</span>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Identificador</span>
              <span className="font-mono font-bold text-slate-800 mt-0.5 block truncate">
                {currentInvoice.id.slice(0, 14).toUpperCase()}
              </span>
            </div>

            <div className="col-span-2 sm:col-span-4 pt-3 border-t border-slate-200">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">Descrição da Cobrança</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{currentInvoice.description}</span>
            </div>
          </div>

          {/* Dados Bancários de Conferência + Instruções */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px] text-slate-600">
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Domicílio Bancário de Conferência
              </span>
              <p>
                <strong>Banco:</strong> {bank.bankCode} — {bank.bankName}
              </p>
              <p>
                <strong>Agência / Conta:</strong> Ag {bank.agency} • C/C {bank.accountNumber}-{bank.accountDigit}
              </p>
              <p>
                <strong>Modalidade:</strong> Recebimento via Pix + Baixa Manual pela Administração
              </p>
            </div>
            <div className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-1">
              <span className="text-[10px] font-bold uppercase text-slate-400 block">
                Instruções &amp; Encargos
              </span>
              <p>{bank.instructionsLine1 || `Multa de ${bank.penaltyPercent}% e juros de ${bank.interestMonthlyPercent}% ao mês após o vencimento.`}</p>
              {bank.instructionsLine2 && <p>{bank.instructionsLine2}</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
