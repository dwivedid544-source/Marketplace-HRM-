import React from 'react';
import { motion } from 'framer-motion';

const companies = [
  "Microsoft", "Google", "Amazon", "Meta", "Netflix", "Apple", "Stripe", "Airbnb", "Uber", "Spotify"
];

const TrustedCompanies = () => {
  return (
    <section className="py-10 border-y border-white/5 bg-navy-dark/50 backdrop-blur-sm overflow-hidden relative z-20">
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-navy-dark to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-navy-dark to-transparent z-10 pointer-events-none"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-6">
        <p className="text-center text-sm font-semibold text-slate-500 uppercase tracking-widest">
          Trusted by innovative teams worldwide
        </p>
      </div>

      <div className="flex w-[200%]">
        <motion.div
          className="flex whitespace-nowrap gap-16 items-center px-8"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ ease: "linear", duration: 30, repeat: Infinity }}
        >
          {/* Double array for infinite scroll effect */}
          {[...companies, ...companies].map((company, index) => (
            <div key={index} className="text-2xl md:text-3xl font-heading font-bold text-white/20 hover:text-white/60 transition-colors duration-300">
              {company}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default TrustedCompanies;
