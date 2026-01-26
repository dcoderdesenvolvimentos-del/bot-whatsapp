const pending = new Map();

export function setPending(user, reminder) {
  pending.set(user, reminder);
}

export function getPending(user) {
  return pending.get(user);
}

export function clearPending(user) {
  pending.delete(user);
}
