module.exports = (pool) => {
  const router = require('express').Router();
  const { checkAdmin, checkAdminOrStaff } = require('./auth');

  // A helper function to add the dynamic status to the query
  const withCalculatedStatus = (selectFields = 's.*') => `
    SELECT
      ${selectFields},
      CASE
        WHEN s.membership_end < CURRENT_DATE THEN 'expired'
        ELSE 'active'
      END AS status
    FROM students s
  `;

  // GET all students (with calculated status, created_at, and seat number)
  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      
      let query = `
        SELECT
          s.id,
          s.name,
          s.phone,
          TO_CHAR(s.membership_end, 'YYYY-MM-DD') AS membership_end,
          TO_CHAR(s.created_at, 'YYYY-MM-DD') AS created_at,
          CASE
            WHEN s.membership_end < CURRENT_DATE THEN 'expired'
            ELSE 'active'
          END AS status,
          (SELECT seats.seat_number
           FROM seat_assignments sa
           LEFT JOIN seats ON sa.seat_id = seats.id
           WHERE sa.student_id = s.id
           ORDER BY sa.id
           LIMIT 1) AS seat_number
        FROM students s
      `;
      const params = [];

      if (branchIdNum) {
        query += ` WHERE s.branch_id = $1`;
        params.push(branchIdNum);
      }
      query += ` ORDER BY s.name`;
      
      const result = await pool.query(query, params);
      res.json({ students: result.rows });
    } catch (err) {
      console.error('Error fetching students:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // GET active students (dynamically)
  router.get('/active', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      let query = withCalculatedStatus();
      const params = [];

      query += ` WHERE s.membership_end >= CURRENT_DATE`;
      if (branchIdNum) {
        query += ` AND s.branch_id = $1`;
        params.push(branchIdNum);
      }
      query += ` ORDER BY s.name`;

      const result = await pool.query(query, params);
      const students = result.rows.map(student => ({
        ...student,
        membership_start: new Date(student.membership_start).toISOString().split('T')[0],
        membership_end: new Date(student.membership_end).toISOString().split('T')[0],
        total_fee: parseFloat(student.total_fee || 0),
        amount_paid: parseFloat(student.amount_paid || 0),
        due_amount: parseFloat(student.due_amount || 0),
        cash: parseFloat(student.cash || 0),
        online: parseFloat(student.online || 0),
        security_money: parseFloat(student.security_money || 0),
        remark: student.remark || '',
      }));
      res.json({ students });
    } catch (err) {
      console.error('Error in students/active route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // GET expired students (dynamically)
  router.get('/expired', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      let query = withCalculatedStatus();
      const params = [];
      
      query += ` WHERE s.membership_end < CURRENT_DATE`;

      if (branchIdNum) {
        query += ` AND s.branch_id = $1`;
        params.push(branchIdNum);
      }
      query += ` ORDER BY s.name`;

      const result = await pool.query(query, params);
      const students = result.rows.map(student => ({
        ...student,
        membership_start: new Date(student.membership_start).toISOString().split('T')[0],
        membership_end: new Date(student.membership_end).toISOString().split('T')[0],
        total_fee: parseFloat(student.total_fee || 0),
        amount_paid: parseFloat(student.amount_paid || 0),
        due_amount: parseFloat(student.due_amount || 0),
        cash: parseFloat(student.cash || 0),
        online: parseFloat(student.online || 0),
        security_money: parseFloat(student.security_money || 0),
        remark: student.remark || '',
      }));
      res.json({ students });
    } catch (err) {
      console.error('Error in students/expired route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // GET students expiring soon
  router.get('/expiring-soon', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      let query = withCalculatedStatus();
      const params = [thirtyDaysFromNow];
      
      query += ` WHERE s.membership_end >= CURRENT_DATE AND s.membership_end <= $1`;

      if (branchIdNum) {
        query += ` AND s.branch_id = $2`;
        params.push(branchIdNum);
      }
      query += ` ORDER BY s.membership_end`;

      const result = await pool.query(query, params);
      const students = result.rows.map(student => ({
        ...student,
        membership_start: new Date(student.membership_start).toISOString().split('T')[0],
        membership_end: new Date(student.membership_end).toISOString().split('T')[0],
        total_fee: parseFloat(student.total_fee || 0),
        amount_paid: parseFloat(student.amount_paid || 0),
        due_amount: parseFloat(student.due_amount || 0),
        cash: parseFloat(student.cash || 0),
        online: parseFloat(student.online || 0),
        security_money: parseFloat(student.security_money || 0),
        remark: student.remark || '',
      }));
      res.json({ students });
    } catch (err) {
      console.error('Error in students/expiring-soon route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // GET a single student by ID (with calculated status)
  router.get('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const queryText = `
        SELECT
          s.*,
          b.name AS branch_name,
          CASE
            WHEN s.membership_end < CURRENT_DATE THEN 'expired'
            ELSE 'active'
          END AS status
        FROM students s
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE s.id = $1
      `;
      const result = await pool.query(queryText, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Student not found' });
      }
      const studentData = result.rows[0];
      const assignments = await pool.query(`
        SELECT sa.seat_id, sa.shift_id, seats.seat_number, sch.title AS shift_title
        FROM seat_assignments sa
        LEFT JOIN seats ON sa.seat_id = seats.id
        LEFT JOIN schedules sch ON sa.shift_id = sch.id
        WHERE sa.student_id = $1
      `, [id]);
      res.json({
        ...studentData,
        membership_start: new Date(studentData.membership_start).toISOString().split('T')[0],
        membership_end: new Date(studentData.membership_end).toISOString().split('T')[0],
        total_fee: parseFloat(studentData.total_fee || 0),
        amount_paid: parseFloat(studentData.amount_paid || 0),
        due_amount: parseFloat(studentData.due_amount || 0),
        cash: parseFloat(studentData.cash || 0),
        online: parseFloat(studentData.online || 0),
        security_money: parseFloat(studentData.security_money || 0),
        remark: studentData.remark || '',
        assignments: assignments.rows
      });
    } catch (err) {
      console.error('Error in students/:id route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  router.get('/shift/:shiftId', checkAdminOrStaff, async (req, res) => {
    try {
      const { shiftId } = req.params;
      const { search, status: statusFilter } = req.query;
      
      const shiftIdNum = parseInt(shiftId, 10);
      if (isNaN(shiftIdNum)) {
        return res.status(400).json({ message: 'Invalid Shift ID' });
      }

      let query = `
        SELECT
          s.id,
          s.name,
          s.email,
          s.phone,
          s.membership_end,
          CASE
            WHEN s.membership_end < CURRENT_DATE THEN 'expired'
            ELSE 'active'
          END AS status
        FROM students s
        JOIN seat_assignments sa ON s.id = sa.student_id
        WHERE sa.shift_id = $1
      `;
      const params = [shiftIdNum];
      
      let paramIndex = 2;
      if (search) {
        query += ` AND (s.name ILIKE $${paramIndex} OR s.phone ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }
      
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'active') {
          query += ` AND s.membership_end >= CURRENT_DATE`;
        } else if (statusFilter === 'expired') {
          query += ` AND s.membership_end < CURRENT_DATE`;
        }
      }
      
      query += ` ORDER BY s.name`;

      const result = await pool.query(query, params);
      
      res.json({ students: result.rows });

    } catch (err) {
      console.error(`Error fetching students for shift ${req.params.shiftId}:`, err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // POST a new student
  router.post('/', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const {
        name, email, phone, address, branch_id, membership_start, membership_end,
        total_fee, amount_paid, shift_ids, seat_id, cash, online, security_money, remark, profile_image_url
      } = req.body;

      console.log('Received request body for POST /students:', req.body);

      if (!name || !branch_id || !membership_start || !membership_end) {
        console.error('Validation failed: Missing required fields');
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Required fields missing (name, branch_id, membership_start, membership_end)' });
      }

      const branchIdNum = parseInt(branch_id, 10);
      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? shift_ids.map(id => parseInt(id, 10)) : [];

      const feeValue = parseFloat(total_fee || 0);
      const paidValue = parseFloat(amount_paid || 0);
      if (isNaN(feeValue) || feeValue < 0) {
        console.error('Validation failed: Total fee invalid', { total_fee });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Total fee must be a valid non-negative number' });
      }
      if (isNaN(paidValue) || paidValue < 0) {
        console.error('Validation failed: Amount paid invalid', { amount_paid });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Amount paid must be a valid non-negative number' });
      }

      const cashValue = cash !== undefined ? parseFloat(cash) : 0;
      const onlineValue = online !== undefined ? parseFloat(online) : 0;
      const securityMoneyValue = security_money !== undefined ? parseFloat(security_money) : 0;

      if (isNaN(cashValue) || cashValue < 0) {
        console.error('Validation failed: Cash invalid', { cash });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cash must be a valid non-negative number' });
      }
      if (isNaN(onlineValue) || onlineValue < 0) {
        console.error('Validation failed: Online invalid', { online });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Online payment must be a valid non-negative number' });
      }
      if (isNaN(securityMoneyValue) || securityMoneyValue < 0) {
        console.error('Validation failed: Security money invalid', { security_money });
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Security money must be a valid non-negative number' });
      }

      const dueAmount = feeValue - paidValue;

      if (seatIdNum && shiftIdsNum.length > 0) {
        const seatCheck = await client.query('SELECT 1 FROM seats WHERE id = $1', [seatIdNum]);
        if (seatCheck.rows.length === 0) {
          console.error('Validation failed: Seat does not exist', { seatIdNum });
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Seat with ID ${seatIdNum} does not exist` });
        }

        for (const shiftId of shiftIdsNum) {
          const shiftCheck = await client.query('SELECT 1 FROM schedules WHERE id = $1', [shiftId]);
          if (shiftCheck.rows.length === 0) {
            console.error('Validation failed: Shift does not exist', { shiftId });
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Shift with ID ${shiftId} does not exist` });
          }
        }

        for (const shiftId of shiftIdsNum) {
          const checkAssignment = await client.query(
            'SELECT 1 FROM seat_assignments WHERE seat_id = $1 AND shift_id = $2',
            [seatIdNum, shiftId]
          );
          if (checkAssignment.rows.length > 0) {
            console.error('Validation failed: Seat already assigned for shift', { seatIdNum, shiftId });
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Seat is already assigned for shift ${shiftId}` });
          }
        }
      }
      
      const status = new Date(membership_end) < new Date() ? 'expired' : 'active';

      console.log('Inserting into students table with values:', {
        name, email, phone, address, branchIdNum, membership_start, membership_end,
        feeValue, paidValue, dueAmount, cashValue, onlineValue, securityMoneyValue, remark, profile_image_url, status
      });
      const result = await client.query(
        `INSERT INTO students (
          name, email, phone, address, branch_id, membership_start, membership_end,
          total_fee, amount_paid, due_amount, cash, online, security_money, remark, profile_image_url, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          name, email, phone, address, branchIdNum, membership_start, membership_end,
          feeValue, paidValue, dueAmount, cashValue, onlineValue, securityMoneyValue, remark || null, profile_image_url || null, status
        ]
      );
      const student = result.rows[0];
      console.log('Inserted student:', student);

      let firstShiftId = null;
      if (seatIdNum && shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          console.log('Inserting into seat_assignments:', { seatIdNum, shiftId, studentId: student.id });
          await client.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, student.id]
          );
          console.log('Successfully inserted into seat_assignments for shift:', shiftId);
          if (!firstShiftId) firstShiftId = shiftId;
        }
      }

      await client.query(
        `INSERT INTO student_membership_history (
          student_id, name, email, phone, address,
          membership_start, membership_end, status,
          total_fee, amount_paid, due_amount,
          cash, online, security_money, remark,
          seat_id, shift_id,
          changed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())`,
        [
          student.id, student.name, student.email, student.phone, student.address,
          student.membership_start, student.membership_end, student.status,
          student.total_fee, student.amount_paid, student.due_amount,
          student.cash, student.online, student.security_money, student.remark || '',
          seatIdNum, firstShiftId
        ]
      );

      await client.query('COMMIT');

      res.status(201).json({
        student: {
          ...student,
          total_fee: parseFloat(student.total_fee || 0),
          amount_paid: parseFloat(student.amount_paid || 0),
          due_amount: parseFloat(student.due_amount || 0),
          cash: parseFloat(student.cash || 0),
          online: parseFloat(student.online || 0),
          security_money: parseFloat(student.security_money || 0),
          remark: student.remark || '',
          profile_image_url: student.profile_image_url || '',
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error adding student:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  // PUT update a student
  router.put('/:id', checkAdminOrStaff, async (req, res) => {
    const client = await pool.connect(); // Use a transaction to ensure consistency
    try {
      await client.query('BEGIN'); // Start transaction

      const id = parseInt(req.params.id, 10);
      const {
        name, email, phone, address, branch_id, membership_start, membership_end,
        total_fee, amount_paid, shift_ids, seat_id, cash, online, security_money, remark
      } = req.body;

      // Validate required fields
      if (!name || !email || !phone || !address || !branch_id || !membership_start || !membership_end) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Required fields missing (name, email, phone, address, branch_id, membership_start, membership_end)' });
      }

      const branchIdNum = branch_id ? parseInt(branch_id, 10) : null;
      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? shift_ids.map(id => parseInt(id, 10)) : [];

      // Fetch the current student record to preserve existing values if not provided
      const currentStudentRes = await client.query(
        `SELECT total_fee, amount_paid, due_amount, cash, online, security_money 
         FROM students 
         WHERE id = $1`,
        [id]
      );

      if (currentStudentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }

      const currentStudent = currentStudentRes.rows[0];

      // Parse monetary fields, preserving existing values if not provided
      const totalFeeValue = total_fee !== undefined && total_fee !== null && total_fee !== ''
        ? parseFloat(total_fee)
        : parseFloat(currentStudent.total_fee || 0);
      const amountPaidValue = amount_paid !== undefined && amount_paid !== null && amount_paid !== ''
        ? parseFloat(amount_paid)
        : parseFloat(currentStudent.amount_paid || 0);
      const cashValue = cash !== undefined && cash !== null && cash !== ''
        ? parseFloat(cash)
        : parseFloat(currentStudent.cash || 0);
      const onlineValue = online !== undefined && online !== null && online !== ''
        ? parseFloat(online)
        : parseFloat(currentStudent.online || 0);
      const securityMoneyValue = security_money !== undefined && security_money !== null && security_money !== ''
        ? parseFloat(security_money)
        : parseFloat(currentStudent.security_money || 0);

      // Validate monetary fields
      if (isNaN(totalFeeValue) || totalFeeValue < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Total fee must be a valid non-negative number' });
      }
      if (isNaN(amountPaidValue) || amountPaidValue < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Amount paid must be a valid non-negative number' });
      }
      if (isNaN(cashValue) || cashValue < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Cash must be a valid non-negative number' });
      }
      if (isNaN(onlineValue) || onlineValue < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Online payment must be a valid non-negative number' });
      }
      if (isNaN(securityMoneyValue) || securityMoneyValue < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Security money must be a valid non-negative number' });
      }

      // Recalculate due_amount based on the new or existing total_fee and amount_paid
      const dueAmountValue = totalFeeValue - amountPaidValue;

      // Validate seat and shift assignments if provided
      if (seatIdNum && shiftIdsNum.length > 0) {
        // Check if seat exists
        const seatCheck = await client.query('SELECT 1 FROM seats WHERE id = $1', [seatIdNum]);
        if (seatCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Seat with ID ${seatIdNum} does not exist` });
        }

        // Check if shifts exist
        for (const shiftId of shiftIdsNum) {
          const shiftCheck = await client.query('SELECT 1 FROM schedules WHERE id = $1', [shiftId]);
          if (shiftCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Shift with ID ${shiftId} does not exist` });
          }
        }

        // Check for seat assignment conflicts
        for (const shiftId of shiftIdsNum) {
          const checkAssignment = await client.query(
            'SELECT 1 FROM seat_assignments WHERE seat_id = $1 AND shift_id = $2 AND student_id != $3',
            [seatIdNum, shiftId, id]
          );
          if (checkAssignment.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Seat is already assigned for shift ${shiftId}` });
          }
        }
      }

      // Determine the status based on membership_end date
      const status = new Date(membership_end) < new Date() ? 'expired' : 'active';

      // Update the students table
      const result = await client.query(
        `UPDATE students 
         SET name = $1, email = $2, phone = $3, address = $4, branch_id = $5,
             membership_start = $6, membership_end = $7, total_fee = $8, 
             amount_paid = $9, due_amount = $10, cash = $11, online = $12, 
             security_money = $13, remark = $14, status = $15
         WHERE id = $16 
         RETURNING *`,
        [
          name, email, phone, address, branchIdNum, membership_start, membership_end,
          totalFeeValue, amountPaidValue, dueAmountValue, cashValue, onlineValue,
          securityMoneyValue, remark || null, status, id
        ]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }

      const updatedStudent = result.rows[0];

      // Update seat assignments if provided
      let firstShiftId = null;
      if (seatIdNum && shiftIdsNum.length > 0) {
        await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, id]
          );
          if (!firstShiftId) firstShiftId = shiftId; // Take the first shift for history
        }
      } else {
        // If no seat or shifts are provided, clear the seat assignments
        await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
      }

      // Fetch the latest student_membership_history record for this student
      const historyRes = await client.query(
        `SELECT id 
         FROM student_membership_history 
         WHERE student_id = $1 
         ORDER BY changed_at DESC 
         LIMIT 1`,
        [id]
      );

      if (historyRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'No membership history found for this student' });
      }

      const historyId = historyRes.rows[0].id;

      // Update the latest student_membership_history record
      await client.query(
        `UPDATE student_membership_history 
         SET name = $1, email = $2, phone = $3, address = $4,
             membership_start = $5, membership_end = $6, status = $7,
             total_fee = $8, amount_paid = $9, due_amount = $10,
             cash = $11, online = $12, security_money = $13, remark = $14,
             seat_id = $15, shift_id = $16,
             changed_at = NOW()
         WHERE id = $17`,
        [
          name, email, phone, address,
          membership_start, membership_end, status,
          totalFeeValue, amountPaidValue, dueAmountValue,
          cashValue, onlineValue, securityMoneyValue, remark || '',
          seatIdNum, firstShiftId,
          historyId
        ]
      );

      await client.query('COMMIT'); // Commit transaction

      // Return the updated student
      res.json({ 
        student: {
          ...updatedStudent,
          membership_start: new Date(updatedStudent.membership_start).toISOString().split('T')[0],
          membership_end: new Date(updatedStudent.membership_end).toISOString().split('T')[0],
          total_fee: parseFloat(updatedStudent.total_fee || 0),
          amount_paid: parseFloat(updatedStudent.amount_paid || 0),
          due_amount: parseFloat(updatedStudent.due_amount || 0),
          cash: parseFloat(updatedStudent.cash || 0),
          online: parseFloat(updatedStudent.online || 0),
          security_money: parseFloat(updatedStudent.security_money || 0),
          remark: updatedStudent.remark || '',
        }
      });
    } catch (err) {
      await client.query('ROLLBACK'); // Roll back transaction on error
      console.error('Error updating student:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  // DELETE a student
  router.delete('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      await pool.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
      await pool.query('DELETE FROM student_membership_history WHERE student_id = $1', [id]);
      const del = await pool.query('DELETE FROM students WHERE id = $1 RETURNING *', [id]);
      if (!del.rows[0]) {
        return res.status(404).json({ message: 'Student not found' });
      }
      return res.json({ message: 'Student deleted', student: del.rows[0] });
    } catch (err) {
      console.error('DELETE /students/:id error:', err);
      return res.status(500).json({ message: 'Server error deleting student', error: err.message });
    }
  });

  // GET dashboard stats
  router.get('/stats/dashboard', checkAdmin, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);

      let params = [startOfMonth, endOfMonth];
      let totalCollectionQuery = `SELECT COALESCE(SUM(s.amount_paid), 0) AS total FROM students s WHERE s.created_at BETWEEN $1 AND $2`;
      let totalDueQuery = `SELECT COALESCE(SUM(s.due_amount), 0) AS total FROM students s WHERE s.created_at BETWEEN $1 AND $2`;
      let totalExpenseQuery = `SELECT COALESCE(SUM(e.amount), 0) AS total FROM expenses e WHERE e.date BETWEEN $1 AND $2`;

      if (branchIdNum) {
        totalCollectionQuery += ` AND s.branch_id = $3`;
        totalDueQuery += ` AND s.branch_id = $3`;
        totalExpenseQuery += ` AND e.branch_id = $3`;
        params.push(branchIdNum);
      }

      const totalCollectionResult = await pool.query(totalCollectionQuery, params);
      const totalDueResult = await pool.query(totalDueQuery, params);
      const totalExpenseResult = await pool.query(totalExpenseQuery, params);

      const totalCollection = parseFloat(totalCollectionResult.rows[0].total);
      const totalExpense = parseFloat(totalExpenseResult.rows[0].total);
      const profitLoss = totalCollection - totalExpense;

      res.json({
        totalCollection: totalCollection,
        totalDue: parseFloat(totalDueResult.rows[0].total),
        totalExpense: totalExpense,
        profitLoss: profitLoss
      });
    } catch (err) {
      console.error('Error in students/stats/dashboard route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  // POST renew a student's membership
  router.post('/:id/renew', checkAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const {
        membership_start, membership_end, email, phone, branch_id, seat_id, shift_ids,
        total_fee, cash, online, security_money, remark
      } = req.body;

      if (!membership_start || !membership_end) {
        return res.status(400).json({ message: 'membership_start and membership_end are required' });
      }

      const branchIdNum = branch_id ? parseInt(branch_id, 10) : null;
      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? shift_ids.map(id => parseInt(id, 10)) : [];

      const cur = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
      if (!cur.rows[0]) {
        return res.status(404).json({ message: 'Student not found' });
      }
      const old = cur.rows[0];

      const feeValue = parseFloat(total_fee || old.total_fee || 0);
      if (isNaN(feeValue) || feeValue < 0) {
        return res.status(400).json({ message: 'Total fee must be a valid non-negative number' });
      }
      const cashValue = parseFloat(cash || 0);
      const onlineValue = parseFloat(online || 0);
      const securityMoneyValue = parseFloat(security_money || old.security_money || 0);
      if (isNaN(cashValue) || cashValue < 0) {
        return res.status(400).json({ message: 'Cash must be a valid non-negative number' });
      }
      if (isNaN(onlineValue) || onlineValue < 0) {
        return res.status(400).json({ message: 'Online payment must be a valid non-negative number' });
      }
      if (isNaN(securityMoneyValue) || securityMoneyValue < 0) {
        return res.status(400).json({ message: 'Security money must be a valid non-negative number' });
      }

      const amount_paid = cashValue + onlineValue;
      const due = feeValue - amount_paid;

      if (seatIdNum && shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          const checkAssignment = await pool.query(
            'SELECT 1 FROM seat_assignments WHERE seat_id = $1 AND shift_id = $2 AND student_id != $3',
            [seatIdNum, shiftId, id]
          );
          if (checkAssignment.rows.length > 0) {
            return res.status(400).json({ message: `Seat is already assigned for shift ${shiftId}` });
          }
        }
      }

      const upd = await pool.query(
        `UPDATE students
         SET membership_start = $1,
             membership_end   = $2,
             status           = 'active',
             email            = COALESCE($3, email),
             phone            = COALESCE($4, phone),
             branch_id        = COALESCE($5, branch_id),
             total_fee        = $6,
             amount_paid      = $7,
             due_amount       = $8,
             cash             = $9,
             online           = $10,
             security_money   = $11,
             remark           = $12
         WHERE id = $13
         RETURNING *`,
        [
          membership_start, membership_end, email, phone, branchIdNum,
          feeValue, amount_paid, due, cashValue, onlineValue,
          securityMoneyValue, remark || null, id
        ]
      );
      const updated = upd.rows[0];

      let firstShiftId = null;
      if (seatIdNum && shiftIdsNum.length > 0) {
        await pool.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
        for (const shiftId of shiftIdsNum) {
          await pool.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, id]
          );
          if (!firstShiftId) firstShiftId = shiftId;
        }
      }

      await pool.query(
        `INSERT INTO student_membership_history (
          student_id, name, email, phone, address,
          membership_start, membership_end, status,
          total_fee, amount_paid, due_amount,
          cash, online, security_money, remark,
          seat_id, shift_id,
          changed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())`,
        [
          updated.id, updated.name, updated.email, updated.phone, updated.address,
          updated.membership_start, updated.membership_end, updated.status,
          updated.total_fee, updated.amount_paid, updated.due_amount,
          updated.cash, updated.online, updated.security_money, updated.remark || '',
          seatIdNum, firstShiftId
        ]
      );

      res.json({
        message: 'Membership renewed',
        student: {
          ...updated,
          total_fee: parseFloat(updated.total_fee || 0),
          amount_paid: parseFloat(updated.amount_paid || 0),
          due_amount: parseFloat(updated.due_amount || 0),
          cash: parseFloat(updated.cash || 0),
          online: parseFloat(updated.online || 0),
          security_money: parseFloat(updated.security_money || 0),
          remark: updated.remark || '',
        }
      });
    } catch (err) {
      console.error('Error in students/:id/renew route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  });

  return router;
};