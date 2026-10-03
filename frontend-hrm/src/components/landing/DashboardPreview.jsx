import React from 'react';

const DashboardPreview = () => {
  return (
    <div className="relative mx-auto rounded-3xl p-[2px] bg-gradient-to-b from-primary/50 via-accent/20 to-navy-dark shadow-[0_0_40px_rgba(37,99,235,0.25)] group">
      <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent rounded-3xl pointer-events-none"></div>
      
      {/* Browser Chrome / Inner container with top area cropped */}
      <div className="relative rounded-[22px] overflow-hidden bg-navy-dark border border-white/5 shadow-inner flex flex-col group-hover:-translate-y-1.5 transition-transform duration-500">
        <img 
          src="/dashboard-mockup.png" 
          alt="HRM Attendance Dashboard Mockup" 
          className="w-full h-auto object-cover border-none -mt-[9%] -mb-[1%] scale-[1.01]"
        />
        {/* Subtle overlay for blending */}
        <div className="absolute inset-0 bg-gradient-to-t from-navy-dark/40 to-transparent pointer-events-none mix-blend-overlay"></div>
      </div>
    </div>
  );
};

export default DashboardPreview;
