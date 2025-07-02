import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api, { Branch } from '../services/api';
import { Search, ChevronLeft, ChevronRight, Trash2, Eye, ArrowUp, ArrowDown, Play } from 'lucide-react'; // Added Play icon
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'; // For modal
import { Button } from '@/components/ui/button'; // For button styling

// Define the Student type for the frontend, matching the expected structure
interface Student {
  id: number;
  name: string;
  phone: string;
  membershipEnd: string;
  createdAt: string;
  status: 'active' | 'expired' | 'deactivated'; // Updated status type
  seatNumber?: string | null;
}

// Utility function to format date toYYYY-MM-DD
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch (error) {
    console.error('Invalid date string:', dateString, error);
    return 'N/A';
  }
};

const InactiveStudents = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [studentsPerPage, setStudentsPerPage] = useState(10);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const navigate = useNavigate();

  const [isActivateModalOpen, setIsActivateModalOpen] = useState(false);
  const [selectedStudentToActivate, setSelectedStudentToActivate] = useState<Student | null>(null);
  const [newMembershipStart, setNewMembershipStart] = useState('');
  const [newMembershipEnd, setNewMembershipEnd] = useState('');
  const [newSeatId, setNewSeatId] = useState<number | null>(null);
  const [newShiftIds, setNewShiftIds] = useState<number[]>([]);

  // Dummy data for seats and shifts for the modal (replace with actual API calls if needed)
  const [availableSeats, setAvailableSeats] = useState<{ id: number; seat_number: string }[]>([]);
  const [availableShifts, setAvailableShifts] = useState<{ id: number; title: string }[]>([]);

  // Fetch branches on mount
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const fetchedBranches = await api.getBranches();
        setBranches(fetchedBranches);
      } catch (error: any) {
        console.error('Failed to fetch branches:', error.message);
        toast.error('Failed to fetch branches');
      }
    };
    fetchBranches();
  }, []);

  // Fetch inactive students whenever selectedBranchId, fromDate, or toDate changes
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await api.getStudents(fromDate || undefined, toDate || undefined, selectedBranchId);
        const updatedStudents = response.students.map((student: any) => {
          const membershipEndDate = student.membershipEnd ? new Date(student.membershipEnd) : null;
          const currentDate = new Date();
          const isExpired = membershipEndDate && membershipEndDate < currentDate;
          return {
            ...student,
            status: student.status === 'deactivated' ? 'deactivated' : (isExpired ? 'expired' : student.status),
            createdAt: student.createdAt || 'N/A',
          };
        }).filter(student => student.status === 'deactivated'); // Filter for 'deactivated'
        setStudents(updatedStudents);
        setLoading(false);
      } catch (error: any) {
        console.error('Failed to fetch students:', error.message);
        toast.error('Failed to fetch students');
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedBranchId, fromDate, toDate]);

  // Fetch available seats and shifts when the modal opens or a student is selected
  useEffect(() => {
    if (isActivateModalOpen && selectedStudentToActivate) {
      const fetchSeatsAndShifts = async () => {
        try {
          // Assuming you have API endpoints for seats and shifts,
          // for now, using dummy data. Replace with actual calls:
          // const seatsResponse = await api.getSeats(selectedStudentToActivate.branchId);
          // const shiftsResponse = await api.getShifts(selectedStudentToActivate.branchId);
          // setAvailableSeats(seatsResponse.seats);
          // setAvailableShifts(shiftsResponse.shifts);

          // Dummy data for demonstration
          setAvailableSeats([
            { id: 1, seat_number: 'A1' },
            { id: 2, seat_number: 'B2' },
            { id: 3, seat_number: 'C3' },
          ]);
          setAvailableShifts([
            { id: 101, title: 'Morning (6-9 AM)' },
            { id: 102, title: 'Day (9 AM - 5 PM)' },
            { id: 103, title: 'Evening (5-9 PM)' },
          ]);

        } catch (error) {
          console.error('Failed to fetch seats or shifts:', error);
          toast.error('Failed to load seat and shift options.');
        }
      };
      fetchSeatsAndShifts();
    }
  }, [isActivateModalOpen, selectedStudentToActivate]);


  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranchId, fromDate, toDate]);

  const handleSort = () => {
    setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  // Sort students based on createdAt with validation
  const sortedStudents = [...students].sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    const timeA = isNaN(dateA.getTime()) ? new Date().getTime() : dateA.getTime();
    const timeB = isNaN(dateB.getTime()) ? new Date().getTime() : dateB.getTime();
    return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const filteredStudents = sortedStudents.filter((student: Student) =>
    (student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     student.phone.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this student?')) {
      try {
        await api.deleteStudent(id);
        setStudents(students.filter((student) => student.id !== id));
        toast.success('Student deleted successfully');
      } catch (error: any) {
        console.error('Failed to delete student:', error.message);
        toast.error('Failed to delete student');
      }
    }
  };

  const handleViewDetails = (id: number) => {
    navigate(`/students/${id}`);
  };

  const handleActivateClick = (student: Student) => {
    setSelectedStudentToActivate(student);
    // Set default dates if available, otherwise current date + 1 month
    const today = new Date();
    setNewMembershipStart(formatDate(today.toISOString()));
    const oneMonthLater = new Date(today.setMonth(today.getMonth() + 1));
    setNewMembershipEnd(formatDate(oneMonthLater.toISOString()));
    setNewSeatId(null);
    setNewShiftIds([]);
    setIsActivateModalOpen(true);
  };

  const handleActivateSubmit = async () => {
    if (!selectedStudentToActivate) return;

    if (!newMembershipStart || !newMembershipEnd) {
      toast.error('Membership start and end dates are required.');
      return;
    }

    try {
      setLoading(true); // Indicate loading for the activation process
      await api.activateStudent(selectedStudentToActivate.id, {
        membership_start: newMembershipStart,
        membership_end: newMembershipEnd,
        seat_id: newSeatId,
        shift_ids: newShiftIds,
      });
      toast.success(`${selectedStudentToActivate.name} activated successfully!`);
      setIsActivateModalOpen(false);
      setSelectedStudentToActivate(null);
      // Re-fetch students to update the list, as the activated student should no longer appear here
      const response = await api.getStudents(fromDate || undefined, toDate || undefined, selectedBranchId);
      const updatedStudents = response.students.filter(student => student.status === 'deactivated');
      setStudents(updatedStudents);
    } catch (error: any) {
      console.error('Failed to activate student:', error.message);
      toast.error(`Failed to activate student: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };


  // Find the name of the selected branch for display
  const selectedBranchName = selectedBranchId
    ? branches.find(branch => branch.id === selectedBranchId)?.name
    : null;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Inactive Students</h1>
              <p className="text-gray-500">View all your deactivated students</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                <h3 className="text-lg font-medium">Inactive Students List</h3>
                <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                  <input
                    type="text"
                    placeholder="Search students..."
                    className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-purple-300"
                    value={searchTerm}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              <div className="p-4 flex flex-col md:flex-row items-start md:items-center space-y-2 md:space-y-0 md:space-x-4">
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-500">Branch:</label>
                  <select
                    value={selectedBranchId ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedBranchId(value ? Number(value) : undefined);
                    }}
                    className="p-2 border rounded text-sm"
                  >
                    <option value="">All Branches</option>
                    {branches.map(branch => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-500">From:</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFromDate(e.target.value)}
                    className="p-2 border rounded"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-500">To:</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setToDate(e.target.value)}
                    className="p-2 border rounded"
                  />
                </div>
              </div>
              {loading ? (
                <div className="flex justify-center p-8">Loading students...</div>
              ) : (
                <>
                  <div className="p-4">
                    {selectedBranchId && selectedBranchName ? (
                      <p>Showing students for branch: {selectedBranchName}</p>
                    ) : fromDate && toDate ? (
                      <p>Showing students added from {fromDate} to {toDate}</p>
                    ) : (
                      <p>Showing all deactivated students</p>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead className="hidden md:table-cell">Phone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="hidden md:table-cell">Membership End</TableHead>
                          <TableHead className="hidden md:table-cell">Seat</TableHead>
                          <TableHead>
                            <button
                              className="flex items-center gap-1 hover:text-purple-600"
                              onClick={handleSort}
                            >
                              Added On
                              {sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                            </button>
                          </TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentStudents.length > 0 ? (
                          currentStudents.map((student: Student) => (
                            <TableRow key={student.id}>
                              <TableCell>{student.name}</TableCell>
                              <TableCell className="hidden md:table-cell">{student.phone}</TableCell>
                              <TableCell>
                                <span
                                  className={`px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800`}
                                >
                                  Deactivated
                                </span>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">{formatDate(student.membershipEnd)}</TableCell>
                              <TableCell className="hidden md:table-cell">{student.seatNumber || 'N/A'}</TableCell>
                              <TableCell>{formatDate(student.createdAt)}</TableCell>
                              <TableCell className="flex space-x-2">
                                <button
                                  onClick={() => handleViewDetails(student.id)}
                                  className="text-blue-600 hover:text-blue-800 p-2"
                                  title="View Details"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => handleActivateClick(student)}
                                  className="text-green-600 hover:text-green-800 p-2"
                                  title="Activate Student"
                                >
                                  <Play size={16} /> {/* Play icon for activate */}
                                </button>
                                <button
                                  onClick={() => handleDelete(student.id)}
                                  className="text-red-600 hover:text-red-800 p-2"
                                  title="Delete Student"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                              {selectedBranchId && selectedBranchName
                                ? `No students found for branch: ${selectedBranchName}`
                                : fromDate && toDate
                                ? 'No students found for the selected date range.'
                                : 'No deactivated students available.'}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
              {!loading && filteredStudents.length > 0 && (
                <div className="flex flex-col md:flex-row items-center justify-between border-t border-gray-200 px-6 py-3 space-y-2 md:space-y-0">
                  <div className="flex items-center space-x-2">
                    <select
                      value={studentsPerPage}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                        setStudentsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="text-sm border rounded py-2 px-3"
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span className="text-sm text-gray-500">students per page</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <div className="text-sm text-gray-500">
                    Showing {indexOfFirstStudent + 1} to {Math.min(indexOfLastStudent, filteredStudents.length)} of {filteredStudents.length} students
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activate Student Modal */}
      <Dialog open={isActivateModalOpen} onOpenChange={setIsActivateModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Activate Student: {selectedStudentToActivate?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="membershipStart" className="text-right">
                Membership Start
              </label>
              <input
                id="membershipStart"
                type="date"
                value={newMembershipStart}
                onChange={(e) => setNewMembershipStart(e.target.value)}
                className="col-span-3 border p-2 rounded"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="membershipEnd" className="text-right">
                Membership End
              </label>
              <input
                id="membershipEnd"
                type="date"
                value={newMembershipEnd}
                onChange={(e) => setNewMembershipEnd(e.target.value)}
                className="col-span-3 border p-2 rounded"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="seatId" className="text-right">
                Assign Seat
              </label>
              <select
                id="seatId"
                value={newSeatId ?? ''}
                onChange={(e) => setNewSeatId(e.target.value ? Number(e.target.value) : null)}
                className="col-span-3 border p-2 rounded"
              >
                <option value="">No Seat</option>
                {availableSeats.map(seat => (
                  <option key={seat.id} value={seat.id}>{seat.seat_number}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="shiftIds" className="text-right">
                Assign Shifts
              </label>
              <select
                id="shiftIds"
                multiple
                value={newShiftIds.map(String)} // Convert numbers to strings for select value
                onChange={(e) => {
                  const options = Array.from(e.target.selectedOptions);
                  setNewShiftIds(options.map(option => Number(option.value)));
                }}
                className="col-span-3 border p-2 rounded h-24"
              >
                {availableShifts.map(shift => (
                  <option key={shift.id} value={shift.id}>{shift.title}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivateModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleActivateSubmit} disabled={loading}>
              {loading ? 'Activating...' : 'Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InactiveStudents;