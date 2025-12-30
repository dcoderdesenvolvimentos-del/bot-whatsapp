export async function deleteReminder(ctx, data) {
  if (!data.indice) {
    return ctx.reply("Qual lembrete você deseja excluir?");
  }

  await ctx.services.reminders.delete(ctx.user, data.indice);
  return ctx.reply("🗑️ Lembrete excluído com sucesso.");
}