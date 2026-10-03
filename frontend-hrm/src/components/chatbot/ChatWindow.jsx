import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Bot, Sparkles, RefreshCcw, ChevronDown, Maximize2, Minimize2, AlertCircle } from 'lucide-react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';

export const ChatWindow = ({ 
  isOpen, 
  messages, 
  isTyping, 
  errorState,
  isMaximized,
  toggleOpen,
  toggleMaximize,
  clearChat,
  sendMessage,
  setErrorState,
  currentRole
}) => {
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);
  const dragControls = useDragControls();
  const [dragConstraints, setDragConstraints] = useState({ left: 0, right: 0, top: 0, bottom: 0 });

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      const timer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 300); // Wait for framer-motion animation
      return () => clearTimeout(timer);
    }
  }, [messages, isTyping, errorState, isOpen]);

  useEffect(() => {
    const handleResize = () => {
      const chatHeight = 650;
      const bottomOffset = 96; // sm:bottom-24 is 96px
      const chatWidth = 380;
      const rightOffset = 24;  // sm:right-6 is 24px

      const maxDragUp = window.innerHeight - bottomOffset - chatHeight;
      const maxDragLeft = window.innerWidth - rightOffset - chatWidth;

      setDragConstraints({
        left: -Math.max(0, maxDragLeft),
        right: 0,
        top: -Math.max(0, maxDragUp),
        bottom: 0
      });
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSend = (text = inputValue) => {
    if (!text.trim()) return;
    sendMessage(text);
    setInputValue('');
  };

  // Dynamic Context UI Data
  let assistantName = "HRM AI";
  let quickReplies = [];

  if (currentRole === 'superadmin') {
    assistantName = "Platform Assistant";
    quickReplies = [
      "Platform Overview Stats",
      "List Registered Companies",
      "Pending Plan Requests",
      "Available Subscription Plans",
      "Total Platform Revenue"
    ];
  } else if (currentRole === 'admin') {
    assistantName = "HR Assistant";
    quickReplies = [
      "Who is absent today?",
      "Present Today Count",
      "Today Attendance Summary",
      "Pending Leave Requests",
      "Payroll Overview",
      "Total Employees Count",
      "Pending Expense Claims",
      "Top KPI Leaders",
      "Company Info & Settings"
    ];
  } else if (currentRole === 'employee') {
    assistantName = "Employee Assistant";
    quickReplies = [
      "Am I checked out today?",
      "What time did I check in?",
      "My Attendance Summary",
      "My Salary Accrual",
      "My Leave Balances",
      "My Profile Info",
      "My Expense Claims",
      "My KPI Score",
      "Company Holidays"
    ];
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          drag={!isMaximized}
          dragListener={false}
          dragControls={dragControls}
          dragMomentum={false}
          dragElastic={0.1}
          dragConstraints={dragConstraints}
          style={isMaximized ? { x: 0, y: 0 } : {}}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={`bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] border border-white/50 dark:border-slate-700/50 flex flex-col overflow-hidden origin-bottom sm:origin-bottom-right transition-shadow duration-300 z-[110]
            ${isMaximized 
              ? 'w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] fixed right-4 bottom-4 rounded-3xl' 
              : 'fixed top-4 bottom-4 left-4 right-4 w-auto h-auto rounded-3xl sm:fixed sm:bottom-24 sm:right-6 sm:left-auto sm:top-auto sm:w-[380px] sm:h-[650px] sm:max-h-[calc(100vh-8rem)] sm:rounded-3xl'
            }
          `}
        >
          {/* Header */}
          <div 
            onPointerDown={(e) => {
              // Start drag only if we aren't clicking a button or its child
              if (!e.target.closest('button')) {
                dragControls.start(e);
              }
            }}
            className={`bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 p-5 text-white shrink-0 relative overflow-hidden shadow-md select-none ${
              !isMaximized ? 'cursor-grab active:cursor-grabbing' : ''
            }`}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>
            <div className="flex justify-between items-start relative z-10">
              <div className="flex gap-4 items-center">
                <div className="relative">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
                    <Bot size={26} className="text-white drop-shadow-sm" />
                  </div>
                  <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-400 border-2 border-indigo-700 rounded-full"></span>
                </div>
                <div>
                  <h3 className="font-black text-base tracking-wide flex items-center gap-1.5">
                    {assistantName} <Sparkles size={14} className="text-amber-300"/>
                  </h3>
                  <p className="text-[10px] text-indigo-100 font-bold tracking-widest uppercase mt-1">Context Aware</p>
                </div>
              </div>
              <div className="flex gap-1 bg-white/10 p-1 rounded-xl backdrop-blur-sm border border-white/10">
                <button onClick={clearChat} className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors" title="Clear Chat">
                  <RefreshCcw size={16} />
                </button>
                <button onClick={toggleMaximize} className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors hidden sm:block" title="Maximize">
                  {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button onClick={toggleOpen} className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors" title="Close">
                  <ChevronDown size={16} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-6 bg-slate-50/50 dark:bg-slate-900/50 custom-scrollbar relative">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}

            {isTyping && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex items-end gap-2 max-w-[85%]">
                <div className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-indigo-400 shadow-sm mb-1">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="px-5 py-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl rounded-bl-sm shadow-sm flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }}></div>
                  <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                </div>
              </motion.div>
            )}

            {errorState && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-4 gap-2">
                <div className="flex items-center gap-2 text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-4 py-2 rounded-xl text-xs font-bold border border-rose-100 dark:border-rose-500/20">
                  <AlertCircle size={14} /> {errorState.message}
                </div>
                <button 
                  onClick={() => handleSend(errorState.lastAttempt)}
                  className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-indigo-600 underline underline-offset-2"
                >
                  Retry Message
                </button>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          {!isTyping && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="px-4 py-1.5 bg-white dark:bg-slate-900 flex gap-1.5 overflow-x-auto no-scrollbar border-t border-slate-50 dark:border-slate-800/50 shrink-0 relative z-10"
            >
              {quickReplies.map((reply, i) => (
                <button 
                  key={i} 
                  onClick={() => handleSend(reply)}
                  className="whitespace-nowrap px-2.5 py-1 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-[9px] font-semibold uppercase tracking-wider rounded-full border border-indigo-200/50 dark:border-indigo-500/20 transition-all hover:scale-105 active:scale-95"
                >
                  {reply}
                </button>
              ))}
            </motion.div>
          )}

          {/* Input Area */}
          <ChatInput 
            inputValue={inputValue} 
            setInputValue={setInputValue} 
            handleSend={handleSend} 
            isTyping={isTyping} 
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
