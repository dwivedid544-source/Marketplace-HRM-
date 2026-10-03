import React from 'react';
import { Outlet } from 'react-router-dom';
import SuperAdminSidebar from '../components/SuperAdminSidebar';

const SuperAdminLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-50">
      <SuperAdminSidebar />
      <div className="flex-1 ml-64 flex flex-col min-h-screen transition-all duration-300">
        <div className="p-8 flex-1 w-full max-w-7xl mx-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
