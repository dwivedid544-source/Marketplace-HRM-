import React from 'react';
import { motion } from 'framer-motion';

const PageLoader = () => {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center">
        {/* Modern multi-circle loader */}
        <div className="relative w-16 h-16 mb-6">
          <motion.span 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
            className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary opacity-80"
          />
          <motion.span 
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            className="absolute inset-2 rounded-full border-4 border-transparent border-l-secondary border-b-secondary opacity-80"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
          </div>
        </div>
        
        <h2 className="text-sm font-black tracking-[0.2em] uppercase text-slate-800 bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary animate-pulse">
          Loading HR Pilot Pro
        </h2>
      </div>
    </div>
  );
};

export default PageLoader;
