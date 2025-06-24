import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, PlusCircle, Loader2 } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import Select from 'react-select';

interface Seat {
  id: number;
  seatNumber: string;
  branchId?: number;
  shifts: Array<{
    shiftId: number;
    shiftTitle: string;
    isAssigned: boolean;
    studentName: string | null;
  }>;
}

interface Schedule {
  id: number;
  title: string;
  description?: string | null;
  time: string;
  eventDate: string;
}

interface Branch {
  id: number;
  name: string;
}

interface SelectOption {
  value: number | null;
  label: string;
}

const SeatsPage: React.FC = () => {
  const [seats, setSeats] = useState<Seat[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newSeatNumbers, setNewSeatNumbers] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, navigate]);

  const fetchBranches = async () => {
    try {
      const branchesData = await api.getBranches();
      setBranches(branchesData);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load branches');
    }
  };

  const fetchSeats = async (retryCount = 0) => {
    const maxRetries = 2;
    try {
      setLoading(true);
      const params: { branchId?: number; shiftId?: number } = {};
      if (selectedBranchId) params.branchId = selectedBranchId;
      if (selectedShiftId) params.shiftId = selectedShiftId;
      const response = await api.getSeats(params);
      if (response.seats && Array.isArray(response.seats)) {
        setSeats(response.seats.sort((a, b) => parseInt(a.seatNumber) - parseInt(b.seatNumber)));
        setError(null);
      } else {
        throw new Error('Invalid data format from API');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch seats. Please try again.');
      if (retryCount < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
        await fetchSeats(retryCount + 1);
      } else {
        toast.error(err.message || 'Failed to fetch seats after multiple attempts');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchSchedules = async () => {
    try {
      const response = await api.getSchedules();
      if (response.schedules && Array.isArray(response.schedules)) {
        const sortedSchedules = response.schedules.sort((a: Schedule, b: Schedule) => {
          const dateComparison = a.eventDate.localeCompare(b.eventDate);
          if (dateComparison !== 0) return dateComparison;
          return a.time.localeCompare(b.time);
        });
        setSchedules(sortedSchedules);
      } else {
        throw new Error('Invalid schedules data format from API');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to fetch schedules');
    }
  };

  const handleAddSeats = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (!selectedBranchId) {
      toast.error('Please select a branch before adding seats');
      return;
    }
    if (!newSeatNumbers.trim()) {
      toast.error('Please enter at least one seat number');
      return;
    }
    setIsAdding(true);
    try {
      const response = await api.addSeats({ seatNumbers: newSeatNumbers, branchId: selectedBranchId });
      toast.success(response.message || 'Seats added successfully');
      setNewSeatNumbers('');
      await fetchSeats();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add seats');
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteSeat = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this seat?')) {
      try {
        const response = await api.deleteSeat(id);
        toast.success(response.message || 'Seat deleted successfully');
        await fetchSeats();
      } catch (err: any) {
        toast.error(err.message || 'Failed to delete seat');
      }
    }
  };

  const handleBranchChange = (option: SelectOption | null) => {
    setSelectedBranchId(option ? option.value : null);
  };

  const handleShiftChange = (option: SelectOption | null) => {
    setSelectedShiftId(option ? option.value : null);
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchBranches();
      fetchSeats();
      fetchSchedules();
    }
  }, [selectedBranchId, selectedShiftId, isAuthenticated]);

  const branchOptions: SelectOption[] = [
    { value: null, label: 'All Branches' },
    ...branches.map(branch => ({ value: branch.id, label: branch.name })),
  ];

  const shiftOptions: SelectOption[] = [
    { value: null, label: 'All Shifts' },
    ...schedules.map(schedule => ({
      value: schedule.id,
      label: `${schedule.title} (${schedule.time} on ${schedule.eventDate})`,
    })),
  ];

  if (authLoading) {
    return (
      <div className="flex min-h-screen justify-center items-center">
        <Loader2 size={24} className="animate-spin text-gray-500 dark:text-gray-400" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center">
                <button
                  onClick={() => navigate(-1)}
                  className="mr-4 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
                >
                  <ArrowLeft size={24} />
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
                  Seat Management
                </h1>
              </div>
            </div>

            <div className="mb-6 flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-1/3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Branch
                </label>
                <Select
                  options={branchOptions}
                  value={branchOptions.find(option => option.value === selectedBranchId) || null}
                  onChange={handleBranchChange}
                  placeholder="Select a branch"
                  className="w-full"
                />
              </div>
              <div className="w-full sm:w-1/3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Filter by Shift
                </label>
                <Select
                  options={shiftOptions}
                  value={shiftOptions.find(option => option.value === selectedShiftId) || null}
                  onChange={handleShiftChange}
                  placeholder="Select a shift"
                  className="w-full"
                />
              </div>
              <div className="w-full sm:w-1/3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Add New Seats (comma-separated)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSeatNumbers}
                    onChange={(e) => setNewSeatNumbers(e.target.value)}
                    placeholder="e.g., A1, A2, A3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
                  />
                  <button
                    onClick={handleAddSeats}
                    disabled={isAdding}
                    className="flex items-center bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:bg-purple-400 transition duration-200"
                  >
                    {isAdding ? (
                      <Loader2 size={20} className="animate-spin mr-2" />
                    ) : (
                      <PlusCircle size={20} className="mr-2" />
                    )}
                    Add
                  </button>
                </div>
              </div>
            </div>

            {loading && (
              <div className="flex justify-center">
                <Loader2 size={24} className="animate-spin text-gray-500 dark:text-gray-400" />
              </div>
            )}

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-4">
                {error}
              </div>
            )}

            {!loading && !error && seats.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400">
                No seats found for the selected branch or shift.
              </div>
            )}

            {!loading && !error && seats.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {seats.map((seat) => (
                  <div
                    key={seat.id}
                    className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
                  >
                    <div className="flex justify-between items-center mb-2">
                      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                        Seat {seat.seatNumber}
                      </h2>
                      <button
                        onClick={() => handleDeleteSeat(seat.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        title="Delete Seat"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {seat.shifts.map((shift) => (
                        <div
                          key={shift.shiftId}
                          className={`p-2 rounded-lg ${
                            shift.isAssigned
                              ? 'bg-red-50 text-red-600 dark:bg-red-900 dark:text-red-300'
                              : 'bg-green-50 text-green-600 dark:bg-green-900 dark:text-green-300'
                          }`}
                          title={
                            shift.isAssigned
                              ? `${shift.studentName || 'Unknown'}`
                              : 'Available'
                          }
                        >
                          {shift.shiftTitle} (
                          {schedules.find(s => s.id === shift.shiftId)?.description || 'N/A'})
                          {shift.isAssigned && shift.studentName
                            ? ` -${shift.studentName}`
                            : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatsPage;