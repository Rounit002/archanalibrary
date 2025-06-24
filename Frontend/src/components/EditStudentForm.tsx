import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import api from '../services/api';
import Select from 'react-select';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

// Define interfaces based on api.ts
interface Student {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  branchId: number;
  branchName?: string;
  membershipStart: string;
  membershipEnd: string;
  status: 'active' | 'expired';
  totalFee: number;
  amountPaid: number;
  dueAmount: number;
  cash: number;
  online: number;
  securityMoney: number;
  remark: string | null;
  profileImageUrl?: string | null;
  createdAt: string;
  assignments?: Array<{
    seatId: number | null;
    shiftId: number;
    seatNumber: string | null;
    shiftTitle: string;
  }>;
}

interface Schedule {
  id: number;
  title: string;
  description: string | null;
  time: string;
  eventDate: string;
}

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

interface Branch {
  id: number;
  name: string;
  code?: string | null;
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  address: string;
  branchId: number | null;
  membershipStart: string;
  membershipEnd: string;
  shiftIds: number[];
  seatId: number | null;
  totalFee: string;
  cash: string;
  online: string;
  securityMoney: string;
  remark: string;
}

interface UpdateStudentPayload {
  name: string;
  email: string;
  phone: string;
  address: string;
  branchId: number;
  membershipStart: string;
  membershipEnd: string;
  totalFee: number;
  amountPaid: number;
  shiftIds: number[];
  seatId: number | null;
  cash: number;
  online: number;
  securityMoney: number;
  remark: string;
}

const EditStudentForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    branchId: null,
    membershipStart: '',
    membershipEnd: '',
    shiftIds: [],
    seatId: null,
    totalFee: '',
    cash: '',
    online: '',
    securityMoney: '',
    remark: '',
  });
  const [shifts, setShifts] = useState<Schedule[]>([]);
  const [seats, setSeats] = useState<Seat[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Parse id to number
  const studentId = id ? parseInt(id, 10) : NaN;
  if (isNaN(studentId)) {
    return <div className="p-6 text-red-500 text-center">Invalid student ID.</div>;
  }

  useEffect(() => {
    const fetchStudentShiftsAndBranches = async () => {
      try {
        const [studentResponse, shiftsResponse, branchesResponse] = await Promise.all([
          api.getStudent(studentId),
          api.getSchedules(),
          api.getBranches(),
        ]);
        const shiftIds = studentResponse.assignments
          ? [...new Set(studentResponse.assignments.map((a) => a.shiftId))]
          : [];
        setFormData({
          name: studentResponse.name || '',
          email: studentResponse.email || '',
          phone: studentResponse.phone || '',
          address: studentResponse.address || '',
          branchId: studentResponse.branchId || null,
          membershipStart: studentResponse.membershipStart || '',
          membershipEnd: studentResponse.membershipEnd || '',
          shiftIds: shiftIds.length > 0 ? shiftIds : [],
          seatId: studentResponse.assignments?.[0]?.seatId || null,
          totalFee: studentResponse.totalFee ? studentResponse.totalFee.toString() : '',
          cash: studentResponse.cash ? studentResponse.cash.toString() : '0',
          online: studentResponse.online ? studentResponse.online.toString() : '0',
          securityMoney: studentResponse.securityMoney
            ? studentResponse.securityMoney.toString()
            : '0',
          remark: studentResponse.remark || '',
        });
        setShifts(shiftsResponse.schedules as Schedule[]);
        setBranches(branchesResponse);
      } catch (error: any) {
        console.error('Failed to fetch data:', error);
        const errorMessage =
          error.response?.status === 404
            ? 'Student not found'
            : error.response?.data?.message || error.message || 'Failed to load student, shifts, or branches';
        toast.error(errorMessage);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentShiftsAndBranches();
  }, [studentId]);

  useEffect(() => {
    const fetchSeats = async () => {
      if (formData.shiftIds.length > 0) {
        setLoadingSeats(true);
        try {
          const seatPromises = formData.shiftIds.map((shiftId) =>
            api.getSeats({ shiftId })
          );
          const seatResponses = await Promise.all(seatPromises);
          const allSeatsPerShift = seatResponses.map((res) => res.seats as Seat[]);

          // Find seats available for all selected shifts
          const availableSeats = allSeatsPerShift.reduce((commonSeats, currentSeats) => {
            return commonSeats.filter((seat) =>
              currentSeats.some((cs) => {
                const shift = cs.shifts.find((s) => s.shiftId === seat.shifts[0].shiftId);
                return cs.id === seat.id && (!shift?.isAssigned || seat.id === formData.seatId);
              })
            );
          }, allSeatsPerShift[0] || []);

          setSeats(availableSeats);

          // Reset seatId if it's not in the available seats
          if (formData.seatId && !availableSeats.some((seat) => seat.id === formData.seatId)) {
            setFormData((prev) => ({ ...prev, seatId: null }));
          }
        } catch (error: any) {
          console.error('Failed to fetch seats:', error);
          const errorMessage =
            error.response?.data?.message || error.message || 'Failed to load seats';
          toast.error(errorMessage);
        } finally {
          setLoadingSeats(false);
        }
      } else {
        setSeats([]);
        setFormData((prev) => ({ ...prev, seatId: null }));
      }
    };
    fetchSeats();
  }, [formData.shiftIds, formData.seatId]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const shiftOptions = shifts.map((shift) => ({
    value: shift.id,
    label: `${shift.title} at ${shift.time} (${shift.eventDate})`,
  }));

  const seatOptions = [
    { value: null, label: 'None' },
    ...seats.map((seat) => ({ value: seat.id, label: seat.seatNumber })),
  ];

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.email.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!validateEmail(formData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    if (!formData.phone.trim()) {
      toast.error('Phone number is required');
      return;
    }
    if (!formData.address.trim()) {
      toast.error('Address is required');
      return;
    }
    if (!formData.branchId) {
      toast.error('Branch is required');
      return;
    }
    if (!formData.membershipStart || !formData.membershipEnd) {
      toast.error('Membership dates are required');
      return;
    }

    const startDate = new Date(formData.membershipStart);
    const endDate = new Date(formData.membershipEnd);
    if (startDate >= endDate) {
      toast.error('Membership End date must be after Membership Start date');
      return;
    }

    const totalFeeValue = parseFloat(formData.totalFee);
    const cashValue = parseFloat(formData.cash) || 0;
    const onlineValue = parseFloat(formData.online) || 0;
    const securityMoneyValue = parseFloat(formData.securityMoney) || 0;
    const amountPaidValue = cashValue + onlineValue;

    if (isNaN(totalFeeValue) || totalFeeValue < 0) {
      toast.error('Total Fee must be a non-negative number');
      return;
    }
    if (cashValue < 0) {
      toast.error('Cash Payment must be a non-negative number');
      return;
    }
    if (onlineValue < 0) {
      toast.error('Online Payment must be a non-negative number');
      return;
    }
    if (securityMoneyValue < 0) {
      toast.error('Security Money must be a non-negative number');
      return;
    }

    if (formData.shiftIds.length === 0) {
      toast.error('Please select at least one shift');
      return;
    }

    // Validate seatId compatibility with shiftIds
    if (formData.seatId) {
      const seatAvailable = seats.some((seat) => seat.id === formData.seatId);
      if (!seatAvailable) {
        toast.error('Selected seat is not available for all chosen shifts');
        return;
      }
    }

    try {
      setSubmitting(true);
      const payload: UpdateStudentPayload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        branchId: formData.branchId!,
        membershipStart: formData.membershipStart,
        membershipEnd: formData.membershipEnd,
        totalFee: totalFeeValue,
        amountPaid: amountPaidValue,
        shiftIds: formData.shiftIds,
        seatId: formData.seatId,
        cash: cashValue,
        online: onlineValue,
        securityMoney: securityMoneyValue,
        remark: formData.remark,
      };
      console.log('Submitting student data:', payload);
      await api.updateStudent(studentId, payload);
      toast.success('Student updated successfully');
      navigate('/students');
    } catch (error: any) {
      console.error('Failed to update student:', error);
      const errorMessage =
        error.response?.status === 404
          ? 'Student not found'
          : error.response?.data?.message || error.message || 'Failed to update student';
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    if (window.confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
      navigate(-1);
    }
  };

  const cashAmount = parseFloat(formData.cash) || 0;
  const onlineAmount = parseFloat(formData.online) || 0;
  const totalAmountPaid = cashAmount + onlineAmount;
  const dueAmount = (parseFloat(formData.totalFee) || 0) - totalAmountPaid;

  if (loading) {
    return <div className="p-6 animate-pulse text-center">Loading...</div>;
  }

  if (shifts.length === 0) {
    return <div className="p-6 text-red-500 text-center">No shifts available. Please add a shift first.</div>;
  }

  if (branches.length === 0) {
    return <div className="p-6 text-red-500 text-center">No branches available. Please add a branch first.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white shadow-lg rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Edit Student</h1>
          <div /> {/* Placeholder for alignment */}
        </div>
        <div className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="phone"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Phone
            </label>
            <input
              type="text"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="address"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Address
            </label>
            <input
              type="text"
              id="address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="branchId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Branch
            </label>
            <select
              id="branchId"
              name="branchId"
              value={String(formData.branchId ?? '')}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  branchId: e.target.value ? parseInt(e.target.value, 10) : null,
                }))
              }
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            >
              <option value="">-- Select Branch --</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="membershipStart"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Membership Start
            </label>
            <input
              type="date"
              id="membershipStart"
              name="membershipStart"
              value={formData.membershipStart}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="membershipEnd"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Membership End
            </label>
            <input
              type="date"
              id="membershipEnd"
              name="membershipEnd"
              value={formData.membershipEnd}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="shiftIds"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Select Shifts
            </label>
            <Select
              id="shiftIds"
              name="shiftIds"
              options={shiftOptions}
              value={shiftOptions.filter((option) =>
                formData.shiftIds.includes(option.value)
              )}
              onChange={(selected) =>
                setFormData((prev) => ({
                  ...prev,
                  shiftIds: selected ? selected.map((s) => s.value) : [],
                }))
              }
              isMulti
              isSearchable
              placeholder="Select shifts"
              className="w-full"
            />
          </div>
          <div>
            <label
              htmlFor="seatId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Select Seat
            </label>
            {loadingSeats ? (
              <div>Loading seats...</div>
            ) : (
              <Select
                id="seatId"
                name="seatId"
                options={seatOptions}
                value={seatOptions.find(
                  (option) => option.value === formData.seatId
                )}
                onChange={(selected) =>
                  setFormData((prev) => ({
                    ...prev,
                    seatId: selected ? selected.value : null,
                  }))
                }
                isSearchable
                placeholder="Select a seat or None"
                className="w-full"
              />
            )}
          </div>
          <div>
            <label
              htmlFor="totalFee"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Total Fee
            </label>
            <input
              type="number"
              id="totalFee"
              name="totalFee"
              value={formData.totalFee}
              onChange={handleChange}
              step="0.01"
              min="0"
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="cash"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Cash Payment
            </label>
            <input
              type="number"
              id="cash"
              name="cash"
              value={formData.cash}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="online"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Online Payment
            </label>
            <input
              type="number"
              id="online"
              name="online"
              value={formData.online}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="securityMoney"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Regestration Fee
            </label>
            <input
              type="number"
              id="securityMoney"
              name="securityMoney"
              value={formData.securityMoney}
              onChange={handleChange}
              step="0.01"
              min="0"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
            />
          </div>
          <div>
            <label
              htmlFor="amountPaid"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Total Amount Paid
            </label>
            <input
              type="number"
              id="amountPaid"
              name="amountPaid"
              value={totalAmountPaid.toFixed(2)}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
          </div>
          <div>
            <label
              htmlFor="dueAmount"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Due Amount
            </label>
            <input
              type="number"
              id="dueAmount"
              name="dueAmount"
              value={dueAmount.toFixed(2)}
              readOnly
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100"
            />
          </div>
          <div>
            <label
              htmlFor="remark"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Remark
            </label>
            <textarea
              id="remark"
              name="remark"
              value={formData.remark}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-300"
              rows={3}
            />
          </div>
          <div className="flex space-x-4">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="w-full"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition duration-200 disabled:bg-purple-400"
            >
              {submitting ? 'Updating...' : 'Update Student'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditStudentForm;