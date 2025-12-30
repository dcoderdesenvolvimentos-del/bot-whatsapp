export async function listReminders(ctx) {
  const reminders = await ctx.services.reminders.list(ctx.user);

  if (!reminders.length) {
    return ctx.reply("📭 Você não tem lembretes salvos.");
  }

  const msg = reminders
    .map((r, i) => `${i + 1}. ${r.text}`)
    .join("\n");

  return ctx.reply("📋 Seus lembretes:\n" + msg);
}