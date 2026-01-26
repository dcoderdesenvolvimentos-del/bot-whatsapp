import { Timestamp } from "firebase-admin/firestore";

const MESES = {
  janeiro: 0,
  fevereiro: 1,
  março: 2,
  marco: 2,
  abril: 3,
  maio: 4,
  junho: 5,
  julho: 6,
  agosto: 7,
  setembro: 8,
  outubro: 9,
  novembro: 10,
  dezembro: 11,
};

function getNomeMes(num) {
  const n = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];
  return n[num];
}

export function calcularPeriodo(texto) {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = hoje.getMonth();

  let inicio, fim, desc;

  // ESTA SEMANA
  if (/\b(esta|essa|da) semana\b/i.test(texto)) {
    const dia = hoje.getDay();
    const ini = new Date(hoje);
    ini.setDate(hoje.getDate() - dia);
    ini.setHours(0, 0, 0, 0);

    const fi = new Date(ini);
    fi.setDate(ini.getDate() + 6);
    fi.setHours(23, 59, 59, 999);

    inicio = Timestamp.fromDate(ini);
    fim = Timestamp.fromDate(fi);
    desc = "Esta semana";
  }

  // SEMANA PASSADA
  else if (/semana passada/i.test(texto)) {
    const dia = hoje.getDay();
    const ini = new Date(hoje);
    ini.setDate(hoje.getDate() - dia - 7);
    ini.setHours(0, 0, 0, 0);

    const fi = new Date(ini);
    fi.setDate(ini.getDate() + 6);
    fi.setHours(23, 59, 59, 999);

    inicio = Timestamp.fromDate(ini);
    fim = Timestamp.fromDate(fi);
    desc = "Semana passada";
  }

  // ESTE MÊS
  else if (/\b(este|esse|do|deste) m[eê]s\b/i.test(texto)) {
    inicio = Timestamp.fromDate(new Date(ano, mes, 1, 0, 0, 0));
    fim = Timestamp.fromDate(new Date(ano, mes + 1, 0, 23, 59, 59, 999));
    desc = `${getNomeMes(mes)}/${ano}`;
  }

  // MÊS PASSADO
  else if (/m[eê]s passado/i.test(texto)) {
    const m = mes === 0 ? 11 : mes - 1;
    const a = mes === 0 ? ano - 1 : ano;

    inicio = Timestamp.fromDate(new Date(a, m, 1, 0, 0, 0));
    fim = Timestamp.fromDate(new Date(a, m + 1, 0, 23, 59, 59, 999));
    desc = `${getNomeMes(m)}/${a}`;
  }

  // PRÓXIMO MÊS
  else if (/pr[oó]ximo m[eê]s|m[eê]s que vem/i.test(texto)) {
    const m = mes === 11 ? 0 : mes + 1;
    const a = mes === 11 ? ano + 1 : ano;

    inicio = Timestamp.fromDate(new Date(a, m, 1, 0, 0, 0));
    fim = Timestamp.fromDate(new Date(a, m + 1, 0, 23, 59, 59, 999));
    desc = `${getNomeMes(m)}/${a}`;
  }

  // MÊS ESPECÍFICO (outubro, setembro, etc)
  else {
    const textoLower = texto.toLowerCase();
    let mesEncontrado = null;

    for (const [nome, numero] of Object.entries(MESES)) {
      if (textoLower.includes(nome)) {
        mesEncontrado = numero;
        break;
      }
    }

    if (mesEncontrado !== null) {
      inicio = Timestamp.fromDate(new Date(ano, mesEncontrado, 1, 0, 0, 0));
      fim = Timestamp.fromDate(
        new Date(ano, mesEncontrado + 1, 0, 23, 59, 59, 999)
      );
      desc = `${getNomeMes(mesEncontrado)}/${ano}`;
    } else {
      return null;
    }
  }

  return { inicio, fim, descricao: desc };
}
