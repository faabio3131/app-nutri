"use client";

import { useEffect, useRef } from 'react';

// Janela sobreposta acessível: fecha com Esc ou clique fora, prende o foco e devolve o foco ao fechar.
export default function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || []).filter((e) => !e.hasAttribute('disabled'));
    (focusables()[0] || root)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 px-0" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}
        className="w-full max-w-[430px] max-h-[92vh] overflow-y-auto rounded-t-3xl bg-[#0E131F] border border-cyan-500/30 border-b-0 p-5 pb-7 shadow-2xl focus:outline-none">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-black text-white">{title}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-gray-400 hover:text-white text-lg leading-none px-2 py-1">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
