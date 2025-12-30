import db from "../db/index.js";

export async function addReminder({ phone, message, datetime }) {
  const query = `
    INSERT INTO reminders (phone, message, datetime, sent)
    VALUES (?, ?, ?, false)
  `;
  await db.run(query, [phone, message, datetime]);
}

export async function getUserReminders(phone) {
  const query = `
    SELECT * FROM reminders 
    WHERE phone = ? AND sent = false 
    ORDER BY datetime ASC
  `;
  return await db.all(query, [phone]);
}

export async function deleteUserReminder(phone, index) {
  const reminders = await getUserReminders(phone);

  if (reminders[index - 1]) {
    const query = `DELETE FROM reminders WHERE id = ?`;
    await db.run(query, [reminders[index - 1].id]);
  }
}

export async function getPendingReminders() {
  const now = new Date().toISOString();
  const query = `
    SELECT * FROM reminders 
    WHERE datetime <= ? AND sent = false
  `;
  return await db.all(query, [now]);
}

export async function markAsSent(id) {
  const query = `UPDATE reminders SET sent = true WHERE id = ?`;
  await db.run(query, [id]);
}
