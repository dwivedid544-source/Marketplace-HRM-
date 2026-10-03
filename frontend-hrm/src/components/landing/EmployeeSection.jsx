import React from 'react';
import { motion } from 'framer-motion';

const EmployeeSection = () => (
  <section className="py-16 bg-gray-50" id="employee">
    <motion.div
      className="max-w-6xl mx-auto px-4 text-center"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h2 className="text-3xl font-bold text-gray-900 mb-4">Employee Management Hub</h2>
      <p className="text-gray-600 mb-8">Onboard, manage profiles, assign roles, and track performance with ease.</p>
      <div className="w-full h-48 bg-gray-200 rounded-lg shadow-inner"></div>
    </motion.div>
  </section>
);

export default EmployeeSection;
