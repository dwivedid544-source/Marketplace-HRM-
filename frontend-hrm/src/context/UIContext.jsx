import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

const UIContext = createContext();

export const useUI = () => useContext(UIContext);

export const UIProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);

  // === TOAST SYSTEM ===
  const showAlert = useCallback((message, type = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    window.globalShowAlert = showAlert;
    return () => {
      delete window.globalShowAlert;
    };
  }, [showAlert]);

  // === CONFIRM DIALOG SYSTEM ===
  const showConfirm = useCallback(({ title = 'Are you sure?', message, confirmText = 'Confirm', cancelText = 'Cancel', type = 'warning' }) => {
    return new Promise((resolve) => {
      setConfirmDialog({
        title,
        message,
        confirmText,
        cancelText,
        type,
        onConfirm: () => {
          setConfirmDialog(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmDialog(null);
          resolve(false);
        }
      });
    });
  }, []);

  return (
    <UIContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      
      {/* GLOBAL TOAST RENDERER */}
      <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
              className="pointer-events-auto flex items-center gap-3 bg-white p-4 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100 min-w-[300px] overflow-hidden relative"
            >
              {/* Colored Side Bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                toast.type === 'success' ? 'bg-emerald-500' :
                toast.type === 'error' ? 'bg-rose-500' :
                toast.type === 'warning' ? 'bg-amber-500' : 'bg-primary'
              }`} />
              
              <div className={`p-2 rounded-xl ${
                toast.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                toast.type === 'error' ? 'bg-rose-50 text-rose-600' :
                toast.type === 'warning' ? 'bg-amber-50 text-amber-600' : 'bg-primary/10 text-primary'
              }`}>
                {toast.type === 'success' && <CheckCircle2 size={20} />}
                {toast.type === 'error' && <AlertCircle size={20} />}
                {toast.type === 'warning' && <AlertTriangle size={20} />}
                {toast.type === 'info' && <Info size={20} />}
              </div>
              
              <div className="flex-1 pr-4">
                <p className="text-sm font-bold text-slate-800">{toast.message}</p>
              </div>

              <button 
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={16} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* GLOBAL CONFIRM DIALOG RENDERER */}
      <AnimatePresence>
        {confirmDialog && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={confirmDialog.onCancel}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl p-5 md:p-6 w-full mx-4 relative z-10 overflow-hidden"
              style={{ maxWidth: '400px' }}
            >
              <div className={`absolute -top-16 -right-16 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none ${
                confirmDialog.type === 'danger' || confirmDialog.type === 'warning' ? 'bg-rose-500' : 'bg-primary'
              }`} />
              
              <div className="flex items-start gap-5">
                <div className={`shrink-0 p-3 rounded-2xl ${
                  confirmDialog.type === 'danger' || confirmDialog.type === 'warning' 
                    ? 'bg-rose-50 text-rose-500' 
                    : 'bg-primary/10 text-primary'
                }`}>
                  {confirmDialog.type === 'danger' || confirmDialog.type === 'warning' 
                    ? <AlertTriangle size={24} /> 
                    : <Info size={24} />
                  }
                </div>
                
                <div className="pt-2">
                  <h3 className="text-lg font-black text-slate-800 mb-1 tracking-tight">{confirmDialog.title}</h3>
                  <p className="text-[13px] font-medium text-slate-500 leading-relaxed">{confirmDialog.message}</p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6">
                <button
                  onClick={confirmDialog.onCancel}
                  className="px-5 py-2 rounded-xl text-[13px] font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  {confirmDialog.cancelText}
                </button>
                <button
                  onClick={confirmDialog.onConfirm}
                  className={`px-5 py-2 rounded-xl text-[13px] font-bold text-white shadow-lg transition-all active:scale-95 ${
                    confirmDialog.type === 'danger' || confirmDialog.type === 'warning'
                      ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-500/25'
                      : 'bg-primary hover:bg-primary-dark shadow-primary/25'
                  }`}
                >
                  {confirmDialog.confirmText}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </UIContext.Provider>
  );
};
