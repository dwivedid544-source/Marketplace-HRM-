import React from 'react';
import { motion } from 'framer-motion';
import { Bot, User, Copy, Check, CheckCheck } from 'lucide-react';

export const ChatMessage = ({ msg, onCopy }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(msg.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (onCopy) onCopy();
  };

  const formatText = (text) => {
    const parts = text.split('\n').map((line, i) => {
      const boldParsed = line.split(/\*\*(.*?)\*\*/g).map((part, j) => {
        if (j % 2 === 1) return <strong key={j} className="text-slate-900 dark:text-white font-bold">{part}</strong>;
        return part;
      });
      return <React.Fragment key={i}>{boldParsed}{i !== text.split('\n').length - 1 && <br/>}</React.Fragment>;
    });
    return parts;
  };

  const isUser = msg.type === 'user';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} w-full group`}
    >
      <div className={`flex items-end gap-2 max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        
        {/* Avatar */}
        <div className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center shadow-sm border mb-1 ${
          isUser 
            ? 'bg-slate-100 border-slate-200 dark:bg-slate-700 dark:border-slate-600' 
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 border-indigo-400'
        }`}>
          {isUser ? <User size={14} className="text-slate-600 dark:text-slate-300" /> : <Bot size={14} className="text-white" />}
        </div>

        {/* Bubble */}
        <div className={`relative p-3.5 rounded-2xl shadow-sm text-[13px] leading-relaxed transition-all duration-300 ${
          isUser 
            ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-br-sm' 
            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-bl-sm hover:shadow-md'
        }`}>
          {formatText(msg.text)}
          
          {/* Action Buttons for Bot */}
          {!isUser && (
            <div className="absolute -right-10 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={handleCopy}
                className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-100 dark:border-slate-700 transition-colors"
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} className="text-emerald-500"/> : <Copy size={14} />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Metadata */}
      <div className={`flex items-center gap-1 mt-1.5 px-9 text-[9px] font-bold tracking-widest uppercase text-slate-400 dark:text-slate-500`}>
        <span>{msg.time}</span>
        {isUser && (
          <span className="ml-1">
            {msg.status === 'sending' ? <Check size={10} className="text-slate-300"/> : <CheckCheck size={10} className="text-indigo-500"/>}
          </span>
        )}
      </div>
    </motion.div>
  );
};
