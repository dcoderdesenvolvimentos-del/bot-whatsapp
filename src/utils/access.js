export function temAcesso(user) {
  const agora = new Date();

  // Premium ativo
  if (user.premium && user.expiresAt) {
    const expiracao = user.expiresAt.toDate();
    return expiracao > agora;
  }

  // Trial ativo
  if (user.trialEndsAt) {
    const trial = user.trialEndsAt.toDate();
    return trial > agora;
  }

  return false;
}
