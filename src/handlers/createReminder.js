export async function createReminder(ctx, data) {
  if (!data.hora) {
    return ctx.reply("Qual horário você deseja?");
  }

  await ctx.services.reminders.add({
    user: ctx.user,
    text: data.acao,
    when: data.hora,
  });

  return ctx.reply("⏰ Lembrete criado com sucesso!");
}