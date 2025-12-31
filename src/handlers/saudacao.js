export async function responderSaudacao(userData) {
  const userData = await getUser(user);
  const name = userData?.name || "";

  const hora = new Date().getHours();
  let saudacao = "👋 Olá";

  if (hora >= 6 && hora < 12) saudacao = "☀️ Bom dia";
  else if (hora >= 12 && hora < 18) saudacao = "🌤️ Boa tarde";
  else saudacao = "🌙 Boa noite";

  return (
    `👋 *Oi, ${name}!*\n\n` +
    "Relaxa 😊 eu te ajudo a não esquecer de nada.\n\n" +
    "📌 É só me dizer:\n" +
    "• me lembra daqui 10 minutos\n" +
    "• amanhã às 17h30 ir à academia\n" +
    "• listar ou excluir lembretes\n\n" +
    "🎤 Pode mandar áudio ou texto. Eu entendo 😉"
  );
}
