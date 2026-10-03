import React, { useEffect, useState, useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const Counter = ({ end, duration = 2, suffix = '' }) => {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });

  useEffect(() => {
    let start = 0;
    const increment = end / (duration * 60); // Assuming 60 FPS
    let timer;

    if (inView) {
      timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          clearInterval(timer);
          setCount(end);
        } else {
          setCount(Math.ceil(start));
        }
      }, 1000 / 60);
    }
    return () => clearInterval(timer);
  }, [end, duration, inView]);

  return (
    <span ref={ref}>
      {count}{suffix}
    </span>
  );
};

const StatisticsSection = () => {
  const stats = [
    { label: 'Companies', value: 500, suffix: '+' },
    { label: 'Employees Managed', value: 50, suffix: 'K+' },
    { label: 'Uptime', value: 99.9, suffix: '%' },
    { label: 'Support', value: 24, suffix: '/7' },
  ];

  return (
    <section className="py-20 relative overflow-hidden z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-10">
          {stats.map((stat, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1, duration: 0.6 }}
              className="glass-card-dark p-8 flex flex-col items-center justify-center text-center group hover:-translate-y-2 transition-transform duration-300"
            >
              <div className="text-4xl md:text-5xl font-heading font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-primary-light to-accent-light mb-3 tracking-tight group-hover:drop-shadow-[0_0_15px_rgba(96,165,250,0.5)] transition-all">
                <Counter end={stat.value} suffix={stat.suffix} />
              </div>
              <div className="text-xs md:text-sm text-slate-400 font-bold uppercase tracking-widest">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
      
      {/* Subtle Glows */}
      <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-[100px] -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-accent/10 rounded-full blur-[100px] -translate-y-1/2 pointer-events-none"></div>
    </section>
  );
};

export default StatisticsSection;
