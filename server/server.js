const express = require("express");
const mysql = require("mysql2/promise");
const moment = require("moment-timezone");
const { dbConfig } = require("./dbConfig.js");
const app = express();
app.use(express.json());

// Create a connection pool
const pool = mysql.createPool(dbConfig);

// Function to get appointment details for a doctor
async function getAppointmentDetailsForPocView(pocId, clientId) {
  try {
    const query1 = `SELECT * FROM poc_available_slots WHERE POC_ID = ? AND (Schedule_Date > CURDATE() OR (Schedule_Date = CURDATE() AND Start_Time >= CURTIME())) ORDER BY Schedule_Date, Start_Time`;
    const query2 = `SELECT * FROM poc_schedules WHERE POC_ID = ?`;
    const query3 = `SELECT Client_Name FROM client WHERE Client_ID = ?`;
    const query4 = `SELECT POC_Name, Specialization FROM poc WHERE POC_ID = ? AND Client_ID=?`;

    const [availableSlots] = await pool.execute(query1, [pocId]);
    const [schedules] = await pool.execute(query2, [pocId]);
    const [client] = await pool.execute(query3, [clientId]);
    const [poc] = await pool.execute(query4, [pocId, clientId]);

    const appointmentDetails = [];
    let sNo = 1;
    availableSlots.forEach((slot, index) => {
      const schedule = schedules.find(
        (schedule) =>
          schedule.Day_of_Week === getDayOfWeek(slot.Schedule_Date) &&
          schedule.Start_Time <= slot.Start_Time &&
          schedule.End_Time >= slot.End_Time
      );
      if (schedule) {
        const appointmentsCount =
          schedule.appointments_per_slot - slot.appointments_per_slot;
        const date = moment(slot.Schedule_Date);
        const time = moment(slot.Start_Time, "HH:mm:ss");
        const currentTime = moment();
        const appointmentTime = moment(
          `${slot.Schedule_Date} ${slot.Start_Time}`,
          "YYYY-MM-DD HH:mm:ss"
        );

        if (appointmentsCount > 0) {
          appointmentDetails.push({
            sNo: sNo++,
            date: date.format("YYYY-MM-DD"),
            day: date.format("dddd"),
            time: time.format("HH:mm:ss"),
            noOfAppointments: appointmentsCount,
            totalSlots: schedule.appointments_per_slot,
          });
        }
      }
    });

    return {
      appointmentDetails,
      clientName: client[0].Client_Name,
      pocName: poc[0].POC_Name,
      pocSpecialization: poc[0].Specialization,
    };
  } catch (err) {
    console.error("Error fetching appointment details:", err.message);
    throw err;
  }
}

// Helper function to get the day of the week from a date
function getDayOfWeek(date) {
  const dayOfWeek = new Date(date).getDay();
  switch (dayOfWeek) {
    case 0:
      return "Sunday";
    case 1:
      return "Monday";
    case 2:
      return "Tuesday";
    case 3:
      return "Wednesday";
    case 4:
      return "Thursday";
    case 5:
      return "Friday";
    case 6:
      return "Saturday";
  }
}

// API endpoint to get appointment details for a doctor
app.get("/api/appointments/:clientId", async (req, res) => {
  try {
    const pocId = 1; // Hardcoded doctor ID
    const clientId = req.params.clientId;
    const data = await getAppointmentDetailsForPocView(pocId, clientId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: "Error fetching appointment details" });
  }
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
