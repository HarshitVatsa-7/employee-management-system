const Attendance = require('../models/Attendance');
const { Op } = require("sequelize");

// Punch In
exports.punchIn = async (req, res) => {
  if (!req.user) return res.redirect('/auth/signin'); 

  try {
    const existing = await Attendance.findOne({
      where: { user_id: req.user.id, out_time: null }
    });
    
    if (existing) {
      console.log("User already punched in");
      return res.redirect('back');
    }

    await Attendance.create({
      user_id: req.user.id,
      in_time: new Date()
    });

    return res.redirect('back');
  } catch (err) {
    console.error(err);
    return res.redirect('back');
  }
};

// Punch Out
exports.punchOut = async (req, res) => {
  if (!req.user) return res.redirect('/auth/signin');

  try {
    const record = await Attendance.findOne({
      where: { user_id: req.user.id, out_time: null },
      order: [['in_time', 'DESC']]
    });

    if (!record) {
      console.log("No active punch-in found");
      return res.redirect('back');
    }

    record.out_time = new Date();
    record.duration_seconds = Math.floor((record.out_time - record.in_time) / 1000);
    await record.save();

    return res.redirect('back');
  } catch (err) {
    console.error(err);
    return res.redirect('back');
  }
};

// Home Page Dashboard & Calendar
exports.getHome = async (req, res) => {
  const year = new Date().getFullYear();
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  try {
    const records = await Attendance.findAll({
      where: { user_id: req.user.id },
      order: [['in_time', 'DESC']]
    });

    // --- Stats Calculations ---
    const uniqueDates = new Set(records.map(r => new Date(r.in_time).toISOString().split("T")[0]));
    const presentDays = uniqueDates.size;
    const totalSeconds = records.reduce((acc, r) => acc + (r.duration_seconds || 0), 0);
    const totalHours = Math.floor(totalSeconds / 3600);
    const startOfYear = new Date(year, 0, 1);
    const today = new Date();
    const daysPassed = Math.ceil((today - startOfYear) / (1000 * 60 * 60 * 24)) + 1;
    const attendanceRate = daysPassed > 0 ? Math.round((presentDays / daysPassed) * 100) : 0;

    // --- 12-Month Calendar Data ---
    const calendarData = [];
    for (let m = 0; m < 12; m++) {
      const daysInMonth = new Date(year, m + 1, 0).getDate();
      const firstDay = new Date(year, m, 1).getDay(); // 0=Sun
      const offset = (firstDay === 0) ? 6 : firstDay - 1; // 0=Mon

      const days = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${year}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const level = uniqueDates.has(dateStr) ? 3 : 0;
        days.push({ day: d, level: level });
      }
      calendarData.push({ monthName: monthNames[m], monthIndex: m + 1, offset, days });
    }
    
    // --- 7-Day Weekly Calendar Data ---
    const weeklyData = [];
    const todayDate = new Date();
    for (let i = 6; i >= 0; i--) { // Loop from 6 days ago to today
      const day = new Date(todayDate);
      day.setDate(todayDate.getDate() - i);
      
      const dateStr = day.toISOString().split("T")[0];
      const dayName = dayNames[day.getDay()];
      const level = uniqueDates.has(dateStr) ? 3 : 0; 

      weeklyData.push({
        date: dateStr,
        dayName: dayName,
        level: level
      });
    }

    // --- Recent Records (for the "View Full" link logic) ---
    const recentRecords = records.slice(0, 5); 

    res.render("home", {
      title: "Attendance Tracker",
      user: req.user,
      recentRecords,
      presentDays,
      totalHours,
      attendanceRate,
      calendarData,
      weeklyData
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading dashboard");
  }
};

// Show Month Details
// Show Month Details
exports.getMonthDetails = async (req, res) => {
  const month = parseInt(req.params.month, 10); // 1-12
  const year = new Date().getFullYear();

  try {
    const records = await Attendance.findAll({
      where: {
        user_id: req.user.id,
        in_time: {
          [Op.between]: [
            new Date(year, month - 1, 1), // First day of the month
            new Date(year, month, 0, 23, 59, 59) // Last day of the month
          ]
        }
      },
      order: [['in_time', 'ASC']]
    });

    // --- Calculate Stats for this Month ---

    // 1. Present Days
    const presentDays = new Set(records.map(r => new Date(r.in_time).toISOString().split("T")[0])).size;

    // 2. Total Hours
    const totalSeconds = records.reduce((acc, r) => acc + (r.duration_seconds || 0), 0);
    const totalHours = Math.floor(totalSeconds / 3600);

    // 3. Attendance Rate
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentDayOfMonth = today.getDate();
    const totalDaysInMonth = new Date(year, month, 0).getDate();

    let daysForRateCalc = totalDaysInMonth; // Assume it's a past month

    if (month === currentMonth && year === today.getFullYear()) {
      // It's the current month, so only count days passed
      daysForRateCalc = currentDayOfMonth;
    } else if (month > currentMonth && year >= today.getFullYear()) {
      // It's a future month
      daysForRateCalc = 0;
    }

    const attendanceRate = (daysForRateCalc > 0) ? Math.round((presentDays / daysForRateCalc) * 100) : 0;

    res.render("attendance_month", {
      records,
      month,
      year,
      presentDays,  // Pass new stat
      totalHours,     // Pass new stat
      attendanceRate  // Pass new stat
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading month details");
  }
};

// Show Week Details
exports.getWeekDetails = async (req, res) => {
  if (!req.user) return res.redirect('/auth/signin');

  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 6); 
  
  sevenDaysAgo.setHours(0, 0, 0, 0);
  today.setHours(23, 59, 59, 999);

  try {
    const records = await Attendance.findAll({
      where: {
        user_id: req.user.id,
        in_time: {
          [Op.between]: [sevenDaysAgo, today]
        }
      },
      order: [['in_time', 'ASC']]
    });

    res.render("attendance_week", {
      title: "This Week's Attendance",
      records
    });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error loading weekly data");
  }
};