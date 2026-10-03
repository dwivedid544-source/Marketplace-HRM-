import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Star, CheckCircle2, Sparkles, Quote } from 'lucide-react';

const realReviews = [
  {
    id: 1,
    name: 'truman42lewis',
    country: 'United States',
    flag: '🇺🇸',
    rating: 5,
    project: 'Full Stack Web Applications',
    review: "Kiaan And His Team are truly professional and I'm honored to work with them. They have delivered our agency a state of the art software! Thank you 🙏",
    avatarBg: 'from-blue-500 to-indigo-600',
    initial: 'T'
  },
  {
    id: 2,
    name: 'hillfamilybiz',
    country: 'United States',
    flag: '🇺🇸',
    rating: 5,
    project: 'Full Stack Web Applications',
    review: "Did a wonderful job! It's a long term project. They understand concept and vision. Will continue to work with them to complete full scope.",
    avatarBg: 'from-violet-500 to-purple-600',
    initial: 'H'
  },
  {
    id: 3,
    name: 'Immanuelpaul832',
    country: 'Jamaica',
    flag: '🇯🇲',
    rating: 5,
    project: 'Full Stack Web Applications',
    review: "As a returning customer, I highly recommend Kiaan Paras. She consistently delivers exceptional quality, professionalism, and attention to detail. Outstanding work every time—truly deserving of a 5-star rating!",
    avatarBg: 'from-emerald-500 to-teal-600',
    initial: 'I'
  },
  {
    id: 4,
    name: 'pop1010',
    country: 'United States',
    flag: '🇺🇸',
    rating: 5,
    project: 'Full Stack Web Applications',
    review: "Best developer ever, always listening and make adjustments to every bugs and respond to messages every seconds.",
    avatarBg: 'from-amber-500 to-orange-600',
    initial: 'P'
  },
  {
    id: 5,
    name: 'Jjbraim',
    country: 'United States',
    flag: '🇺🇸',
    rating: 5,
    project: 'Full Stack Web Applications',
    review: "She is exceptionally diligent, professional, and committed to delivering high-quality work. She understands the assignment thoroughly and pays close attention to every detail. Her communication was outstanding, clear, timely, professional, and respectful.",
    avatarBg: 'from-rose-500 to-pink-600',
    initial: 'J'
  }
];

// Duplicate for continuous seamless marquee loop
const duplicatedReviews = [...realReviews, ...realReviews, ...realReviews, ...realReviews];

const TestimonialSlider = () => {
  return (
    <section id="testimonials" className="pt-8 pb-14 relative overflow-hidden z-20">
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-96 h-48 bg-primary/10 rounded-full blur-[110px] pointer-events-none"></div>

      {/* Embedded CSS for smooth continuous pause-in-place marquee */}
      <style>{`
        @keyframes marqueeScroll {
          0% { transform: translateX(0%); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-smooth {
          animation: marqueeScroll 36s linear infinite;
        }
        .marquee-wrapper:hover .animate-marquee-smooth {
          animation-play-state: paused;
        }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Compact Clean Header */}
        <div className="text-center max-w-3xl mx-auto mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-primary-light text-[11px] font-bold tracking-wider uppercase mb-2.5 backdrop-blur-md">
            <Sparkles size={11} className="text-primary-light" />
            CUSTOMER SUCCESS
          </div>
          <h3 className="text-3xl sm:text-4xl lg:text-5xl font-heading font-extrabold text-white tracking-tight leading-tight">
            Trusted By <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-light via-teal-300 to-secondary">Businesses Worldwide</span>
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 mt-2">
            Real feedback from clients who trusted Kiaan Technology.
          </p>
        </div>

        {/* 3-Column Infinite Continuous Scrolling Marquee */}
        <div className="relative w-full overflow-hidden marquee-wrapper select-none">
          {/* Left & Right Gradient Fade Edges for Modern SaaS Look */}
          <div className="absolute left-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-r from-landing-gradient via-landing-gradient/80 to-transparent z-20 pointer-events-none"></div>
          <div className="absolute right-0 top-0 bottom-0 w-12 sm:w-24 bg-gradient-to-l from-landing-gradient via-landing-gradient/80 to-transparent z-20 pointer-events-none"></div>

          {/* Marquee Animation Track with CSS animation */}
          <div className="flex gap-5 w-max py-2 animate-marquee-smooth">
            {duplicatedReviews.map((rev, index) => (
              <div
                key={index}
                className="w-[290px] sm:w-[340px] md:w-[370px] rounded-2xl bg-navy-dark/75 border border-white/10 hover:border-primary/40 backdrop-blur-xl p-5 sm:p-6 shadow-lg hover:shadow-[0_10px_30px_rgba(37,99,235,0.15)] hover:-translate-y-1 transition-all duration-300 flex flex-col justify-between shrink-0 relative overflow-hidden"
              >
                {/* Subtle Quote Watermark */}
                <Quote size={60} className="absolute -top-2 -right-2 text-white/[0.03] rotate-12 pointer-events-none" />

                <div>
                  {/* Top: 5 Stars + Project Badge */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-1 text-yellow-400">
                      {[...Array(rev.rating)].map((_, i) => (
                        <Star key={i} size={13} className="fill-yellow-400" />
                      ))}
                    </div>
                    <span className="text-[9px] font-bold text-primary-light bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full truncate max-w-[150px]">
                      {rev.project}
                    </span>
                  </div>

                  {/* Review Quote Text */}
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-normal mb-5 line-clamp-4">
                    "{rev.review}"
                  </p>
                </div>

                {/* Bottom: Client Profile & Verified Badge */}
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-white/[0.07] mt-auto">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-full bg-gradient-to-br ${rev.avatarBg} flex items-center justify-center text-white font-bold text-[11px] shrink-0 shadow-sm`}>
                      {rev.initial}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-white truncate">{rev.name}</h4>
                      <p className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span>{rev.flag}</span>
                        <span className="truncate">{rev.country}</span>
                      </p>
                    </div>
                  </div>

                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1 shrink-0 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                    <CheckCircle2 size={10} /> Verified
                  </span>
                </div>

              </div>
            ))}
          </div>
        </div>

        {/* Small subtitle indicator */}
        <div className="text-center mt-6">
          <p className="text-[11px] text-slate-400 font-medium">
            ✨ Hover to pause • Continuously updated verified client reviews
          </p>
        </div>

      </div>
    </section>
  );
};

export default TestimonialSlider;
