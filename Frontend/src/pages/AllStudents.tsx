import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api, { Branch } from '../services/api';
import { Search, ChevronLeft, ChevronRight, Trash2, Eye, ArrowUp, ArrowDown, Ban } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

// Define the Student type for the frontend, matching the expected structure
interface Student {
  id: number;
  name: string;
  phone: string;
  membershipEnd: string;
  createdAt: string;
  status: 'active' | 'expired' | 'deactivated';
  seatNumber?: string | null;
}

// Utility function to format date to YYYY-MM-DD
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toISOString().split('T')[0];
};

const AllStudents = () => {
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

  useEffect(() => {
    const fetchStudents = async () => {
      try {
        setLoading(true);
        const response = await api.getStudents(fromDate || undefined, toDate || undefined, selectedBranchId);
        const updatedStudents = response.students.map((student: any) => ({
          ...student,
          createdAt: student.createdAt || 'N/A',
        }));
        setStudents(updatedStudents);
      } catch (error: any) {
        console.error('Failed to fetch students:', error.message);
        toast.error('Failed to fetch students');
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, [selectedBranchId, fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedBranchId, fromDate, toDate]);

  const handleSort = () => {
    setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
  };

  const sortedStudents = [...students].sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    const timeA = isNaN(dateA.getTime()) ? 0 : dateA.getTime();
    const timeB = isNaN(dateB.getTime()) ? 0 : dateB.getTime();
    return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
  });

  const filteredStudents = sortedStudents
    .filter(student => student.status === 'active' || student.status === 'expired') // ✅ NEW: only active or expired
    .filter(student =>
      student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.phone.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);

  const handleDelete = async (id: number) => {
    if (confirm('Are you sure you want to delete this student?')) {
      try {
        await api.deleteStudent(id);
        setStudents(students.filter(student => student.id !== id));
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

  const handleDeactivate = async (id: number) => {
    if (confirm('Are you sure you want to deactivate this student? This will remove their seat and hide them from active lists.')) {
      try {
        await api.deactivateStudent(id);
        toast.success('Student deactivated successfully');
        const response = await api.getStudents(fromDate || undefined, toDate || undefined, selectedBranchId);
        const updatedStudents = response.students.map((student: any) => ({
          ...student,
          createdAt: student.createdAt || 'N/A',
        }));
        setStudents(updatedStudents);
      } catch (error: any) {
        console.error('Failed to deactivate student:', error.message);
        toast.error(`Failed to deactivate student: ${error.message}`);
      }
    }
  };

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
              <h1 className="text-2xl font-bold text-gray-800">All Students</h1>
              <p className="text-gray-500">Manage all your students (Active, Expired)</p>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row items-start md:items-center justify-between space-y-2 md:space-y-0">
                <h3 className="text-lg font-medium">Students List</h3>
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
                      <p>Showing active and expired students</p>
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
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                                    student.status === 'active' ? 'bg-green-100 text-green-800' :
                                    student.status === 'expired' ? 'bg-red-100 text-red-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}
                                >
                                  {student.status.charAt(0).toUpperCase() + student.status.slice(1)}
                                </span>
                              </TableCell>
                              <TableCell className="hidden md:table-cell">{formatDate(student.membershipEnd)}</TableCell>
                              <TableCell className="hidden md:table-cell">{student.seatNumber || 'N/A'}</TableCell>
                              <TableCell>{formatDate(student.createdAt)}</TableCell>
                              <TableCell>
                                <button
                                  onClick={() => handleViewDetails(student.id)}
                                  className="mr-2 text-blue-600 hover:text-blue-800 p-2"
                                  title="View Details"
                                >
                                  <Eye size={16} />
                                </button>
                                <button
                                  onClick={() => handleDelete(student.id)}
                                  className="mr-2 text-red-600 hover:text-red-800 p-2"
                                  title="Delete Student"
                                >
                                  <Trash2 size={16} />
                                </button>
                                {(student.status === 'active' || student.status === 'expired') && (
                                  <button
                                    onClick={() => handleDeactivate(student.id)}
                                    className="text-yellow-600 hover:text-yellow-800 p-2"
                                    title="Deactivate Student"
                                  >
                                    <Ban size={16} />
                                  </button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                              No students found.
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
    </div>
  );
};

export default AllStudents;
