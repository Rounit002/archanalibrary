// File: ExpiredMemberships.tsx
import React, { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '../services/api';
import { Search, ChevronLeft, ChevronRight, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { format, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import Select from 'react-select';

// Assuming your api.ts file exports these interfaces
interface Student {
  id: number;
  name: string;
  email: string;
  phone: string;
  membershipEnd: string;
  shiftId?: number;
  shiftTitle?: string;
  seatId?: number;
  seatNumber?: string;
  totalFee?: number;
  cash?: number;
  online?: number;
  securityMoney?: number;
  remark?: string;
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
  return new Date(dateString).toISOString().split('T')[0];
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
  const [shiftOptions, setShiftOptions] = useState<any[]>([]);
  const [seatOptions, setSeatOptions] = useState<any[]>([]);
  const [selectedShift, setSelectedShift] = useState<any>(null);
  const [selectedSeat, setSelectedSeat] = useState<any>(null);
  const [totalFee, setTotalFee] = useState<string>('');
  const [cash, setCash] = useState<string>('');
  const [online, setOnline] = useState<string>('');
  const [securityMoney, setSecurityMoney] = useState<string>('');
  const [remark, setRemark] = useState<string>('');
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // More efficient: fetch only expired members directly
        const [studentsResp, shiftsResp] = await Promise.all([
          api.getExpiredMemberships(),
          api.getSchedules(),
        ]);

        // No more client-side filtering needed
        setStudents(studentsResp.students);
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
    if (selectedShift && selectedStudent) {
      const fetchSeatsForShift = async () => {
        try {
          const response = await api.getSeats({ shiftId: selectedShift.value });
          const allSeats: Seat[] = response.seats;
          // Filter seats that are not assigned OR assigned to the current student being renewed
          const availableSeats = allSeats.filter((seat: any) => !seat.studentId || seat.studentId === selectedStudent.id);
          setSeatOptions([
            { value: null, label: 'None' },
            ...availableSeats.map((seat: any) => ({ value: seat.id, label: seat.seatNumber }))
          ]);
          // Reset seat if it's no longer valid for the new shift
          if (selectedSeat && !availableSeats.some((seat: any) => seat.id === selectedSeat.value) && selectedSeat.value !== null) {
            setSelectedSeat(null);
          }
        } catch (error) {
          console.error('Error fetching seats for shift:', error);
          toast.error('Failed to fetch seats');
        }
      };
      fetchSeatsForShift();
    }
  }, [selectedShift, selectedStudent]);

  const handleRenewClick = (student: Student) => {
    setSelectedStudent(student);
    setStartDate(new Date());
    setEndDate(addMonths(new Date(), 1));
    setEmailInput(student.email || '');
    setPhoneInput(student.phone || '');
    setSelectedShift(student.shiftId ? { value: student.shiftId, label: student.shiftTitle } : null);
    setSelectedSeat(student.seatId ? { value: student.seatId, label: student.seatNumber } : null);
    setTotalFee(student.totalFee ? student.totalFee.toString() : '');
    setCash(''); // Reset payment fields on open
    setOnline('');
    setSecurityMoney(student.securityMoney ? student.securityMoney.toString() : '');
    setRemark(student.remark || '');
    setRenewDialogOpen(true);
  };

  const handleRenewSubmit = async () => {
    if (!selectedStudent || !startDate || !endDate || !emailInput || !phoneInput || !selectedShift || !totalFee) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      await api.renewStudent(selectedStudent.id, {
        membershipStart: format(startDate, 'yyyy-MM-dd'),
        membershipEnd: format(endDate, 'yyyy-MM-dd'),
        email: emailInput,
        phone: phoneInput,
        shiftIds: [selectedShift.value], // API expects an array
        seatId: selectedSeat ? selectedSeat.value : undefined,
        totalFee: parseFloat(totalFee),
        cash: parseFloat(cash) || 0,
        online: parseFloat(online) || 0,
        securityMoney: parseFloat(securityMoney) || 0,
        remark: remark.trim() || undefined,
      });

      toast.success(`Membership renewed for ${selectedStudent.name}`);
      setRenewDialogOpen(false);

      // Refresh the list after renewal
      const resp = await api.getExpiredMemberships();
      setStudents(resp.students);

    } catch (err: any) {
      console.error('Renew error:', err.response?.data || err.message);
      toast.error(err.response?.data?.message || 'Failed to renew membership');
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
      <div className="flex-1 flex flex-col overflow-hidden">
        <Navbar />
        <div className="p-4">
          <h2 className="text-xl font-semibold mb-4">Expired Memberships</h2>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-3 text-gray-400" />
            <input
              className="pl-10 pr-4 py-2 border rounded"
              placeholder="Search by name or phone"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {loading ? (
            <p>Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
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
                      <TableCell>{student.email}</TableCell>
                      <TableCell>{student.phone}</TableCell>
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
                              if (confirm('Are you sure you want to delete this student? This action cannot be undone.')) {
                                try {
                                    await api.deleteStudent(student.id);
                                    setStudents(students.filter((s) => s.id !== student.id));
                                    toast.success('Student deleted successfully.');
                                } catch(err: any) {
                                    toast.error(err.message || "Failed to delete student.");
                                }
                              }
                            }}
                          >
                            <Trash2 size={16} />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
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
                <label className="block text-sm">Shift</label>
                <Select
                  options={shiftOptions}
                  value={selectedShift}
                  onChange={setSelectedShift}
                  placeholder="Select Shift"
                />
              </div>
              <div>
                <label className="block text-sm">Seat</label>
                <Select
                  options={seatOptions}
                  value={selectedSeat}
                  onChange={setSelectedSeat}
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
                <label className="block text-sm">Security Money</label>
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