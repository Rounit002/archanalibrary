import React from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import ExpiringMemberships from '../components/ExpiringMemberships';

const ExpiringMembershipsPage = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Expiring Memberships</h1>
              <p className="text-gray-500">View all memberships expiring soon</p>
            </div>
            <ExpiringMemberships />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExpiringMembershipsPage;