import { google } from "googleapis";
import { authErrorResponse, requireRole } from "../_requireAuth.js";

const CONTROL_SHEET = "tbControleMobiles";
const LOAN_SHEET = "tbEmprestimosMobiles";
const RESERVED_TEST_COLLECTOR = "BKP-10";

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
  return new Date().toLocaleString("sv-SE", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
  }).replace(" ", "T");
};

const makeLoanId = () => {
  const now = new Date();
  const stamp = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const suffix = Math.random()
    .toString(36)
    .slice(2, 6)
    .toUpperCase();
  return `EMP${stamp}${suffix}`;
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Método não permitido.",
    });
  }

  try {
    const { decodedToken } = await requireRole(req.headers.authorization, ["admin", "analyst"]);
    const {
      originalCollector,
      reserveCollector,
      reason,
      observation,
      updateLocation = true,
      destinationSector,
      serviceOrder,
      loanCollaboratorName,
      loanCollaboratorRegistration,
      loanCollaboratorRole,
      originalBrand,
      originalModel,
      reserveBrand,
      reserveModel,
    } = req.body || {};

    const responsible = String(decodedToken.name || decodedToken.email || "").trim();

    if (!String(originalCollector || "").trim()) {
      return res.status(400).json({
        error: "Coletor original não informado.",
      });
    }

    if (!String(reserveCollector || "").trim()) {
      return res.status(400).json({
        error: "Coletor reserva não informado.",
      });
    }

    if (normalize(originalCollector) === normalize(RESERVED_TEST_COLLECTOR)) {
      return res.status(400).json({
        error: `O equipamento "${RESERVED_TEST_COLLECTOR}" é exclusivo para testes da TI-SUPORTE e não pode participar de empréstimos.`,
      });
    }

    if (normalize(reserveCollector) === normalize(RESERVED_TEST_COLLECTOR)) {
      return res.status(400).json({
        error: `O equipamento "${RESERVED_TEST_COLLECTOR}" é exclusivo para testes da TI-SUPORTE e não pode ser utilizado como reserva.`,
      });
    }

    if (!String(responsible || "").trim()) {
      return res.status(400).json({
        error: "Responsável pelo empréstimo não informado.",
      });
    }

    if (!String(reason || "").trim()) {
      return res.status(400).json({
        error: "Motivo do empréstimo não informado.",
      });
    }

    if (
      !String(loanCollaboratorName || "").trim() ||
      !String(loanCollaboratorRegistration || "").trim() ||
      !String(loanCollaboratorRole || "").trim()
    ) {
      return res.status(400).json({
        error: "Nome, matrícula e cargo do colaborador são obrigatórios.",
      });
    }

    if (
      !String(originalBrand || "").trim() ||
      !String(originalModel || "").trim() ||
      !String(reserveBrand || "").trim() ||
      !String(reserveModel || "").trim()
    ) {
      return res.status(400).json({
        error: "Marca e modelo dos equipamentos são obrigatórios.",
      });
    }

    if (
      updateLocation &&
      !String(destinationSector || "").trim()
    ) {
      return res.status(400).json({
        error:
          "Informe o setor de localização que receberá o equipamento reserva.",
      });
    }

    if (
      normalize(originalCollector) ===
      normalize(reserveCollector)
    ) {
      return res.status(400).json({
        error:
          "O equipamento reserva deve ser diferente do equipamento substituído.",
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

    const spreadsheetId = process.env.SPREADSHEET_ID;

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
          range: `${LOAN_SHEET}!A:AZ`,
        }),
      ]);

    const controlValues =
      controlResponse.data.values || [];
    const loanValues =
      loanResponse.data.values || [];

    if (controlValues.length === 0) {
      return res.status(400).json({
        error:
          "A aba tbControleMobiles não possui cabeçalho.",
      });
    }

    if (loanValues.length === 0) {
      return res.status(400).json({
        error:
          "A aba tbEmprestimosMobiles não possui cabeçalho.",
      });
    }

    const controlHeaders = controlValues[0] || [];
    const loanHeaders = loanValues[0] || [];

    const requiredTermHeaders = [
      "COLABORADOR_EMPRESTIMO_NOME",
      "COLABORADOR_EMPRESTIMO_MATRICULA",
      "COLABORADOR_EMPRESTIMO_CARGO",
      "ORDEM_SERVICO",
      "MARCA_EQUIPAMENTO_ORIGINAL",
      "MODELO_EQUIPAMENTO_ORIGINAL",
      "MARCA_EQUIPAMENTO_RESERVA",
      "MODELO_EQUIPAMENTO_RESERVA",
    ];
    const missingTermHeaders = requiredTermHeaders.filter(
      (header) => findHeaderIndex(loanHeaders, header) === -1
    );

    if (missingTermHeaders.length > 0) {
      return res.status(400).json({
        error: `A aba tbEmprestimosMobiles não possui as colunas: ${missingTermHeaders.join(", ")}.`,
      });
    }

    const coletorIdx = findHeaderIndex(
      controlHeaders,
      "Coletor"
    );
    const snIdx = findHeaderIndex(
      controlHeaders,
      "SN"
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

    if (
      coletorIdx === -1 ||
      snIdx === -1 ||
      setorIdx === -1 ||
      statusIdx === -1 ||
      setorLocalizadoIdx === -1
    ) {
      return res.status(400).json({
        error:
          "A estrutura de tbControleMobiles está incompatível com o empréstimo temporário.",
      });
    }

    const findActiveByCollector = (collector: string) => {
      const matches = controlValues
        .slice(1)
        .map((row, index) => ({
          row,
          sheetRow: index + 2,
        }))
        .filter(({ row }) => {
          const currentCollector = String(
            row[coletorIdx] || ""
          ).trim();
          const currentStatus = String(
            row[statusIdx] || ""
          )
            .trim()
            .toUpperCase();

          return (
            normalize(currentCollector) ===
              normalize(collector) &&
            currentStatus === "A"
          );
        });

      return matches;
    };

    const originalMatches =
      findActiveByCollector(originalCollector);
    const reserveMatches =
      findActiveByCollector(reserveCollector);

    if (originalMatches.length !== 1) {
      return res.status(409).json({
        error:
          originalMatches.length === 0
            ? `Não foi encontrado equipamento ATIVO para o Coletor "${originalCollector}".`
            : `Existe mais de um equipamento ATIVO para o Coletor "${originalCollector}". Corrija o cadastro antes de prosseguir.`,
      });
    }

    if (reserveMatches.length !== 1) {
      return res.status(409).json({
        error:
          reserveMatches.length === 0
            ? `Não foi encontrado equipamento reserva ATIVO para o Coletor "${reserveCollector}".`
            : `Existe mais de um equipamento ATIVO para o Coletor reserva "${reserveCollector}".`,
      });
    }

    const original = originalMatches[0];
    const reserve = reserveMatches[0];

    const reserveSector = String(
      reserve.row[setorIdx] || ""
    ).trim();

    if (
      normalize(reserveSector) !==
      normalize("TI-SUPORTE")
    ) {
      return res.status(400).json({
        error:
          `O equipamento reserva "${reserveCollector}" não pertence ao setor TI-SUPORTE.`,
      });
    }

    const originalSector = String(
      original.row[setorIdx] || ""
    ).trim();
    const originalLocation = String(
      original.row[setorLocalizadoIdx] || ""
    ).trim();
    const effectiveDestination = String(
      destinationSector || originalLocation || originalSector
    ).trim();
    const originalSn = String(
      original.row[snIdx] || ""
    ).trim();
    const reserveSn = String(
      reserve.row[snIdx] || ""
    ).trim();

    const loanStatusIdx = findHeaderIndex(
      loanHeaders,
      "STATUS_EMPRESTIMO"
    );
    const loanReserveCollectorIdx = findHeaderIndex(
      loanHeaders,
      "COLETOR_RESERVA"
    );
    const loanOriginalCollectorIdx = findHeaderIndex(
      loanHeaders,
      "COLETOR_SUBSTITUIDO"
    );

    if (
      loanStatusIdx === -1 ||
      loanReserveCollectorIdx === -1 ||
      loanOriginalCollectorIdx === -1
    ) {
      return res.status(400).json({
        error:
          "A estrutura de tbEmprestimosMobiles está incompatível. Verifique STATUS_EMPRESTIMO, COLETOR_RESERVA e COLETOR_SUBSTITUIDO.",
      });
    }

    const hasOpenLoan = loanValues
      .slice(1)
      .some((row) => {
        const status = normalize(
          row[loanStatusIdx] || ""
        );
        const reserveLoanCollector = normalize(
          row[loanReserveCollectorIdx] || ""
        );
        const originalLoanCollector = normalize(
          row[loanOriginalCollectorIdx] || ""
        );

        return (
          status === "aberto" &&
          (
            reserveLoanCollector ===
              normalize(reserveCollector) ||
            originalLoanCollector ===
              normalize(originalCollector)
          )
        );
      });

    if (hasOpenLoan) {
      return res.status(409).json({
        error:
          "Já existe um empréstimo ABERTO envolvendo o equipamento original ou o equipamento reserva selecionado.",
      });
    }

    const originalUpdated = [...original.row];
    while (
      originalUpdated.length < controlHeaders.length
    ) {
      originalUpdated.push("");
    }
    originalUpdated[statusIdx] = "M";

    const reserveUpdated = [...reserve.row];
    while (
      reserveUpdated.length < controlHeaders.length
    ) {
      reserveUpdated.push("");
    }
    reserveUpdated[statusIdx] = "E";

    if (updateLocation) {
      originalUpdated[setorLocalizadoIdx] = "TI-SUPORTE";
      reserveUpdated[setorLocalizadoIdx] = effectiveDestination;
    }

    const loanId = makeLoanId();
    const loanDate = toLocalIsoDateTime();
    const loanRow = new Array(
      loanHeaders.length
    ).fill("");

    const setLoanValue = (
      value: string,
      ...headerNames: string[]
    ) => {
      const index = findHeaderIndex(
        loanHeaders,
        ...headerNames
      );
      if (index !== -1) {
        loanRow[index] = value;
      }
    };

    setLoanValue(loanId, "ID_EMPRESTIMO");
    setLoanValue(
      String(reserveCollector).trim(),
      "COLETOR_RESERVA"
    );
    setLoanValue(reserveSn, "SN_RESERVA");
    setLoanValue(
      String(originalCollector).trim(),
      "COLETOR_SUBSTITUIDO"
    );
    setLoanValue(
      originalSn,
      "SN_SUBSTITUIDO"
    );
    setLoanValue(
      "TI-SUPORTE",
      "SETOR_ORIGEM"
    );
    setLoanValue(
      effectiveDestination || originalSector,
      "SETOR_DESTINO"
    );
    setLoanValue(
      loanDate,
      "DATA_EMPRESTIMO"
    );
    setLoanValue(
      String(responsible).trim(),
      "RESPONSAVEL_EMPRESTIMO"
    );
    setLoanValue(
      String(reason).trim(),
      "MOTIVO"
    );
    setLoanValue(
      "ABERTO",
      "STATUS_EMPRESTIMO"
    );
    setLoanValue("", "DATA_DEVOLUCAO");
    setLoanValue(
      "",
      "RESPONSAVEL_DEVOLUCAO"
    );
    setLoanValue(
      String(observation || "").trim(),
      "OBS"
    );
    setLoanValue(String(serviceOrder || "").trim(), "ORDEM_SERVICO");
    setLoanValue(String(loanCollaboratorName).trim(), "COLABORADOR_EMPRESTIMO_NOME");
    setLoanValue(String(loanCollaboratorRegistration).trim(), "COLABORADOR_EMPRESTIMO_MATRICULA");
    setLoanValue(String(loanCollaboratorRole).trim(), "COLABORADOR_EMPRESTIMO_CARGO");
    setLoanValue(String(originalBrand).trim(), "MARCA_EQUIPAMENTO_ORIGINAL");
    setLoanValue(String(originalModel).trim(), "MODELO_EQUIPAMENTO_ORIGINAL");
    setLoanValue(String(reserveBrand).trim(), "MARCA_EQUIPAMENTO_RESERVA");
    setLoanValue(String(reserveModel).trim(), "MODELO_EQUIPAMENTO_RESERVA");

    const nextLoanRow = loanValues.length + 1;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: `${CONTROL_SHEET}!A${original.sheetRow}`,
            values: [originalUpdated],
          },
          {
            range: `${CONTROL_SHEET}!A${reserve.sheetRow}`,
            values: [reserveUpdated],
          },
          {
            range: `${LOAN_SHEET}!A${nextLoanRow}`,
            values: [loanRow],
          },
        ],
      },
    });

    return res.status(200).json({
      success: true,
      loanId,
      originalCollector:
        String(originalCollector).trim(),
      reserveCollector:
        String(reserveCollector).trim(),
      destinationSector:
        updateLocation ? effectiveDestination : "",
      locationUpdated: Boolean(updateLocation),
      termData: {
        loanId,
        status: "ABERTO",
        originalCollector: String(originalCollector).trim(),
        originalSerial: originalSn,
        originalBrand: String(originalBrand).trim(),
        originalModel: String(originalModel).trim(),
        reserveCollector: String(reserveCollector).trim(),
        reserveSerial: reserveSn,
        reserveBrand: String(reserveBrand).trim(),
        reserveModel: String(reserveModel).trim(),
        destinationSector: effectiveDestination || originalSector,
        serviceOrder: String(serviceOrder || "").trim(),
        loanDate,
        loanResponsible: responsible,
        loanCollaboratorName: String(loanCollaboratorName).trim(),
        loanCollaboratorRegistration: String(loanCollaboratorRegistration).trim(),
        loanCollaboratorRole: String(loanCollaboratorRole).trim(),
        reason: String(reason).trim(),
        observation: String(observation || "").trim(),
        returnDate: "",
        returnResponsible: "",
        returnCollaboratorName: "",
        returnCollaboratorRegistration: "",
        returnCollaboratorRole: "",
        returnCondition: "",
        returnDetails: "",
        returnObservation: "",
      },
    });
  } catch (error: any) {
    if (authErrorResponse(error, res)) return;
    console.error("ERRO MOBILE LOAN:", error);

    return res.status(500).json({
      error:
        error.message ||
        "Erro interno ao registrar empréstimo temporário.",
    });
  }
}
