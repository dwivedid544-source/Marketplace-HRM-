import React from 'react';
import { motion } from 'framer-motion';

const AnalyticsSection = () => (
  <section className="py-16 bg-white" id="analytics">
    <motion.div
      className="max-w-6xl mx-auto px-4 text-center"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Analytics & Insights</h2>
      <p className="text-gray-600 mb-8">Visualize attendance trends, payroll costs, and employee performance with interactive dashboards.</p>
      <div className="w-full h-64 bg-gray-200 rounded-lg shadow-inner"></div>
    </motion.div>
  </section>
);

export default AnalyticsSection;
