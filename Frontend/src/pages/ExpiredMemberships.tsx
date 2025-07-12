import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '../services/api';
import { Search, ChevronLeft, ChevronRight, Trash2, Eye, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { format, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Select from 'react-select';

// Define interfaces
interface Assignment {
  seatId: number | null;
  shiftId: number;
  seatNumber: string | null;
  shiftTitle: string;
}

interface Student {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  membershipEnd: string; // Ensure this matches the backend alias
  shiftIds?: number[];
  shiftTitles?: string[];
  seatId?: number | null;
  seatNumber?: string | null;
  totalFee?: number;
  cash?: number;
  online?: number;
  securityMoney?: number;
  remark?: string | null;
  branchId?: number | null;
  assignments?: Assignment[];
}

interface Seat {
  id: number;
  seatNumber: string;
  studentId?: number | null;
}

const hasPermissions = (user: any): user is { permissions: string[] } => {
  return user && 'permissions' in user && Array.isArray(user.permissions);
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return 'N/A';
  try {
    return new Date(dateString).toISOString().split('T')[0];
  } catch (e) {
    console.error('Invalid date format:', dateString, e);
    return 'N/A';
  }
};

const ExpiredMemberships = () => {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [renewDialogOpen, setRenewDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(addMonths(new Date(), 1));
  const [emailInput, setEmailInput] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [shiftOptions, setShiftOptions] = useState<{ value: number; label: string }[]>([]);
  const [seatOptions, setSeatOptions] = useState<{ value: number | null; label: string }[]>([]);
  const [selectedShifts, setSelectedShifts] = useState<{ value: number; label: string }[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<{ value: number | null; label: string } | null>(null);
  const [totalFee, setTotalFee] = useState<string>('0');
  const [cash, setCash] = useState<string>('0');
  const [online, setOnline] = useState<string>('0');
  const [securityMoney, setSecurityMoney] = useState<string>('0');
  const [remark, setRemark] = useState<string>('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [studentsResp, shiftsResp] = await Promise.all([
          api.getExpiredMemberships(),
          api.getSchedules(),
        ]);
        console.log('API Response for Expired Members:', studentsResp); // Debug log
        const typedStudents: Student[] = Array.isArray(studentsResp.students)
          ? studentsResp.students.map((s: any) => ({
              ...s,
              email: s.email || null,
              phone: s.phone || null,
              branchId: s.branchId || null,
              membershipEnd: s.membershipEnd || 'N/A', // Fallback to 'N/A' if missing
              totalFee: s.totalFee || 0,
              cash: s.cash || 0,
              online: s.online || 0,
              securityMoney: s.securityMoney || 0,
              remark: s.remark || null,
            }))
          : [];
        setStudents(typedStudents);
        setShiftOptions(shiftsResp.schedules.map((shift: any) => ({ value: shift.id, label: shift.title })));
      } catch (e: any) {
        console.error('Error fetching data:', e);
        toast.error(e.message || 'Failed to fetch expired memberships.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (selectedShifts.length > 0 && selectedStudent) {
      const fetchSeatsForShifts = async () => {
        try {
          const shiftIds = selectedShifts.map((s) => s.value);
          const seatPromises = shiftIds.map((shiftId) => api.getSeats({ shiftId }));
          const seatResponses = await Promise.all(seatPromises);
          const allSeatsPerShift = seatResponses.map((res) => res.seats as Seat[]);

          const currentSeats = selectedStudent.assignments
            ? selectedStudent.assignments.map((a) => a.seatId)
            : [];

          const allSeatsPerShiftFlat = allSeatsPerShift.flat();
          const availableSeats = allSeatsPerShiftFlat.filter((seat) => 
            !currentSeats.includes(seat.id) || seat.studentId === selectedStudent.id
          );

          setSeatOptions([
            { value: null, label: 'None' },
            ...availableSeats.map((seat) => ({
              value: seat.id,
              label: seat.seatNumber || 'Unnamed Seat',
            })),
          ]);

          if (selectedSeat && !availableSeats.some((seat) => seat.id === selectedSeat.value) && selectedSeat.value !== null) {
            setSelectedSeat(null);
          }
        } catch (error) {
          console.error('Error fetching seats for shifts:', error);
          toast.error('Failed to fetch seats');
        }
      };
      fetchSeatsForShifts();
    } else {
      setSeatOptions([{ value: null, label: 'None' }]);
    }
  }, [selectedShifts, selectedStudent]);

  const handleRenewClick = async (student: Student) => {
    setSelectedStudent(student);
    setStartDate(new Date());
    setEndDate(addMonths(new Date(), 1));
    setEmailInput(student.email || '');
    setPhoneInput(student.phone || '');

    try {
      const studentDetails = await api.getStudent(student.id);
      const shiftIds = studentDetails.assignments
        ? [...new Set(studentDetails.assignments.map((a) => a.shiftId))]
        : [];
      const shiftTitles = studentDetails.assignments
        ? [...new Set(studentDetails.assignments.map((a) => a.shiftTitle))]
        : [];
      setSelectedShifts(
        shiftIds.map((id, index) => ({
          value: id,
          label: shiftTitles[index] || 'Unknown Shift',
        }))
      );
      setSelectedSeat(
        studentDetails.assignments?.[0]?.seatId
          ? { value: studentDetails.assignments[0].seatId, label: studentDetails.assignments[0].seatNumber || 'None' }
          : { value: null, label: 'None' }
      );
      setTotalFee(student.totalFee?.toString() || '0');
      setCash('0');
      setOnline('0');
      setSecurityMoney(student.securityMoney?.toString() || '0');
      setRemark(student.remark || '');
    } catch (error) {
      console.error('Error fetching student details:', error);
      setSelectedShifts([]);
      setSelectedSeat({ value: null, label: 'None' });
      setTotalFee('0');
      setCash('0');
      setOnline('0');
      setSecurityMoney('0');
      setRemark('');
    }

    setRenewDialogOpen(true);
  };

  const handleRenewSubmit = async () => {
    if (!selectedStudent || !startDate || !endDate || !phoneInput || selectedShifts.length === 0 || !totalFee) {
      toast.error('Please fill all required fields (Start Date, End Date, Phone, Shifts, Total Fee)');
      return;
    }

    const totalFeeNum = parseFloat(totalFee) || 0;
    const cashNum = parseFloat(cash) || 0;
    const onlineNum = parseFloat(online) || 0;
    const securityMoneyNum = parseFloat(securityMoney) || 0;

    if (
      isNaN(totalFeeNum) ||
      totalFeeNum < 0 ||
      isNaN(cashNum) ||
      cashNum < 0 ||
      isNaN(onlineNum) ||
      onlineNum < 0 ||
      isNaN(securityMoneyNum) ||
      securityMoneyNum < 0
    ) {
      toast.error('Financial values must be valid non-negative numbers');
      return;
    }

    try {
      const studentDetails = await api.getStudent(selectedStudent.id);
      const branchId = studentDetails.branchId;

      const membershipData = {
        membershipStart: format(startDate, 'yyyy-MM-dd'),
        membershipEnd: format(endDate, 'yyyy-MM-dd'),
        email: emailInput || undefined,
        phone: phoneInput || undefined,
        branchId: branchId || undefined,
        seatId: selectedSeat ? selectedSeat.value : null,
        shiftIds: selectedShifts.map((s) => s.value),
        totalFee: totalFeeNum,
        cash: cashNum,
        online: onlineNum,
        securityMoney: securityMoneyNum,
        remark: remark.trim() || undefined,
      };

      console.log('Sending renewal data:', membershipData);
      const response = await api.renewStudent(selectedStudent.id, membershipData);
      console.log('Renewal response:', response);

      toast.success(`Membership renewed for ${selectedStudent.name}`);
      setRenewDialogOpen(false);

      const resp = await api.getExpiredMemberships();
      console.log('Updated Expired Members Response:', resp); // Debug log
      setStudents(
        resp.students.map((s: any) => ({
          ...s,
          email: s.email || null,
          phone: s.phone || null,
          branchId: s.branchId || null,
          membershipEnd: s.membershipEnd || 'N/A', // Fallback to 'N/A' if missing
          totalFee: s.totalFee || 0,
          cash: s.cash || 0,
          online: s.online || 0,
          securityMoney: s.securityMoney || 0,
          remark: s.remark || null,
        }))
      );
    } catch (err: any) {
      console.error('Renew error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Failed to renew membership. Please check the data and try again.');
    }
  };

  const cashAmount = parseFloat(cash) || 0;
  const onlineAmount = parseFloat(online) || 0;
  const paid = cashAmount + onlineAmount;
  const due = (parseFloat(totalFee) || 0) - paid;

  if (!user) {
    navigate('/login');
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Navbar />
        <div className="flex-1 p-4 overflow-y-auto">
          <h2 className="text-xl font-semibold mb-4">Expired Memberships</h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" />
            <input
              className="pl-10 pr-4 py-2 border rounded w-full"
              placeholder="Search by name or phone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Seat Number</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students
                    .filter(
                      (s) =>
                        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        s.phone?.includes(searchTerm)
                    )
                    .map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>{student.name}</TableCell>
                        <TableCell>{student.phone || 'N/A'}</TableCell>
                        <TableCell>{student.seatNumber || 'N/A'}</TableCell>
                        <TableCell>{formatDate(student.membershipEnd)}</TableCell>
                        <TableCell className="space-x-2">
                          <Button onClick={() => navigate(`/students/${student.id}`)} variant="outline">
                            <Eye size={16} />
                          </Button>
                          {user?.role === 'admin' && (
                            <Button onClick={() => handleRenewClick(student)}>
                              <ChevronRight size={16} /> Renew
                            </Button>
                          )}
                          {(user?.role === 'admin' ||
                            (hasPermissions(user) && user.permissions.includes('manage_students'))) && (
                            <Button
                              variant="destructive"
                              onClick={async () => {
                                if (
                                  confirm(
                                    'Are you sure you want to delete this student? This action cannot be undone.'
                                  )
                                ) {
                                  try {
                                    await api.deleteStudent(student.id);
                                    setStudents(students.filter((s) => s.id !== student.id));
                                    toast.success('Student deleted successfully.');
                                  } catch (err: any) {
                                    toast.error(err.message || 'Failed to delete student.');
                                  }
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </Button>
                          )}
                          {student.phone && (
                            <Button
                              variant="outline"
                              onClick={() => {
                                const cleanPhone = student.phone!.replace(/[^\d]/g, '');
                                window.open(`https://wa.me/${cleanPhone}`, '_blank');
                              }}
                            >
                              <MessageCircle size={16} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <Dialog open={renewDialogOpen} onOpenChange={setRenewDialogOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Renew Membership</DialogTitle>
              <DialogDescription>Renew for {selectedStudent?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm">Start Date</label>
                <Calendar mode="single" selected={startDate} onSelect={setStartDate} />
              </div>
              <div>
                <label className="block text-sm">End Date</label>
                <Calendar mode="single" selected={endDate} onSelect={setEndDate} />
              </div>
              <div>
                <label className="block text-sm">Email</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm">Phone</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm">Shifts</label>
                <Select
                  options={shiftOptions}
                  value={selectedShifts}
                  onChange={(newValue) => setSelectedShifts(newValue as { value: number; label: string }[])}
                  placeholder="Select Shifts"
                  isMulti
                  isSearchable
                />
              </div>
              <div>
                <label className="block text-sm">Seat</label>
                <Select
                  options={seatOptions}
                  value={selectedSeat}
                  onChange={(newValue) => setSelectedSeat(newValue as { value: number | null; label: string } | null)}
                  placeholder="Select Seat"
                />
              </div>
              <div>
                <label className="block text-sm">Total Fee</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="number"
                  value={totalFee}
                  onChange={(e) => setTotalFee(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm">Cash Payment</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="number"
                  value={cash}
                  onChange={(e) => setCash(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm">Online Payment</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="number"
                  value={online}
                  onChange={(e) => setOnline(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm">Registration Fee</label>
                <input
                  className="w-full border rounded px-2 py-1"
                  type="number"
                  value={securityMoney}
                  onChange={(e) => setSecurityMoney(e.target.value)}
                  min="0"
                  step="0.01"
                />
              </div>
              <div>
                <label className="block text-sm">Amount Paid</label>
                <input
                  className="w-full border rounded px-2 py-1 bg-gray-100"
                  type="number"
                  value={paid.toFixed(2)}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm">Due Amount</label>
                <input
                  className="w-full border rounded px-2 py-1 bg-gray-100"
                  type="number"
                  value={due.toFixed(2)}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm">Remark</label>
                <textarea
                  className="w-full border rounded px-2 py-1"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenewDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleRenewSubmit}>Renew</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default ExpiredMemberships;