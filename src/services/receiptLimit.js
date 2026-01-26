import { db } from "../config/firebase.js";

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export async function canUseReceipt(userId, limit = 30) {
  const ref = db.collection("users").doc(userId);
  const snap = await ref.get();
  const month = getCurrentMonth();

  if (!snap.exists) {
    await ref.set(
      {
        receipt_usage: { month, count: 1 },
      },
      { merge: true }
    );
    return true;
  }

  const usage = snap.data().receipt_usage;

  if (!usage || usage.month !== month) {
    await ref.set(
      {
        receipt_usage: { month, count: 1 },
      },
      { merge: true }
    );
    return true;
  }

  if (usage.count >= limit) return false;

  await ref.update({
    "receipt_usage.count": usage.count + 1,
  });

  return true;
}
