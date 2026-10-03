import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, X, Send, Bot, User, Sparkles } from 'lucide-react';
import { useSiteInfo } from '../../context/SiteInfoContext';

const LiveChatWidget = () => {
  const { siteInfo } = useSiteInfo();
  const displayName = siteInfo.company_name || siteInfo.platform_name || 'HRM Software Pro';

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, type: 'bot', text: `Hi there! 👋 Welcome to ${displayName}.` },
    { id: 2, type: 'bot', text: 'I\'m your AI assistant. How can I help you today? You can ask me about pricing, features, or setting up a demo.' },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Add user message
    const newUserMsg = { id: Date.now(), type: 'user', text: inputValue };
    setMessages(prev => [...prev, newUserMsg]);
    setInputValue('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      setIsTyping(false);
      setMessages(prev => [
        ...prev, 
        { 
          id: Date.now(), 
          type: 'bot', 
          text: 'Thanks for reaching out! Our team will connect with you shortly. In the meantime, feel free to explore our platform features by logging into the admin demo dashboard.' 
        }
      ]);
    }, 1500);
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: isOpen ? 0 : 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full shadow-[0_0_20px_rgba(37,99,235,0.6)] flex items-center justify-center text-white z-50 transition-shadow hover:shadow-[0_0_30px_rgba(139,92,246,0.8)] ${isOpen ? 'pointer-events-none' : ''}`}
      >
        <MessageSquare size={28} />
        {/* Unread badge indicator */}
        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 border-2 border-navy-dark rounded-full animate-pulse shadow-lg"></span>
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, originX: 1, originY: 1 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="fixed bottom-6 right-6 w-[350px] sm:w-[400px] h-[600px] max-h-[85vh] bg-navy-dark/95 backdrop-blur-xl rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] flex flex-col z-50 overflow-hidden border border-white/10"
          >
            {/* Header */}
            <div className="bg-white/5 border-b border-white/10 p-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-lg">
                    <Bot size={22} className="text-white" />
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-navy-dark rounded-full shadow-[0_0_5px_rgba(16,185,129,0.5)]"></div>
                </div>
                <div>
                  <h3 className="text-white font-heading font-semibold tracking-wide">HRM AI Assistant</h3>
                  <p className="text-primary-light text-xs flex items-center gap-1 font-medium">
                    <Sparkles size={12} /> Typically replies instantly
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-white hover:bg-white/10 rounded-full p-2 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar relative">
              {/* Background gradient subtle glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-primary/5 rounded-full blur-[80px] pointer-events-none"></div>

              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'} relative z-10`}
                >
                  <div className={`max-w-[80%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                    msg.type === 'user' 
                      ? 'bg-gradient-to-r from-primary to-primary-dark text-white rounded-br-sm shadow-[0_5px_15px_rgba(37,99,235,0.2)]' 
                      : 'bg-white/5 backdrop-blur-md border border-white/10 text-slate-200 rounded-bl-sm shadow-glass'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start relative z-10">
                  <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl rounded-bl-sm shadow-glass p-4 flex gap-1.5 items-center">
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-2 h-2 bg-primary-light rounded-full"></motion.div>
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-2 h-2 bg-primary-light rounded-full"></motion.div>
                    <motion.div animate={{ y: [0, -5, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-2 h-2 bg-primary-light rounded-full"></motion.div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 bg-navy-light/50 border-t border-white/10 shrink-0 backdrop-blur-md">
              <form onSubmit={handleSendMessage} className="flex items-center gap-2 relative">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Type your message..."
                  className="flex-1 bg-white/5 border border-white/10 text-white placeholder-slate-400 rounded-full pl-4 pr-12 py-3.5 text-sm focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-colors shadow-inner"
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="absolute right-2 w-9 h-9 bg-primary text-white rounded-full flex items-center justify-center disabled:opacity-50 disabled:bg-white/10 disabled:text-slate-500 hover:bg-primary-dark transition-colors shadow-[0_0_10px_rgba(37,99,235,0.3)] disabled:shadow-none"
                >
                  <Send size={16} className="ml-0.5" />
                </button>
              </form>
              <div className="text-center mt-3">
                <span className="text-[10px] text-slate-500 font-medium">Powered by <span className="text-primary-light">HRM AI Chat</span></span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default LiveChatWidget;
