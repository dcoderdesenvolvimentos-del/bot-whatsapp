export function responderSaudacao(userData) {
  const name = userData?.name || "";

  return (
    `👋 *Oi${name ? `, ${name}` : ""}!*\n\n` +
    `Em que posso te ajudar nesse momento? 😊\n\n` +
    `📌 Exemplos:\n` +
    `• me lembra daqui 10 minutos\n` +
    `• amanhã às 17h30 ir à academia\n` +
    `• listar lembretes\n\n` +
    `🎤 Pode falar ou digitar 😉`
  );
}
