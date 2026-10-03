import React from 'react';
import Navbar from '../../components/landing/Navbar';
import Hero from '../../components/landing/Hero';
import FeaturesSection from '../../components/landing/FeaturesSection';
import PricingSection from '../../components/landing/PricingSection';
import TestimonialSlider from '../../components/landing/TestimonialSlider';
import StatisticsSection from '../../components/landing/StatisticsSection';
import FAQAccordion from '../../components/landing/FAQAccordion';
import CTASection from '../../components/landing/CTASection';
import Footer from '../../components/landing/Footer';


const LandingPage = () => {
  return (
    <div className="flex flex-col min-h-screen bg-landing-gradient font-sans text-slate-300 selection:bg-primary/30 selection:text-white relative overflow-hidden">
      {/* Background Glow Effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[150px] pointer-events-none"></div>
      
      <Navbar />
      <main className="flex-grow z-10 relative">
        <Hero />
        <StatisticsSection />
        <FeaturesSection />
        <CTASection />
        <PricingSection />
        <TestimonialSlider />
        <FAQAccordion />
      </main>
      <Footer />
    </div>
  );
};

export default LandingPage;
