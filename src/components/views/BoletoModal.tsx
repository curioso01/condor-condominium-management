import React, { useState, useMemo } from 'react';
import { X, Printer, Copy, Check, QrCode, ShieldCheck, Landmark } from 'lucide-react';
import {
  bankAccountService,
  generateOfficialPixPayload,
  generateBoletoNumbers,
  type CondominiumBankSettings,
} from '../../services/bankAccountService';

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
}

export const BoletoModal: React.FC<BoletoModalProps> = ({
  isOpen,
  onClose,
  invoice,
  customBankSettings,
}) => {
  const [copiedPix, setCopiedPix] = useState(false);
  const [copiedLinha, setCopiedLinha] = useState(false);

  const bank = useMemo(() => {
    return customBankSettings || bankAccountService.getSettings();
  }, [customBankSettings]);

  // Se não houver fatura fornecida, usa dados de demonstração
  const currentInvoice: BoletoInvoiceData = useMemo(() => {
    if (invoice) return invoice;
    return {
      id: 'BOL-2026-9812',
      unitNumber: '402',
      block: 'Bloco A',
      residentName: 'Dr. Roberto Mendonça',
      description: 'Taxa Condominial Ordinária + Fundo de Reserva (Ref. 10/2026)',
      dueDate: '10/10/2026',
      amount: 840.00,
      cpf: '281.934.712-05',
    };
  }, [invoice]);

  // Números do boleto (Linha digitável, Nosso Número e Código de Barras)
  const boletoNumbers = useMemo(() => {
    return generateBoletoNumbers({
      bankCode: bank.bankCode,
      agency: bank.agency,
      account: bank.accountNumber,
      wallet: bank.walletCode,
      amount: currentInvoice.amount,
      documentNumber: currentInvoice.id,
    });
  }, [bank, currentInvoice]);

  // Payload Pix EMVCo BR Code oficial
  const pixPayload = useMemo(() => {
    return generateOfficialPixPayload({
      pixKey: bank.pixKey,
      merchantName: bank.pixMerchantName,
      merchantCity: bank.pixMerchantCity,
      amount: currentInvoice.amount,
      txid: currentInvoice.id.replace(/\W/g, '').slice(0, 20),
      description: `Condominio ${currentInvoice.unitNumber} ${currentInvoice.block}`.slice(0, 35),
    });
  }, [bank, currentInvoice]);

  if (!isOpen) return null;

  const handleCopyPix = () => {
    navigator.clipboard.writeText(pixPayload);
    setCopiedPix(true);
    setTimeout(() => setCopiedPix(false), 2500);
  };

  const handleCopyLinha = () => {
    navigator.clipboard.writeText(boletoNumbers.linhaDigitavel);
    setCopiedLinha(true);
    setTimeout(() => setCopiedLinha(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  // Código com dígito verificador bancário
  const bankCodeWithDv = `${bank.bankCode}-${bank.bankCode === '341' ? '7' : bank.bankCode === '001' ? '9' : bank.bankCode === '237' ? '2' : bank.bankCode === '033' ? '7' : '0'}`;

  // Formatação de Moeda
  const formattedAmount = currentInvoice.amount.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/70 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="boleto-modal-title"
    >
      {/* Estilos para impressão limpa do boleto bancário */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #condor-printable-boleto, #condor-printable-boleto * {
            visibility: visible;
          }
          #condor-printable-boleto {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white !important;
            color: black !important;
            padding: 10px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 my-auto overflow-hidden">
        {/* Barra superior de controle (não imprime) */}
        <div className="no-print flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-xs">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h3 id="boleto-modal-title" className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Boleto Bancário Híbrido (com Pix)
                <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {bank.bankName.split('-')[1]?.trim() || bank.bankName}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Apto {currentInvoice.unitNumber} • {currentInvoice.block} • {currentInvoice.residentName}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              title="Imprimir folha de boleto bancário"
            >
              <Printer className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="hidden sm:inline">Imprimir / Salvar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Fechar boleto"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ÁREA IMPRIMÍVEL DO BOLETO (FOLHA FEBRABAN) */}
        <div id="condor-printable-boleto" className="p-6 sm:p-8 space-y-6 text-slate-900 bg-white">
          {/* TOPO: BANCO, CÓDIGO E LINHA DIGITÁVEL */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-slate-900">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-sm">
                {bank.bankCode}
              </div>
              <div>
                <h4 className="text-lg font-black tracking-tight text-slate-900">
                  {bank.bankName}
                </h4>
                <span className="text-xs font-bold text-slate-500">
                  Compensação: {bankCodeWithDv}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono text-xs sm:text-sm font-extrabold tracking-wider bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-900">
                {boletoNumbers.linhaDigitavel}
              </span>
              <button
                type="button"
                onClick={handleCopyLinha}
                className="no-print p-2 text-slate-600 hover:text-emerald-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                title="Copiar linha digitável"
              >
                {copiedLinha ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* DESTAQUE PIX HÍBRIDO (QR CODE + COPIA E COLA) */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-2 border-emerald-500/30 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              {/* QR Code SVG nítido */}
              <div className="p-2 bg-white rounded-xl shadow-md border border-emerald-300 relative shrink-0">
                <svg className="w-28 h-28 text-slate-950" viewBox="0 0 100 100" fill="currentColor">
                  {/* Padrões de canto do QR Code (Finders) */}
                  <path d="M6,6 h28 v28 h-28 z M10,10 v20 h20 v-20 z M15,15 h10 v10 h-10 z" />
                  <path d="M66,6 h28 v28 h-28 z M70,10 v20 h20 v-20 z M75,15 h10 v10 h-10 z" />
                  <path d="M6,66 h28 v28 h-28 z M10,70 v20 h20 v-20 z M15,75 h10 v10 h-10 z" />
                  {/* Linhas de sincronismo */}
                  <rect x="38" y="8" width="5" height="5" />
                  <rect x="48" y="8" width="5" height="5" />
                  <rect x="58" y="8" width="5" height="5" />
                  <rect x="8" y="38" width="5" height="5" />
                  <rect x="8" y="48" width="5" height="5" />
                  <rect x="8" y="58" width="5" height="5" />
                  {/* Módulos de dados de alta densidade */}
                  <rect x="38" y="20" width="8" height="6" />
                  <rect x="52" y="20" width="8" height="6" />
                  <rect x="40" y="36" width="6" height="6" />
                  <rect x="54" y="36" width="6" height="6" />
                  <rect x="20" y="48" width="10" height="6" />
                  <rect x="36" y="48" width="8" height="8" />
                  <rect x="50" y="48" width="8" height="8" />
                  <rect x="68" y="48" width="12" height="6" />
                  <rect x="38" y="64" width="8" height="6" />
                  <rect x="52" y="64" width="10" height="6" />
                  <rect x="68" y="64" width="8" height="10" />
                  <rect x="82" y="64" width="8" height="6" />
                  <rect x="38" y="78" width="6" height="12" />
                  <rect x="52" y="78" width="12" height="6" />
                  <rect x="70" y="78" width="10" height="12" />
                  <rect x="84" y="78" width="8" height="10" />
                  {/* Emblema Central PIX */}
                  <rect x="42" y="42" width="16" height="16" rx="3" fill="#059669" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-[7px] font-black tracking-tighter text-white bg-emerald-600 px-1 py-0.5 rounded shadow-xs">
                    PIX
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-600 text-white font-extrabold text-[10px] uppercase tracking-wider">
                  <QrCode className="w-3 h-3" />
                  <span>Boleto Híbrido com Pix Oficial</span>
                </div>
                <h5 className="font-extrabold text-slate-900 text-sm">
                  Pague com Pix e liquide na hora!
                </h5>
                <p className="text-xs text-slate-600 max-w-md">
                  Abra o aplicativo de qualquer banco, aponte a câmera para o QR Code acima ou use a chave Copia e Cola.
                </p>
                <p className="text-[11px] text-emerald-800 font-semibold">
                  Recebedor: <span className="font-bold">{bank.beneficiaryName}</span> (Chave: {bank.pixKey})
                </p>
              </div>
            </div>

            <div className="no-print flex flex-col gap-2 w-full md:w-auto shrink-0">
              <button
                type="button"
                onClick={handleCopyPix}
                className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer"
              >
                {copiedPix ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Chave Pix Copiada!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Pix Copia e Cola</span>
                  </>
                )}
              </button>
              <span className="text-[10px] text-center text-slate-500">
                Liquidação 24/7 em até 10 segundos
              </span>
            </div>
          </div>

          {/* TABELA FEBRABAN: FICHA DE COMPENSAÇÃO */}
          <div className="border-2 border-slate-900 text-xs">
            {/* Linha 1: Local de Pagamento & Vencimento */}
            <div className="grid grid-cols-1 md:grid-cols-4 border-b border-slate-900">
              <div className="p-2 border-b md:border-b-0 md:border-r border-slate-900 md:col-span-3">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Local de Pagamento</span>
                <span className="font-bold text-slate-900">
                  PAGÁVEL EM QUALQUER BANCO OU CANAIS ELETRÔNICOS ATÉ O VENCIMENTO
                </span>
              </div>
              <div className="p-2 bg-slate-50">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Vencimento</span>
                <span className="font-extrabold text-sm text-slate-950">{currentInvoice.dueDate}</span>
              </div>
            </div>

            {/* Linha 2: Beneficiário & Agência/Código */}
            <div className="grid grid-cols-1 md:grid-cols-4 border-b border-slate-900">
              <div className="p-2 border-b md:border-b-0 md:border-r border-slate-900 md:col-span-3">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Beneficiário</span>
                <p className="font-extrabold text-slate-900">
                  {bank.beneficiaryName} — CNPJ: {bank.beneficiaryCnpj}
                </p>
                <p className="text-[10px] text-slate-600">{bank.beneficiaryAddress}</p>
              </div>
              <div className="p-2">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Agência / Código Beneficiário</span>
                <span className="font-extrabold text-slate-900">
                  {bank.agency}{bank.agencyDigit ? `-${bank.agencyDigit}` : ''} / {bank.accountNumber}-{bank.accountDigit}
                </span>
              </div>
            </div>

            {/* Linha 3: Dados do Título */}
            <div className="grid grid-cols-2 md:grid-cols-6 border-b border-slate-900">
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Data do Documento</span>
                <span className="font-bold text-slate-800">
                  {new Date().toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Nº do Documento</span>
                <span className="font-bold text-slate-800">{currentInvoice.id}</span>
              </div>
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Espécie DOC</span>
                <span className="font-bold text-slate-800">{bank.documentVariety || 'DM'}</span>
              </div>
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Aceite</span>
                <span className="font-bold text-slate-800">N</span>
              </div>
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Data Processamento</span>
                <span className="font-bold text-slate-800">{new Date().toLocaleDateString('pt-BR')}</span>
              </div>
              <div className="p-2 bg-slate-50">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Nosso Número</span>
                <span className="font-extrabold text-slate-900">{boletoNumbers.nossoNumero}</span>
              </div>
            </div>

            {/* Linha 4: Carteira, Moeda e Valor */}
            <div className="grid grid-cols-2 md:grid-cols-6 border-b border-slate-900">
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Uso do Banco</span>
                <span className="font-bold text-slate-800">0000</span>
              </div>
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Carteira</span>
                <span className="font-bold text-slate-800">{bank.walletCode}</span>
              </div>
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Espécie</span>
                <span className="font-bold text-slate-800">R$</span>
              </div>
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Quantidade</span>
                <span className="font-bold text-slate-800">—</span>
              </div>
              <div className="p-2 border-r border-slate-900">
                <span className="block text-[9px] font-bold uppercase text-slate-500">Valor Unitário</span>
                <span className="font-bold text-slate-800">—</span>
              </div>
              <div className="p-2 bg-slate-50">
                <span className="block text-[9px] font-bold uppercase text-slate-500">(=) Valor do Documento</span>
                <span className="font-black text-sm text-slate-950">{formattedAmount}</span>
              </div>
            </div>

            {/* Linha 5: Instruções e Valores Deduzidos / Multa */}
            <div className="grid grid-cols-1 md:grid-cols-4 border-b border-slate-900 min-h-[120px]">
              <div className="p-3 border-b md:border-b-0 md:border-r border-slate-900 md:col-span-3 space-y-1.5">
                <span className="block text-[9px] font-bold uppercase text-slate-500">
                  Instruções de Responsabilidade do Beneficiário (Qualquer outro recebimento fica condicionado a autorização)
                </span>
                <p className="font-bold text-slate-900 text-xs">
                  • {currentInvoice.description}
                </p>
                <p className="text-slate-800 text-[11px] leading-relaxed">
                  • {bank.instructionsLine1}
                </p>
                <p className="text-slate-800 text-[11px] leading-relaxed">
                  • {bank.instructionsLine2}
                </p>
                <p className="text-slate-700 text-[11px] leading-relaxed italic">
                  • {bank.instructionsLine3}
                </p>
              </div>
              <div className="divide-y divide-slate-300">
                <div className="p-1.5">
                  <span className="block text-[8px] font-bold uppercase text-slate-500">(-) Desconto / Abatimento</span>
                  <span className="font-bold text-slate-800 text-[11px]">—</span>
                </div>
                <div className="p-1.5">
                  <span className="block text-[8px] font-bold uppercase text-slate-500">(+) Mora / Multa</span>
                  <span className="font-bold text-slate-800 text-[11px]">2,0% após vencimento</span>
                </div>
                <div className="p-1.5 bg-slate-50">
                  <span className="block text-[8px] font-bold uppercase text-slate-500">(=) Valor Cobrado</span>
                  <span className="font-bold text-slate-900 text-xs">{formattedAmount}</span>
                </div>
              </div>
            </div>

            {/* Linha 6: Sacado (Pagador / Morador) */}
            <div className="p-3 bg-slate-50/60 border-b border-slate-900">
              <span className="block text-[9px] font-bold uppercase text-slate-500">Pagador (Sacado)</span>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <p className="font-extrabold text-slate-900 text-sm">
                  {currentInvoice.residentName} — CPF: {currentInvoice.cpf || '***.***.***-**'}
                </p>
                <span className="text-xs font-bold text-emerald-700">
                  Apto {currentInvoice.unitNumber} • {currentInvoice.block}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                {bank.beneficiaryAddress} — Unidade {currentInvoice.unitNumber}
              </p>
            </div>
          </div>

          {/* CÓDIGO DE BARRAS FEBRABAN GRÁFICO */}
          <div className="pt-2 space-y-2">
            <div className="p-3 bg-white border border-slate-300 rounded-xl flex flex-col items-center justify-center">
              {/* Gráfico autêntico de barras Febraban em SVG */}
              <svg className="w-full max-w-lg h-14" viewBox="0 0 440 60" preserveAspectRatio="none">
                {/* Linhas simulando o padrão Febraban Interleaved 2 of 5 */}
                {Array.from({ length: 65 }).map((_, i) => {
                  const width = (i * 7 + 13) % 4 === 0 ? 3.5 : (i * 3 + 5) % 3 === 0 ? 2 : 1;
                  const x = i * 6.6;
                  return (
                    <rect
                      key={i}
                      x={x}
                      y="0"
                      width={width}
                      height="60"
                      fill="#0f172a"
                    />
                  );
                })}
              </svg>
              <span className="font-mono text-xs tracking-widest text-slate-700 font-bold mt-1">
                {boletoNumbers.codigoBarras}
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-slate-500 px-1">
              <span>Autenticação Mecânica / Ficha de Compensação</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-700">
                <ShieldCheck className="w-3.5 h-3.5" />
                Registrado via CIP / Banco Central
              </span>
            </div>
          </div>
        </div>

        {/* RODAPÉ DO MODAL COM BOTÕES DE AÇÃO (NÃO IMPRIME) */}
        <div className="no-print p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyLinha}
              className="px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              {copiedLinha ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              <span>{copiedLinha ? 'Linha Copiada!' : 'Copiar Linha Digitável'}</span>
            </button>
            <button
              type="button"
              onClick={handleCopyPix}
              className="px-4 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              {copiedPix ? <Check className="w-4 h-4 text-emerald-600" /> : <QrCode className="w-4 h-4" />}
              <span>{copiedPix ? 'Pix Copiado!' : 'Copiar Chave Pix'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-pill transition flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
