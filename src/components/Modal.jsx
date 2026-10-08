import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-md',
  preventCloseOnBackdrop = false,
  className = ''
}) {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape' && isOpen && !preventCloseOnBackdrop) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, preventCloseOnBackdrop, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !preventCloseOnBackdrop) {
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm transition-opacity"
      onClick={handleBackdropClick}
    >
      <div className={`bg-[var(--bg-surface)] rounded-xl shadow-2xl flex flex-col max-h-[90vh] text-[var(--text-main)] w-full ${maxWidth} ${className} overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-surface)] shrink-0 sticky top-0 z-10">
          <h2 className="text-lg font-bold truncate pr-4">{title}</h2>
          <button 
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-md hover:bg-[var(--bg-surface-hover)] focus:ring-2 focus:ring-[var(--cm-red)] focus:outline-none transition-colors"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5 text-[var(--text-muted)] hover:text-[var(--text-main)]" />
          </button>
        </div>
        
        {/* Contenido */}
        <div className="p-5 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
