import { getUser } from "../services/userService.js";

export function responderSaudacao(userData) {
  const name = userData?.name || "aí";

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
