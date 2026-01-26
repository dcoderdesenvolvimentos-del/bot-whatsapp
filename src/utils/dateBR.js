import { Timestamp } from "firebase-admin/firestore";

export function getHojeRangeBR() {
  const agoraBR = new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Sao_Paulo",
    }),
  );

  const inicio = new Date(agoraBR);
  inicio.setHours(0, 0, 0, 0);

  const fim = new Date(agoraBR);
  fim.setHours(23, 59, 59, 999);

  return {
    inicio: Timestamp.fromDate(inicio),
    fim: Timestamp.fromDate(fim),
  };
}
