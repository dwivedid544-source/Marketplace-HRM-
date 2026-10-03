import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../utils/axios';

export const useChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [hasUnread, setHasUnread] = useState(true);
  const [errorState, setErrorState] = useState(null);

  const location = useLocation();
  const { user } = useAuth(); // If no user, it returns null or undefined

  // Play a simple pop sound (if user interacts)
  const playSound = () => {
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU'); // tiny dummy sound
      audio.volume = 0.2;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio autoplay restrictions
    }
  };

  // Determine current role based on user object (or 'guest' if none)
  const getRoleContext = () => {
    if (!user) return 'guest';
    const r = user.role?.toLowerCase() || '';
    if (r === 'master admin' || r === 'masteradmin' || r === 'superadmin') return 'superadmin';
    if (r === 'admin' || r === 'hr' || r === 'hr admin') return 'admin';
    return 'employee';
  };

  const currentRole = getRoleContext();
  const userId = user?.id || 'guest';
  const storageKey = `nexus_chatbot_history_${currentRole}_${userId}`;

  // Load persistence (Keyed by role and user ID to avoid leaking histories)
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      setMessages(JSON.parse(saved));
    } else {
      let welcomeText = "Welcome to HRM Software! ✨ I'm your AI assistant. How can I help you today?";
      if (currentRole === 'superadmin') welcomeText = "Welcome back, SuperAdmin! I'm your Platform Assistant. I can help with tenant analytics, revenue, or plans.";
      if (currentRole === 'admin') welcomeText = "Welcome back! I'm your HR Assistant. Need help with payroll, attendance, or employees?";
      if (currentRole === 'employee') welcomeText = "Hello! I'm your Employee Assistant. I can help you check your attendance or salary.";

      const welcome = [{
        id: Date.now(),
        type: 'bot',
        text: welcomeText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered'
      }];
      setMessages(welcome);
    }
  }, [storageKey, currentRole]);

  // Save persistence
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, storageKey]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim()) return;

    setErrorState(null);

    const userMsg = {
      id: Date.now(),
      type: 'user',
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'sending' 
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    // Update user message to delivered immediately
    setTimeout(() => {
      setMessages(prev => prev.map(m => m.id === userMsg.id ? { ...m, status: 'delivered' } : m));
    }, 300);

    try {
      // Context Payload
      const contextPayload = {
        userRole: currentRole,
        currentPage: location.pathname,
        companyId: user?.company_id || null
      };

      // Format history (exclude the current message and map types to roles)
      const historyPayload = messages.map(m => ({
        role: m.type === 'user' ? 'user' : 'model',
        content: m.text
      }));

      // Ensure your backend runs at port 8081 and handles the /assistant route
      const response = await api.post('/assistant', {
        message: text,
        context: contextPayload,
        history: historyPayload
      });
      
      const aiResponseText = response.data.text || "I didn't quite catch that.";
      
      const botMsg = {
        id: Date.now() + 1,
        type: 'bot',
        text: aiResponseText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: 'delivered'
      };

      setIsTyping(false);
      setMessages(prev => [...prev, botMsg]);
      
      if (!isOpen) {
        setHasUnread(true);
        playSound();
      }
    } catch (error) {
      setIsTyping(false);
      let errorMsg = "Network error. Please try again.";
      if (error.response) {
        if (error.response.status === 429) {
          errorMsg = error.response.data?.error || "AI is busy. Please wait a moment and try again.";
        } else if (error.response.data?.error) {
          errorMsg = error.response.data.error;
        }
      }
      setErrorState({ message: errorMsg, lastAttempt: text });
    }
  }, [isOpen, currentRole, location.pathname, user]);

  const clearChat = () => {
    const welcomeText = currentRole === 'guest' 
      ? "Chat history cleared. How can I help you today?" 
      : `Chat history cleared. Ready to assist with ${currentRole} tasks.`;

    const welcome = [{
      id: Date.now(),
      type: 'bot',
      text: welcomeText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: 'delivered'
    }];
    setMessages(welcome);
    setErrorState(null);
  };

  const toggleOpen = () => {
    setIsOpen(!isOpen);
    if (!isOpen) setHasUnread(false);
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
  };

  return {
    messages,
    isTyping,
    isOpen,
    isMaximized,
    hasUnread,
    errorState,
    sendMessage,
    clearChat,
    toggleOpen,
    toggleMaximize,
    setErrorState,
    currentRole // expose to UI
  };
};
