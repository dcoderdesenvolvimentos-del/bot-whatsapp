import { createReminder } from "../handlers/createReminder.js";
import { listReminders } from "../handlers/listReminders.js";
import { deleteReminder } from "../handlers/deleteReminder.js";
import { smallTalk } from "../handlers/smallTalk.js";
import { help } from "../handlers/help.js";

export const intentMap = {
  criar_lembrete: createReminder,
  listar_lembretes: listReminders,
  excluir_lembrete: deleteReminder,
  piada: smallTalk,
  conversa_solta: smallTalk,
  ajuda: help,
  desconhecido: help,
};