import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

export const ChatInput = ({ inputValue, setInputValue, handleSend, isTyping }) => {
  const textareaRef = useRef(null);

  // Auto-expand textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 shrink-0 sticky bottom-0">
      <div className="relative flex items-end gap-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-1.5 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all shadow-sm">

        {/* Auto-expanding Textarea */}
        <textarea
          ref={textareaRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Type your message..."
          className="w-full min-h-[44px] max-h-[120px] bg-transparent border-none focus:ring-0 resize-none px-1 py-3 text-sm text-slate-700 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-500 custom-scrollbar"
          rows={1}
          disabled={isTyping}
        />
        
        {/* Send Button */}
        <button 
          onClick={() => handleSend()}
          disabled={!inputValue.trim() || isTyping}
          className="p-3 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-xl hover:shadow-lg hover:shadow-indigo-500/30 disabled:opacity-50 disabled:hover:shadow-none transition-all shrink-0 mb-[2px] mr-[2px]"
          title="Send (Enter)"
        >
          <Send size={16} className={inputValue.trim() ? "translate-x-0.5 -translate-y-0.5 transition-transform" : ""} />
        </button>
      </div>
    </div>
  );
};
