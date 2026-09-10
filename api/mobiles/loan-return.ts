import { google } from "googleapis";
import { authErrorResponse, requireRole } from "../_requireAuth.js";

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

const valueFromLoan = (
  headers: string[],
  row: string[],
  ...names: string[]
) => {
  const index = findHeaderIndex(headers, ...names);
  return index === -1 ? "" : String(row[index] || "").trim();
};

const toLocalIsoDateTime = () => {
  return new Date().toLocaleString("sv-SE", {
    timeZone: "America/Sao_Paulo",
    hour12: false,
  }).replace(" ", "T");
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
      reserveCollector,
      observation,
      updateLocation = true,
      returnSector,
      returnCollaboratorName,
      returnCollaboratorRegistration,
      returnCollaboratorRole,
      returnCondition,
      returnDetails,
      occurrenceType,
      misuseJustification,
      sectorResponsibleName,
    } = req.body || {};

    const reserve = String(
      reserveCollector || ""
    ).trim();
    const returnResponsible = String(decodedToken.name || decodedToken.email || "").trim();
    const requestedReturnSector = String(
      returnSector || ""
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

    if (
      !String(returnCollaboratorName || "").trim() ||
      !String(returnCollaboratorRegistration || "").trim() ||
      !String(returnCollaboratorRole || "").trim()
    ) {
      return res.status(400).json({
        error: "Nome, matrícula e cargo de quem devolveu são obrigatórios.",
      });
    }

    const normalizedConditions = Array.isArray(returnCondition)
      ? returnCondition.map((item) => String(item || "").trim()).filter(Boolean)
      : String(returnCondition || "").split("|").map((item) => item.trim()).filter(Boolean);
    const allowedConditions = new Set([
      "PERFEITO_ESTADO",
      "APRESENTANDO_DEFEITO",
      "FALTANDO_PECAS_ACESSORIOS",
    ]);

    if (normalizedConditions.length === 0 || normalizedConditions.some((item) => !allowedConditions.has(item))) {
      return res.status(400).json({ error: "Informe uma condição de devolução válida." });
    }

    if (
      normalizedConditions.some((item) => item !== "PERFEITO_ESTADO") &&
      !String(returnDetails || "").trim()
    ) {
      return res.status(400).json({
        error: "Detalhe o defeito ou as peças/acessórios faltantes.",
      });
    }

    const hasDamage = normalizedConditions.some((item) => item !== "PERFEITO_ESTADO");
    const normalizedOccurrenceType = normalizedConditions.includes("FALTANDO_PECAS_ACESSORIOS")
      ? "PECA_ACESSORIO_FALTANTE"
      : String(occurrenceType || "").trim().toUpperCase();
    const allowedOccurrenceTypes = new Set([
      "FALHA_TECNICA",
      "DESGASTE_NATURAL",
      "AVARIA_FISICA",
      "INDICIO_MAU_USO",
      "PECA_ACESSORIO_FALTANTE",
      "EM_ANALISE",
    ]);
    const responsibilityOccurrenceTypes = new Set([
      "AVARIA_FISICA",
      "INDICIO_MAU_USO",
      "PECA_ACESSORIO_FALTANTE",
    ]);

    if (hasDamage && !allowedOccurrenceTypes.has(normalizedOccurrenceType)) {
      return res.status(400).json({ error: "Informe uma classificação válida para a ocorrência." });
    }

    if (!hasDamage && normalizedOccurrenceType) {
      return res.status(400).json({ error: "A classificação de ocorrência só pode ser informada quando houver falha ou item faltante." });
    }

    const issueResponsibilityTerm = hasDamage && responsibilityOccurrenceTypes.has(normalizedOccurrenceType);
    if (issueResponsibilityTerm && !String(misuseJustification || "").trim()) {
      return res.status(400).json({ error: "Informe a justificativa do mau uso ou da responsabilidade." });
    }

    if (issueResponsibilityTerm && !String(sectorResponsibleName || "").trim()) {
      return res.status(400).json({ error: "Informe o nome da coordenação ou responsável pelo setor." });
    }

    if (updateLocation && !requestedReturnSector) {
      return res.status(400).json({
        error:
          "Informe o setor de localização para devolução do equipamento original.",
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
          range: `${LOAN_SHEET}!A:AZ`,
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

    const requiredReturnHeaders = [
      "COLABORADOR_DEVOLUCAO_NOME",
      "COLABORADOR_DEVOLUCAO_MATRICULA",
      "COLABORADOR_DEVOLUCAO_CARGO",
      "CONDICAO_DEVOLUCAO",
      "DETALHES_DEVOLUCAO",
      "OBS_DEVOLUCAO",
      "TIPO_OCORRENCIA_DEVOLUCAO",
      "JUSTIFICATIVA_MAU_USO",
      "RESPONSAVEL_SETOR_NOME",
      "TERMO_RESPONSABILIDADE_EMITIDO",
    ];
    const missingReturnHeaders = requiredReturnHeaders.filter(
      (header) => findHeaderIndex(loanHeaders, header) === -1
    );

    if (missingReturnHeaders.length > 0) {
      return res.status(400).json({
        error: `A aba tbEmprestimosMobiles não possui as colunas: ${missingReturnHeaders.join(", ")}.`,
      });
    }

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
    const loanDestinationIdx = findHeaderIndex(
      loanHeaders,
      "SETOR_DESTINO"
    );
    const loanReturnDateIdx = findHeaderIndex(
      loanHeaders,
      "DATA_DEVOLUCAO"
    );
    const loanReturnResponsibleIdx = findHeaderIndex(
      loanHeaders,
      "RESPONSAVEL_DEVOLUCAO"
    );
    const returnNameIdx = findHeaderIndex(loanHeaders, "COLABORADOR_DEVOLUCAO_NOME");
    const returnRegistrationIdx = findHeaderIndex(loanHeaders, "COLABORADOR_DEVOLUCAO_MATRICULA");
    const returnRoleIdx = findHeaderIndex(loanHeaders, "COLABORADOR_DEVOLUCAO_CARGO");
    const returnConditionIdx = findHeaderIndex(loanHeaders, "CONDICAO_DEVOLUCAO");
    const returnDetailsIdx = findHeaderIndex(loanHeaders, "DETALHES_DEVOLUCAO");
    const returnObservationIdx = findHeaderIndex(loanHeaders, "OBS_DEVOLUCAO");
    const occurrenceTypeIdx = findHeaderIndex(loanHeaders, "TIPO_OCORRENCIA_DEVOLUCAO");
    const misuseJustificationIdx = findHeaderIndex(loanHeaders, "JUSTIFICATIVA_MAU_USO");
    const sectorResponsibleNameIdx = findHeaderIndex(loanHeaders, "RESPONSAVEL_SETOR_NOME");
    const responsibilityTermIssuedIdx = findHeaderIndex(loanHeaders, "TERMO_RESPONSABILIDADE_EMITIDO");

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
    const recordedDestination =
      loanDestinationIdx !== -1
        ? String(loan.row[loanDestinationIdx] || "").trim()
        : "";
    const effectiveReturnSector =
      requestedReturnSector || recordedDestination;

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

    reserveUpdated[statusIdx] = hasDamage ? "M" : "A";
    originalUpdated[statusIdx] = "A";

    reserveUpdated[setorLocalizadoIdx] = hasDamage ? "MANUTENÇÃO" : "TI-SUPORTE";

    if (updateLocation) {
      originalUpdated[setorLocalizadoIdx] = effectiveReturnSector;
    }

    loanUpdated[loanStatusIdx] = "FINALIZADO";
    const returnDate = toLocalIsoDateTime();
    loanUpdated[loanReturnDateIdx] = returnDate;
    loanUpdated[loanReturnResponsibleIdx] =
      returnResponsible;
    loanUpdated[returnNameIdx] = String(returnCollaboratorName).trim();
    loanUpdated[returnRegistrationIdx] = String(returnCollaboratorRegistration).trim();
    loanUpdated[returnRoleIdx] = String(returnCollaboratorRole).trim();
    loanUpdated[returnConditionIdx] = normalizedConditions.join(" | ");
    loanUpdated[returnDetailsIdx] = String(returnDetails || "").trim();
    loanUpdated[occurrenceTypeIdx] = hasDamage ? normalizedOccurrenceType : "";
    loanUpdated[misuseJustificationIdx] = issueResponsibilityTerm
      ? String(misuseJustification || "").trim()
      : "";
    loanUpdated[sectorResponsibleNameIdx] = issueResponsibilityTerm
      ? String(sectorResponsibleName || "").trim()
      : "";
    loanUpdated[responsibilityTermIssuedIdx] = issueResponsibilityTerm ? "SIM" : "NAO";
    const notes: string[] = [];

    if (String(observation || "").trim()) {
      notes.push(String(observation || "").trim());
    }

    if (updateLocation && effectiveReturnSector) {
      notes.push(`Setor de devolução: ${effectiveReturnSector}`);
    }

    const returnObservation = notes.join(" | ");
    loanUpdated[returnObservationIdx] = returnObservation;

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
      returnSector:
        updateLocation ? effectiveReturnSector : "",
      locationUpdated: Boolean(updateLocation),
      reserveStatus: hasDamage ? "M" : "A",
      reserveLocation: hasDamage ? "MANUTENÇÃO" : "TI-SUPORTE",
      responsibilityTermIssued: issueResponsibilityTerm,
      termData: {
        loanId: loanIdIdx !== -1 ? String(loan.row[loanIdIdx] || "").trim() : "",
        status: "FINALIZADO",
        originalCollector,
        originalSerial: valueFromLoan(loanHeaders, loanUpdated, "SN_SUBSTITUIDO"),
        originalBrand: valueFromLoan(loanHeaders, loanUpdated, "MARCA_EQUIPAMENTO_ORIGINAL"),
        originalModel: valueFromLoan(loanHeaders, loanUpdated, "MODELO_EQUIPAMENTO_ORIGINAL"),
        reserveCollector: reserve,
        reserveSerial: valueFromLoan(loanHeaders, loanUpdated, "SN_RESERVA"),
        reserveBrand: valueFromLoan(loanHeaders, loanUpdated, "MARCA_EQUIPAMENTO_RESERVA"),
        reserveModel: valueFromLoan(loanHeaders, loanUpdated, "MODELO_EQUIPAMENTO_RESERVA"),
        destinationSector: valueFromLoan(loanHeaders, loanUpdated, "SETOR_DESTINO"),
        serviceOrder: valueFromLoan(loanHeaders, loanUpdated, "ORDEM_SERVICO"),
        loanDate: valueFromLoan(loanHeaders, loanUpdated, "DATA_EMPRESTIMO"),
        loanResponsible: valueFromLoan(loanHeaders, loanUpdated, "RESPONSAVEL_EMPRESTIMO"),
        loanCollaboratorName: valueFromLoan(loanHeaders, loanUpdated, "COLABORADOR_EMPRESTIMO_NOME"),
        loanCollaboratorRegistration: valueFromLoan(loanHeaders, loanUpdated, "COLABORADOR_EMPRESTIMO_MATRICULA"),
        loanCollaboratorRole: valueFromLoan(loanHeaders, loanUpdated, "COLABORADOR_EMPRESTIMO_CARGO"),
        reason: valueFromLoan(loanHeaders, loanUpdated, "MOTIVO"),
        observation: valueFromLoan(loanHeaders, loanUpdated, "OBS"),
        returnDate,
        returnResponsible,
        returnCollaboratorName: String(returnCollaboratorName).trim(),
        returnCollaboratorRegistration: String(returnCollaboratorRegistration).trim(),
        returnCollaboratorRole: String(returnCollaboratorRole).trim(),
        returnCondition: normalizedConditions.join(" | "),
        returnDetails: String(returnDetails || "").trim(),
        returnObservation,
        returnOccurrenceType: hasDamage ? normalizedOccurrenceType : "",
        misuseJustification: issueResponsibilityTerm ? String(misuseJustification || "").trim() : "",
        sectorResponsibleName: issueResponsibilityTerm ? String(sectorResponsibleName || "").trim() : "",
        responsibilityTermIssued: issueResponsibilityTerm ? "SIM" : "NAO",
      },
    });
  } catch (error: any) {
    if (authErrorResponse(error, res)) return;
    console.error("ERRO MOBILE LOAN RETURN:", error);

    return res.status(500).json({
      error:
        error.message ||
        "Erro interno ao finalizar empréstimo temporário.",
    });
  }
}
