const pendingConfirmations = new Map();
const pendingName = new Map();

export function setConfirmation(user, action) {
  pendingConfirmations.set(user, action);
}

export function getConfirmation(user) {
  return pendingConfirmations.get(user);
}

export function clearConfirmation(user) {
  pendingConfirmations.delete(user);
}

// 👇 NOVO (nome)
export function askName(user) {
  pendingName.set(user, true);
}

export function isAskingName(user) {
  return pendingName.has(user);
}

export function clearAskName(user) {
  pendingName.delete(user);
}
