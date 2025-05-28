import React, { useState } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Sidebar from '../components/Sidebar';
import api from '../services/api';

const ProfitLoss: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [data, setData] = useState<any>(null);

  const handleFetch = async () => {
    try {
      const response = await api.getProfitLoss(month);
      setData(response);
    } catch (error) {
      console.error('Failed to fetch profit/loss:', error);
      toast.error('Failed to load profit/loss data');
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#fef9f6]">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <motion.div
          className="max-w-3xl mx-auto"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.h1
            className="text-2xl md:text-3xl font-bold mb-6 text-gray-800 flex items-center gap-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            📈 Profit & Loss
          </motion.h1>

          <motion.div
            className="bg-white rounded-lg shadow p-6 mb-6"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
          >
            <label
              htmlFor="month"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select Month
            </label>
            <input
              type="month"
              id="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <button
              onClick={handleFetch}
              className="w-full sm:w-auto bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition"
            >
              Fetch Report
            </button>
          </motion.div>

          {data && (
            <motion.div
              className="bg-white p-6 rounded-lg shadow"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
            >
              <h2 className="text-lg font-semibold mb-4 text-gray-800">
                Financial Summary for {data.month}
              </h2>
              <div className="space-y-2 text-sm sm:text-base">
                <p>Total Collected: <span className="font-semibold">{data.totalCollected.toFixed(2)}</span></p>
                <p>Total Expenses: <span className="font-semibold">{data.totalExpenses.toFixed(2)}</span></p>
                <p
                  className={`font-semibold ${
                    data.profitLoss >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {data.profitLoss >= 0 ? 'Profit' : 'Loss'}: {Math.abs(data.profitLoss).toFixed(2)}
                </p>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default ProfitLoss;
