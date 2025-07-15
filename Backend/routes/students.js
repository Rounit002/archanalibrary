module.exports = (pool) => {
  const router = require('express').Router();
  const { checkAdmin, checkAdminOrStaff } = require('./auth');

  // Helper function to add dynamic status to query
  const withCalculatedStatus = (selectFields = 's.*') => `
    SELECT
      ${selectFields},
      -- Prioritize 'deactivated' status if set directly in the table
      CASE
        WHEN s.status = 'deactivated' THEN 'deactivated'
        WHEN s.membership_end < CURRENT_DATE THEN 'expired'
        ELSE 'active'
      END AS status
    FROM students s
  `;

  // GET all students
  router.get('/', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;

      let query = `
        SELECT
          s.id,
          s.name,
          s.phone,
          TO_CHAR(s.membership_end, 'YYYY-MM-DD') AS "membershipEnd",
          TO_CHAR(s.created_at, 'YYYY-MM-DD') AS "createdAt",
          -- This CASE statement correctly prioritizes 'deactivated' status
          CASE
            WHEN s.status = 'deactivated' THEN 'deactivated'
            WHEN s.membership_end < CURRENT_DATE THEN 'expired'
            ELSE 'active'
          END AS status,
          (SELECT seats.seat_number
           FROM seat_assignments sa
           LEFT JOIN seats ON sa.seat_id = seats.id
           WHERE sa.student_id = s.id
           ORDER BY sa.id
           LIMIT 1) AS "seatNumber"
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

  // GET active students
  router.get('/active', checkAdminOrStaff, async (req, res) => {
    try {
      const { branchId } = req.query;
      const branchIdNum = branchId ? parseInt(branchId, 10) : null;
      let query = withCalculatedStatus();
      const params = [];

      // The WHERE clause correctly gets active students
      query += ` WHERE s.status != 'deactivated' AND s.membership_end >= CURRENT_DATE`;
      
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

  // GET expired students
router.get('/expired', checkAdminOrStaff, async (req, res) => {
  try {
    const { branchId } = req.query;
    const branchIdNum = branchId ? parseInt(branchId, 10) : null;
    let query = withCalculatedStatus(`
      s.id,
      s.name,
      s.email,
      s.phone,
      TO_CHAR(s.membership_end, 'YYYY-MM-DD') AS "membershipEnd",
      s.membership_start,
      s.total_fee,
      s.cash,
      s.online,
      s.security_money,
      s.remark,
      s.branch_id AS "branchId",
      (SELECT seats.seat_number
       FROM seat_assignments sa
       LEFT JOIN seats ON sa.seat_id = seats.id
       WHERE sa.student_id = s.id
       ORDER BY sa.id
       LIMIT 1) AS "seatNumber"
    `);
    const params = [];

    // This correctly excludes deactivated students from the expired list
    query += ` WHERE s.status != 'deactivated' AND s.membership_end < CURRENT_DATE`; 
    if (branchIdNum) {
      query += ` AND s.branch_id = $1`;
      params.push(branchIdNum);
    }
    query += ` ORDER BY s.name`;

    const result = await pool.query(query, params);
    const students = result.rows.map(student => ({
      ...student,
      membership_start: student.membership_start ? new Date(student.membership_start).toISOString().split('T')[0] : null,
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

      query += ` WHERE s.status = 'active' AND s.membership_end >= CURRENT_DATE AND s.membership_end <= $1`; // Only active students expiring soon

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

  // GET a single student by ID
  router.get('/:id', checkAdminOrStaff, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      const queryText = `
        SELECT
          s.*,
          b.name AS branch_name,
          CASE
            WHEN s.status = 'deactivated' THEN 'deactivated'
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

      // Fetch assignments with the latest membership_id
      const latestMembership = await pool.query(
        'SELECT id FROM student_membership_history WHERE student_id = $1 ORDER BY changed_at DESC LIMIT 1',
        [id]
      );
      const latestMembershipId = latestMembership.rows[0]?.id;

      const assignments = await pool.query(`
        SELECT
          sa.seat_id,
          sa.shift_id,
          COALESCE(seats.seat_number, 'N/A') AS seat_number,
          sch.title AS shift_title
        FROM seat_assignments sa
        LEFT JOIN seats ON sa.seat_id = seats.id
        LEFT JOIN schedules sch ON sa.shift_id = sch.id
        WHERE sa.student_id = $1
        UNION
        SELECT
          NULL AS seat_id,
          msa.shift_id,
          NULL AS seat_number,
          sch.title AS shift_title
        FROM membership_shift_assignments msa
        JOIN student_membership_history smh ON msa.membership_id = smh.id
        JOIN schedules sch ON msa.shift_id = sch.id
        WHERE smh.student_id = $1 AND msa.membership_id = $2
        ORDER BY shift_id DESC
      `, [id, latestMembershipId]);

      res.json({
        ...studentData,
        membership_start: new Date(studentData.membership_start).toISOString().split('T')[0],
        membership_end: studentData.membership_end ? new Date(studentData.membership_end).toISOString().split('T')[0] : null, // Handle null
        total_fee: parseFloat(studentData.total_fee || 0),
        amount_paid: parseFloat(studentData.amount_paid || 0),
        due_amount: parseFloat(studentData.due_amount || 0),
        cash: parseFloat(studentData.cash || 0),
        online: parseFloat(studentData.online || 0),
        security_money: parseFloat(studentData.security_money || 0),
        remark: studentData.remark || '',
        assignments: assignments.rows.map(row => ({
          seatId: row.seat_id,
          shiftId: row.shift_id,
          seatNumber: row.seat_number === 'N/A' ? null : row.seat_number,
          shiftTitle: row.shift_title
        }))
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
            WHEN s.status = 'deactivated' THEN 'deactivated'
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
          query += ` AND s.status = 'active' AND s.membership_end >= CURRENT_DATE`;
        } else if (statusFilter === 'expired') {
          query += ` AND s.status != 'deactivated' AND s.membership_end < CURRENT_DATE`;
        } else if (statusFilter === 'deactivated') { // Added this
          query += ` AND s.status = 'deactivated'`;
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

      if (!name || !branch_id || !membership_start || !membership_end) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Required fields missing (name, branch_id, membership_start, membership_end)' });
      }

      const branchIdNum = parseInt(branch_id, 10);
      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? [...new Set(shift_ids.map(id => parseInt(id, 10)))].filter(id => !isNaN(id)) : [];

      const feeValue = parseFloat(total_fee || 0);
      const paidValue = parseFloat(amount_paid || 0);
      if (isNaN(feeValue) || feeValue < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Total fee must be a valid non-negative number' });
      }
      if (isNaN(paidValue) || paidValue < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Amount paid must be a valid non-negative number' });
      }

      const cashValue = cash !== undefined ? parseFloat(cash) : 0;
      const onlineValue = online !== undefined ? parseFloat(online) : 0;
      const securityMoneyValue = security_money !== undefined ? parseFloat(security_money) : 0;

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

      const dueAmount = feeValue - paidValue;

      if (seatIdNum && shiftIdsNum.length > 0) {
        const seatCheck = await client.query('SELECT 1 FROM seats WHERE id = $1 AND branch_id = $2', [seatIdNum, branchIdNum]);
        if (seatCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Seat with ID ${seatIdNum} does not exist or does not belong to selected branch` });
        }

        for (const shiftId of shiftIdsNum) {
          const shiftCheck = await client.query('SELECT 1 FROM schedules WHERE id = $1', [shiftId]);
          if (shiftCheck.rows.length === 0) {
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
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Seat is already assigned for shift ${shiftId}` });
          }
        }
      }

      const initialStatus = new Date(membership_end) < new Date() ? 'expired' : 'active';

      const result = await client.query(
        `INSERT INTO students (
          name, email, phone, address, branch_id, membership_start, membership_end,
          total_fee, amount_paid, due_amount, cash, online, security_money, remark, profile_image_url, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *`,
        [
          name, email, phone, address, branchIdNum, membership_start, membership_end,
          feeValue, paidValue, dueAmount, cashValue, onlineValue, securityMoneyValue, remark || null, profile_image_url || null, initialStatus
        ]
      );
      const student = result.rows[0];

      if (shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, student.id]
          );
        }
      }

      const historyResult = await client.query(
        `INSERT INTO student_membership_history (
          student_id, name, email, phone, address,
          membership_start, membership_end, status,
          total_fee, amount_paid, due_amount,
          cash, online, security_money, remark,
          seat_id, branch_id,
          changed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
        RETURNING id`,
        [
          student.id, student.name, student.email, student.phone, student.address,
          student.membership_start, student.membership_end, student.status,
          student.total_fee, student.amount_paid, student.due_amount,
          student.cash, student.online, student.security_money, student.remark || '',
          seatIdNum, branchIdNum
        ]
      );

      const membershipId = historyResult.rows[0].id;

      if (shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO membership_shift_assignments (membership_id, shift_id) VALUES ($1, $2)',
            [membershipId, shiftId]
          );
        }
      }

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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const id = parseInt(req.params.id, 10);
      const {
        name, email, phone, address, branch_id, membership_start, membership_end,
        total_fee, amount_paid, shift_ids, seat_id, cash, online, security_money, remark
      } = req.body;

      if (!name || !email || !phone || !address || !branch_id || !membership_start || !membership_end) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Required fields missing' });
      }

      const branchIdNum = parseInt(branch_id, 10);
      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? [...new Set(shift_ids.map(id => parseInt(id, 10)))].filter(id => !isNaN(id)) : [];

      const currentStudentRes = await client.query(
        `SELECT total_fee, amount_paid, due_amount, cash, online, security_money, status
         FROM students
         WHERE id = $1`,
        [id]
      );

      if (currentStudentRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }

      const currentStudent = currentStudentRes.rows[0];

      const totalFeeValue = total_fee !== undefined ? parseFloat(total_fee) : parseFloat(currentStudent.total_fee || 0);
      const amountPaidValue = amount_paid !== undefined ? parseFloat(amount_paid) : parseFloat(currentStudent.amount_paid || 0);
      const cashValue = cash !== undefined ? parseFloat(cash) : parseFloat(currentStudent.cash || 0);
      const onlineValue = online !== undefined ? parseFloat(online) : parseFloat(currentStudent.online || 0);
      const securityMoneyValue = security_money !== undefined ? parseFloat(security_money) : parseFloat(currentStudent.security_money || 0);

      const dueAmountValue = totalFeeValue - amountPaidValue;
      const newStatus = currentStudent.status === 'deactivated' ? 'deactivated' : (new Date(membership_end) < new Date() ? 'expired' : 'active');

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
          securityMoneyValue, remark || null, newStatus, id
        ]
      );

      const updatedStudent = result.rows[0];

      const historyRes = await client.query(
        'SELECT id FROM student_membership_history WHERE student_id = $1 ORDER BY changed_at DESC LIMIT 1',
        [id]
      );

      let membershipId;
      if (historyRes.rows.length > 0) {
        membershipId = historyRes.rows[0].id;
        await client.query(
          `UPDATE student_membership_history
           SET name = $1, email = $2, phone = $3, address = $4,
               membership_start = $5, membership_end = $6, status = $7,
               total_fee = $8, amount_paid = $9, due_amount = $10,
               cash = $11, online = $12, security_money = $13, remark = $14,
               seat_id = $15, branch_id = $16,
               changed_at = NOW()
           WHERE id = $17`,
          [
            name, email, phone, address,
            membership_start, membership_end, newStatus,
            totalFeeValue, amountPaidValue, dueAmountValue,
            cashValue, onlineValue, securityMoneyValue, remark || null,
            seatIdNum, branchIdNum,
            membershipId
          ]
        );
      }

      await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
      if (shiftIdsNum.length > 0) {
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, id]
          );
        }
      }

      await client.query('DELETE FROM membership_shift_assignments WHERE membership_id IN (SELECT id FROM student_membership_history WHERE student_id = $1)', [id]);
      if (shiftIdsNum.length > 0 && membershipId) {
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO membership_shift_assignments (membership_id, shift_id) VALUES ($1, $2)',
            [membershipId, shiftId]
          );
        }
      }

      await client.query('COMMIT');

      res.json({
        student: {
          ...updatedStudent,
          membership_start: new Date(updatedStudent.membership_start).toISOString().split('T')[0],
          membership_end: updatedStudent.membership_end ? new Date(updatedStudent.membership_end).toISOString().split('T')[0] : null,
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
      await client.query('ROLLBACK');
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
      await pool.query('DELETE FROM membership_shift_assignments WHERE membership_id IN (SELECT id FROM student_membership_history WHERE student_id = $1)', [id]);
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
      let totalCollectionQuery = `SELECT COALESCE(SUM(s.amount_paid), 0) AS total FROM student_membership_history s WHERE s.changed_at BETWEEN $1 AND $2`;
      let totalDueQuery = `SELECT COALESCE(SUM(s.due_amount), 0) AS total FROM student_membership_history s WHERE s.changed_at BETWEEN $1 AND $2`;
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const id = parseInt(req.params.id, 10);
      const {
        membership_start, membership_end, email, phone, branch_id, seat_id, shift_ids,
        total_fee, cash, online, security_money, remark
      } = req.body;

      if (!membership_start || !membership_end) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'membership_start and membership_end are required' });
      }

      const branchIdNum = branch_id ? parseInt(branch_id, 10) : null;
      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? [...new Set(shift_ids.map(id => parseInt(id, 10)))].filter(id => !isNaN(id)) : [];

      const cur = await client.query('SELECT * FROM students WHERE id = $1', [id]);
      if (!cur.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }
      const old = cur.rows[0];

      const feeValue = parseFloat(total_fee || old.total_fee || 0);
      const cashValue = parseFloat(cash || 0);
      const onlineValue = parseFloat(online || 0);
      const securityMoneyValue = parseFloat(security_money || old.security_money || 0);

      const amount_paid = cashValue + onlineValue;
      const due = feeValue - amount_paid;

      if (seatIdNum && shiftIdsNum.length > 0) {
        const seatCheck = await client.query('SELECT 1 FROM seats WHERE id = $1 AND branch_id = $2', [seatIdNum, branchIdNum]);
        if (seatCheck.rows.length === 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ message: `Seat with ID ${seatIdNum} does not exist or does not belong to selected branch` });
        }

        for (const shiftId of shiftIdsNum) {
          const shiftCheck = await client.query('SELECT 1 FROM schedules WHERE id = $1', [shiftId]);
          if (shiftCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Shift with ID ${shiftId} does not exist` });
          }
        }

        const currentAssignments = await client.query(
          'SELECT shift_id FROM seat_assignments WHERE student_id = $1 AND seat_id = $2',
          [id, seatIdNum]
        );
        const currentShiftIds = currentAssignments.rows.map(row => row.shift_id);

        for (const shiftId of shiftIdsNum) {
          const checkAssignment = await client.query(
            'SELECT 1 FROM seat_assignments WHERE seat_id = $1 AND shift_id = $2 AND student_id != $3',
            [seatIdNum, shiftId, id]
          );
          if (checkAssignment.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Seat is already assigned to another student for shift ${shiftId}` });
          }
          if (!currentShiftIds.includes(shiftId)) {
            const isAssigned = await client.query(
              'SELECT 1 FROM seat_assignments WHERE seat_id = $1 AND shift_id = $2',
              [seatIdNum, shiftId]
            );
            if (isAssigned.rows.length > 0) {
              await client.query('ROLLBACK');
              return res.status(400).json({ message: `Seat is already assigned for shift ${shiftId}` });
            }
          }
        }
      }

      const upd = await client.query(
        `UPDATE students
         SET membership_start = $1,
             membership_end   = $2,
             status           = 'active', -- Renewal always sets status to active
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

      if (shiftIdsNum.length > 0) {
        await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, id]
          );
        }
      } else {
        await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
      }

      const historyResult = await client.query(
        `INSERT INTO student_membership_history (
          student_id, name, email, phone, address,
          membership_start, membership_end, status,
          total_fee, amount_paid, due_amount,
          cash, online, security_money, remark,
          seat_id, branch_id,
          changed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
        RETURNING id`,
        [
          updated.id, updated.name, updated.email, updated.phone, updated.address,
          updated.membership_start, updated.membership_end, updated.status,
          updated.total_fee, updated.amount_paid, updated.due_amount,
          updated.cash, updated.online, updated.security_money, updated.remark || '',
          seatIdNum, branchIdNum
        ]
      );

      const membershipId = historyResult.rows[0].id;

      if (shiftIdsNum.length > 0 && membershipId) {
        await client.query('DELETE FROM membership_shift_assignments WHERE membership_id IN (SELECT id FROM student_membership_history WHERE student_id = $1)', [id]);
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO membership_shift_assignments (membership_id, shift_id) VALUES ($1, $2)',
            [membershipId, shiftId]
          );
        }
      }

      await client.query('COMMIT');

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
      await client.query('ROLLBACK');
      console.error('Error in students/:id/renew route:', err.stack);
      res.status(500).json({ message: 'Server error', error: err.message });
    } finally {
      client.release();
    }
  });

  // PUT deactivate a student
  router.put('/:id/deactivate', checkAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const id = parseInt(req.params.id, 10);

      const updatedStudentResult = await client.query(
        `UPDATE students
         SET status = 'deactivated',
             membership_end = CURRENT_DATE,
             remark = COALESCE(remark, '') || ' [Deactivated on ' || NOW()::date || ']'
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      if (updatedStudentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }

      const deactivatedStudent = updatedStudentResult.rows[0];

      await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
      
      const studentDataForHistory = deactivatedStudent;

      const historyInsert = await client.query(
        `INSERT INTO student_membership_history (
          student_id, name, email, phone, address,
          membership_start, membership_end, status,
          total_fee, amount_paid, due_amount,
          cash, online, security_money, remark,
          seat_id, branch_id,
          changed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())`,
        [
          studentDataForHistory.id, studentDataForHistory.name, studentDataForHistory.email, studentDataForHistory.phone, studentDataForHistory.address,
          studentDataForHistory.membership_start, new Date().toISOString().split('T')[0], 'deactivated',
          studentDataForHistory.total_fee, studentDataForHistory.amount_paid, studentDataForHistory.due_amount,
          studentDataForHistory.cash, studentDataForHistory.online, studentDataForHistory.security_money, studentDataForHistory.remark || '',
          null, studentDataForHistory.branch_id
        ]
      );

      await client.query('DELETE FROM membership_shift_assignments WHERE membership_id IN (SELECT id FROM student_membership_history WHERE student_id = $1)', [id]);

      await client.query('COMMIT');

      res.json({
        message: 'Student deactivated successfully',
        student: {
          ...deactivatedStudent,
          status: 'deactivated',
          membership_end: new Date().toISOString().split('T')[0],
          total_fee: parseFloat(deactivatedStudent.total_fee || 0),
          amount_paid: parseFloat(deactivatedStudent.amount_paid || 0),
          due_amount: parseFloat(deactivatedStudent.due_amount || 0),
          cash: parseFloat(deactivatedStudent.cash || 0),
          online: parseFloat(deactivatedStudent.online || 0),
          security_money: parseFloat(deactivatedStudent.security_money || 0),
          remark: deactivatedStudent.remark || '',
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error deactivating student:', err.stack);
      res.status(500).json({ message: 'Server error deactivating student', error: err.message });
    } finally {
      client.release();
    }
  });

  // PUT activate a student
  router.put('/:id/activate', checkAdmin, async (req, res) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const id = parseInt(req.params.id, 10);
      const { membership_start, membership_end, seat_id, shift_ids } = req.body;

      if (!membership_start || !membership_end) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Membership start and end dates are required for activation.' });
      }

      const seatIdNum = seat_id ? parseInt(seat_id, 10) : null;
      const shiftIdsNum = shift_ids && Array.isArray(shift_ids) ? [...new Set(shift_ids.map(id => parseInt(id, 10)))].filter(id => !isNaN(id)) : [];

      const updatedStudentResult = await client.query(
        `UPDATE students
         SET status = 'active',
             membership_start = $1,
             membership_end = $2,
             remark = REPLACE(remark, ' [Deactivated on ' || (SELECT created_at::date FROM student_membership_history WHERE student_id = $3 AND status = 'deactivated' ORDER BY created_at DESC LIMIT 1) || ']', '')
         WHERE id = $3
         RETURNING *`,
        [membership_start, membership_end, id]
      );

      if (updatedStudentResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Student not found' });
      }

      const activatedStudent = updatedStudentResult.rows[0];

      await client.query('DELETE FROM seat_assignments WHERE student_id = $1', [id]);
      if (seatIdNum && shiftIdsNum.length > 0) {
        const branchId = activatedStudent.branch_id;
        const seatCheck = await client.query('SELECT 1 FROM seats WHERE id = $1 AND branch_id = $2', [seatIdNum, branchId]);
        if (seatCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ message: `Seat with ID ${seatIdNum} does not exist or does not belong to the student's branch.` });
        }
        for (const shiftId of shiftIdsNum) {
            const shiftCheck = await client.query('SELECT 1 FROM schedules WHERE id = $1', [shiftId]);
            if (shiftCheck.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Shift with ID ${shiftId} does not exist.` });
            }
            const checkAssignment = await client.query(
                'SELECT 1 FROM seat_assignments WHERE seat_id = $1 AND shift_id = $2 AND student_id != $3',
                [seatIdNum, shiftId, id]
            );
            if (checkAssignment.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: `Seat ${seatIdNum} is already assigned for shift ${shiftId}.` });
            }
        }
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO seat_assignments (seat_id, shift_id, student_id) VALUES ($1, $2, $3)',
            [seatIdNum, shiftId, id]
          );
        }
      }

      const historyInsert = await client.query(
        `INSERT INTO student_membership_history (
          student_id, name, email, phone, address,
          membership_start, membership_end, status,
          total_fee, amount_paid, due_amount,
          cash, online, security_money, remark,
          seat_id, branch_id,
          changed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW())
        RETURNING id`,
        [
          activatedStudent.id, activatedStudent.name, activatedStudent.email, activatedStudent.phone, activatedStudent.address,
          activatedStudent.membership_start, activatedStudent.membership_end, 'active',
          activatedStudent.total_fee, activatedStudent.amount_paid, activatedStudent.due_amount,
          activatedStudent.cash, activatedStudent.online, activatedStudent.security_money, activatedStudent.remark || '',
          seatIdNum, activatedStudent.branch_id
        ]
      );

      const membershipId = historyInsert.rows[0].id;

      await client.query('DELETE FROM membership_shift_assignments WHERE membership_id IN (SELECT id FROM student_membership_history WHERE student_id = $1)', [id]);
      if (shiftIdsNum.length > 0 && membershipId) {
        for (const shiftId of shiftIdsNum) {
          await client.query(
            'INSERT INTO membership_shift_assignments (membership_id, shift_id) VALUES ($1, $2)',
            [membershipId, shiftId]
          );
        }
      }

      await client.query('COMMIT');

      res.json({
        message: 'Student activated successfully',
        student: {
          ...activatedStudent,
          status: 'active',
          membership_start: new Date(activatedStudent.membership_start).toISOString().split('T')[0],
          membership_end: new Date(activatedStudent.membership_end).toISOString().split('T')[0],
          total_fee: parseFloat(activatedStudent.total_fee || 0),
          amount_paid: parseFloat(activatedStudent.amount_paid || 0),
          due_amount: parseFloat(activatedStudent.due_amount || 0),
          cash: parseFloat(activatedStudent.cash || 0),
          online: parseFloat(activatedStudent.online || 0),
          security_money: parseFloat(activatedStudent.security_money || 0),
          remark: activatedStudent.remark || '',
        }
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error activating student:', err.stack);
      res.status(500).json({ message: 'Server error activating student', error: err.message });
    } finally {
      client.release();
    }
  });

  return router;
};
