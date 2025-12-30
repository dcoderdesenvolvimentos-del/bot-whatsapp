if (
  userData.stage === "active" &&
  [
    "oi",
    "olá",
    "boa noite",
    "bom dia",
    "boa tarde",
    "oi mario",
    "ola mario",
    "opa",
    "e ai",
    "iae",
    "fala campeão",
  ].includes(normalized)
) {
  return (
    `👋 *Oi, ${name}!*\n\n` +
    `Em que posso te ajudar? 😊\n\n` +
    `• Criar lembretes\n` +
    `• Listar lembretes\n`
  );
}
