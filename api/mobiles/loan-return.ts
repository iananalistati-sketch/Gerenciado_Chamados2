import { google } from "googleapis";

const CONTROL_SHEET = "tbControleMobiles";
const LOAN_SHEET = "tbEmprestimosMobiles";

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const findHeaderIndex = (
  headers: string[],
  ...possibleNames: string[]
) =>
  headers.findIndex((header) =>
    possibleNames.some(
      (name) => normalize(header) === normalize(name)
    )
  );

const toLocalIsoDateTime = () => {
  const now = new Date();
  const local = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 19);
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido.",
    });
  }

  try {
    const {
      reserveCollector,
      responsible,
      observation,
    } = req.body || {};

    const reserve = String(
      reserveCollector || ""
    ).trim();
    const returnResponsible = String(
      responsible || ""
    ).trim();

    if (!reserve) {
      return res.status(400).json({
        error: "Coletor reserva não informado.",
      });
    }

    if (!returnResponsible) {
      return res.status(400).json({
        error: "Responsável pela devolução não informado.",
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email:
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY
          ?.replace(/\\n/g, "\n")
          .replace(/^["']|["']$/g, "")
          .trim(),
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    const sheets = google.sheets({
      version: "v4",
      auth,
    });

    const spreadsheetId =
      process.env.SPREADSHEET_ID;

    if (!spreadsheetId) {
      return res.status(500).json({
        error: "SPREADSHEET_ID não configurado.",
      });
    }

    const [controlResponse, loanResponse] =
      await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${CONTROL_SHEET}!A:Z`,
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${LOAN_SHEET}!A:Z`,
        }),
      ]);

    const controlValues =
      controlResponse.data.values || [];
    const loanValues =
      loanResponse.data.values || [];

    if (controlValues.length === 0 || loanValues.length === 0) {
      return res.status(400).json({
        error:
          "As abas de controle ou empréstimos não possuem cabeçalho.",
      });
    }

    const controlHeaders = controlValues[0] || [];
    const loanHeaders = loanValues[0] || [];

    const coletorIdx = findHeaderIndex(
      controlHeaders,
      "Coletor"
    );
    const setorIdx = findHeaderIndex(
      controlHeaders,
      "Setor"
    );
    const setorLocalizadoIdx = findHeaderIndex(
      controlHeaders,
      "Setor localizado"
    );
    const statusIdx = findHeaderIndex(
      controlHeaders,
      "Status"
    );

    const loanIdIdx = findHeaderIndex(
      loanHeaders,
      "ID_EMPRESTIMO"
    );
    const loanStatusIdx = findHeaderIndex(
      loanHeaders,
      "STATUS_EMPRESTIMO"
    );
    const loanReserveIdx = findHeaderIndex(
      loanHeaders,
      "COLETOR_RESERVA"
    );
    const loanOriginalIdx = findHeaderIndex(
      loanHeaders,
      "COLETOR_SUBSTITUIDO"
    );
    const loanReturnDateIdx = findHeaderIndex(
      loanHeaders,
      "DATA_DEVOLUCAO"
    );
    const loanReturnResponsibleIdx = findHeaderIndex(
      loanHeaders,
      "RESPONSAVEL_DEVOLUCAO"
    );
    const loanObsIdx = findHeaderIndex(
      loanHeaders,
      "OBS"
    );

    if (
      coletorIdx === -1 ||
      setorIdx === -1 ||
      setorLocalizadoIdx === -1 ||
      statusIdx === -1 ||
      loanStatusIdx === -1 ||
      loanReserveIdx === -1 ||
      loanOriginalIdx === -1 ||
      loanReturnDateIdx === -1 ||
      loanReturnResponsibleIdx === -1
    ) {
      return res.status(400).json({
        error:
          "A estrutura das abas está incompatível com a finalização do empréstimo.",
      });
    }

    const openLoans = loanValues
      .slice(1)
      .map((row, index) => ({
        row,
        sheetRow: index + 2,
      }))
      .filter(({ row }) =>
        normalize(row[loanStatusIdx] || "") === "aberto" &&
        normalize(row[loanReserveIdx] || "") === normalize(reserve)
      );

    if (openLoans.length !== 1) {
      return res.status(409).json({
        error:
          openLoans.length === 0
            ? `Não existe empréstimo ABERTO para o equipamento reserva "${reserve}".`
            : `Existe mais de um empréstimo ABERTO para o equipamento reserva "${reserve}". Corrija o histórico antes de prosseguir.`,
      });
    }

    const loan = openLoans[0];
    const originalCollector = String(
      loan.row[loanOriginalIdx] || ""
    ).trim();

    const findControlRow = (collector: string) =>
      controlValues
        .slice(1)
        .map((row, index) => ({
          row,
          sheetRow: index + 2,
        }))
        .filter(({ row }) =>
          normalize(row[coletorIdx] || "") === normalize(collector)
        );

    const reserveRows = findControlRow(reserve)
      .filter(({ row }) =>
        String(row[statusIdx] || "")
          .trim()
          .toUpperCase() === "E"
      );

    const originalRows = findControlRow(originalCollector)
      .filter(({ row }) =>
        String(row[statusIdx] || "")
          .trim()
          .toUpperCase() === "M"
      );

    if (reserveRows.length !== 1) {
      return res.status(409).json({
        error:
          `Não foi encontrado exatamente um equipamento reserva com Status E para o Coletor "${reserve}".`,
      });
    }

    if (originalRows.length !== 1) {
      return res.status(409).json({
        error:
          `Não foi encontrado exatamente um equipamento em Manutenção para o Coletor original "${originalCollector}".`,
      });
    }

    const reserveControl = reserveRows[0];
    const originalControl = originalRows[0];

    const reserveUpdated = [...reserveControl.row];
    const originalUpdated = [...originalControl.row];
    const loanUpdated = [...loan.row];

    while (reserveUpdated.length < controlHeaders.length) {
      reserveUpdated.push("");
    }

    while (originalUpdated.length < controlHeaders.length) {
      originalUpdated.push("");
    }

    while (loanUpdated.length < loanHeaders.length) {
      loanUpdated.push("");
    }

    reserveUpdated[statusIdx] = "A";
    reserveUpdated[setorLocalizadoIdx] = "TI-SUPORTE";

    originalUpdated[statusIdx] = "A";

    loanUpdated[loanStatusIdx] = "FINALIZADO";
    loanUpdated[loanReturnDateIdx] =
      toLocalIsoDateTime();
    loanUpdated[loanReturnResponsibleIdx] =
      returnResponsible;

    if (
      loanObsIdx !== -1 &&
      String(observation || "").trim()
    ) {
      const previousObs = String(
        loanUpdated[loanObsIdx] || ""
      ).trim();
      const returnObs = String(
        observation || ""
      ).trim();

      loanUpdated[loanObsIdx] = previousObs
        ? `${previousObs} | Devolução: ${returnObs}`
        : `Devolução: ${returnObs}`;
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: `${CONTROL_SHEET}!A${reserveControl.sheetRow}`,
            values: [reserveUpdated],
          },
          {
            range: `${CONTROL_SHEET}!A${originalControl.sheetRow}`,
            values: [originalUpdated],
          },
          {
            range: `${LOAN_SHEET}!A${loan.sheetRow}`,
            values: [loanUpdated],
          },
        ],
      },
    });

    return res.status(200).json({
      success: true,
      loanId:
        loanIdIdx !== -1
          ? String(loan.row[loanIdIdx] || "").trim()
          : "",
      reserveCollector: reserve,
      originalCollector,
    });
  } catch (error: any) {
    console.error("ERRO MOBILE LOAN RETURN:", error);

    return res.status(500).json({
      error:
        error.message ||
        "Erro interno ao finalizar empréstimo temporário.",
    });
  }
}
