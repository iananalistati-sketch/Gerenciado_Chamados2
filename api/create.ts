import { google } from "googleapis";
import { authErrorResponse, CREATABLE_SHEETS, requireRole } from "./_requireAuth.js";

const MOBILE_CONTROL_SHEET = "tbControleMobiles";
const MOBILE_APPS_SHEET = "tbMobileApps";
const MOBILE_CONFIG_SHEET = "tbConfigMobiles";

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

const getToday = () =>
  new Date().toISOString().split("T")[0];

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido." });
  }

  try {
    const { rowData, sheet } = req.body;

    const actor = await requireRole(req.headers.authorization, ["admin", "analyst"]);

    if (typeof sheet !== "string" || !CREATABLE_SHEETS.has(sheet)) {
      return res.status(400).json({ error: "Aba inválida ou não permitida." });
    }

    if (sheet === MOBILE_CONFIG_SHEET && actor.role !== "admin") {
      return res.status(403).json({ error: "Somente administradores podem alterar versões alvo." });
    }

    if (!Array.isArray(rowData)) {
      return res.status(400).json({
        error: "Dados do registro inválidos.",
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY
          ?.replace(/\\n/g, "\n")
          .replace(/^["']|["']$/g, "")
          .trim(),
      },
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
      ],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SPREADSHEET_ID;

    if (!spreadsheetId) {
      return res.status(500).json({
        error: "SPREADSHEET_ID não configurado.",
      });
    }

    if (sheet !== MOBILE_CONTROL_SHEET) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: sheet,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values: [rowData] },
      });

      return res.status(200).json({ success: true });
    }

    const [controlResponse, appsResponse, configResponse] =
      await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${MOBILE_CONTROL_SHEET}!A:Z`,
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${MOBILE_APPS_SHEET}!A:Z`,
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${MOBILE_CONFIG_SHEET}!A:Z`,
        }),
      ]);

    const controlValues = controlResponse.data.values || [];
    const appsValues = appsResponse.data.values || [];
    const configValues = configResponse.data.values || [];

    if (!controlValues.length || !appsValues.length || !configValues.length) {
      return res.status(400).json({
        error: "As abas de controle, aplicativos e configuração precisam possuir cabeçalho.",
      });
    }

    const controlHeaders = controlValues[0] || [];
    const appHeaders = appsValues[0] || [];
    const configHeaders = configValues[0] || [];

    const controlColetorIdx = findHeaderIndex(controlHeaders, "Coletor");
    const controlSnIdx = findHeaderIndex(controlHeaders, "SN");
    const controlFinalIdx = findHeaderIndex(controlHeaders, "FINAL");
    const controlMacIdx = findHeaderIndex(controlHeaders, "MAC");
    const controlSetorIdx = findHeaderIndex(controlHeaders, "Setor");
    const controlLocalizacaoIdx = findHeaderIndex(
      controlHeaders,
      "Setor localizado"
    );
    const controlStatusIdx = findHeaderIndex(controlHeaders, "Status");
    const controlAppIdx = findHeaderIndex(
      controlHeaders,
      "App de uso",
      "Aplicativo",
      "App"
    );
    const controlVersaoIdx = findHeaderIndex(
      controlHeaders,
      "Versão",
      "Versao"
    );
    const controlDataAtualizacaoIdx = findHeaderIndex(
      controlHeaders,
      "Data atualização",
      "Data atualizacao"
    );
    const controlStatusAtualizacaoIdx = findHeaderIndex(
      controlHeaders,
      "Status atualização",
      "Status atualizacao"
    );
    const controlResponsavelAtualizacaoIdx = findHeaderIndex(
      controlHeaders,
      "Responsável atualização",
      "Responsavel atualizacao"
    );
    const controlContadorAtualizacaoIdx = findHeaderIndex(
      controlHeaders,
      "Contador atualização",
      "Contador atualizacao"
    );

    if (
      controlColetorIdx === -1 ||
      controlSnIdx === -1 ||
      controlFinalIdx === -1 ||
      controlMacIdx === -1 ||
      controlSetorIdx === -1 ||
      controlLocalizacaoIdx === -1 ||
      controlStatusIdx === -1 ||
      controlAppIdx === -1
    ) {
      return res.status(400).json({
        error: "A estrutura de tbControleMobiles está incompleta para o cadastro.",
      });
    }

    const physicalRow = [
      ...rowData.slice(0, controlHeaders.length),
    ];
    while (physicalRow.length < controlHeaders.length) {
      physicalRow.push("");
    }

    const coletor = String(physicalRow[controlColetorIdx] || "").trim();
    const sn = String(physicalRow[controlSnIdx] || "").trim();
    const final = String(physicalRow[controlFinalIdx] || "").trim();
    const mac = String(physicalRow[controlMacIdx] || "").trim();
    const setor = String(physicalRow[controlSetorIdx] || "").trim();
    const localizacao = String(
      physicalRow[controlLocalizacaoIdx] || ""
    ).trim();
    const status = String(physicalRow[controlStatusIdx] || "")
      .trim()
      .toUpperCase();
    const appScope = String(physicalRow[controlAppIdx] || "").trim();
    const initialVersion =
      controlVersaoIdx !== -1
        ? String(physicalRow[controlVersaoIdx] || "").trim()
        : "";

    if (!setor || !localizacao || !coletor || !sn || !final || !mac || !appScope) {
      return res.status(400).json({
        error: "Preencha Setor, Setor localizado, Coletor, SN, FINAL, MAC e App de uso.",
      });
    }

    if (!/^\d+$/.test(sn)) {
      return res.status(400).json({
        error: "O SN deve conter apenas números.",
      });
    }

    if (!/^\d+$/.test(final)) {
      return res.status(400).json({
        error: "O FINAL deve conter apenas números.",
      });
    }

    if (!["A", "I"].includes(status)) {
      return res.status(400).json({
        error: "Informe um Status válido: A ou I.",
      });
    }

    const duplicateSn = controlValues.slice(1).some((row) => {
      const existingSn = String(row[controlSnIdx] || "").trim();
      return existingSn && normalize(existingSn) === normalize(sn);
    });

    if (duplicateSn) {
      return res.status(409).json({
        error: `Já existe um equipamento cadastrado com o SN "${sn}".`,
      });
    }

    if (status === "A") {
      const activeCollectorExists = controlValues.slice(1).some((row) => {
        const existingCollector = String(
          row[controlColetorIdx] || ""
        ).trim();
        const existingStatus = String(
          row[controlStatusIdx] || ""
        ).trim().toUpperCase();

        return (
          normalize(existingCollector) === normalize(coletor) &&
          existingStatus === "A"
        );
      });

      if (activeCollectorExists) {
        return res.status(409).json({
          error: `Já existe um equipamento ATIVO utilizando o Coletor "${coletor}".`,
        });
      }
    }

    const configAppIdx = findHeaderIndex(configHeaders, "APP_USO");
    const configVersionIdx = findHeaderIndex(
      configHeaders,
      "VERSAO_ALVO"
    );
    const appUsoIdx = findHeaderIndex(appHeaders, "APP_USO");

    if (configAppIdx === -1 || appUsoIdx === -1) {
      return res.status(400).json({
        error: "Não foi possível identificar APP_USO nas abas de configuração.",
      });
    }

    const configuredApps = Array.from(
      new Set(
        configValues
          .slice(1)
          .map((row) => String(row[configAppIdx] || "").trim())
          .filter((app) => app && normalize(app) !== "todos")
      )
    );

    if (!configuredApps.length) {
      return res.status(400).json({
        error: "Nenhum aplicativo foi encontrado em tbConfigMobiles.",
      });
    }

    let appsToCreate: string[] = [];

    if (normalize(appScope) === "todos") {
      if (initialVersion) {
        return res.status(400).json({
          error: "Quando App de uso for TODOS, deixe a Versão em branco.",
        });
      }
      appsToCreate = configuredApps;
    } else {
      const knownApp = configuredApps.find(
        (app) => normalize(app) === normalize(appScope)
      );

      if (!knownApp) {
        return res.status(400).json({
          error: `O aplicativo "${appScope}" não está cadastrado em tbConfigMobiles.`,
        });
      }

      if (!initialVersion) {
        return res.status(400).json({
          error: "Informe a Versão para equipamentos que utilizam um App específico.",
        });
      }

      appsToCreate = [knownApp];
    }

    const targetByApp: Record<string, string> = {};
    if (configVersionIdx !== -1) {
      configValues.slice(1).forEach((row) => {
        const app = String(row[configAppIdx] || "").trim();
        const target = String(row[configVersionIdx] || "").trim();
        if (app && target) {
          targetByApp[normalize(app)] = target;
        }
      });
    }

    const getUpdateStatus = (app: string, version: string) => {
      const target = targetByApp[normalize(app)];
      if (!version || !target) return "SEM INFORMAÇÃO";
      return version === target ? "ATUALIZADO" : "PENDENTE";
    };

    const suppliedDate =
      controlDataAtualizacaoIdx !== -1
        ? String(physicalRow[controlDataAtualizacaoIdx] || "").trim()
        : "";
    const suppliedResponsible =
      controlResponsavelAtualizacaoIdx !== -1
        ? String(
            physicalRow[controlResponsavelAtualizacaoIdx] || ""
          ).trim()
        : "";

    if (controlDataAtualizacaoIdx !== -1) {
      physicalRow[controlDataAtualizacaoIdx] = suppliedDate || getToday();
    }
    if (controlResponsavelAtualizacaoIdx !== -1) {
      physicalRow[controlResponsavelAtualizacaoIdx] = suppliedResponsible;
    }
    if (controlContadorAtualizacaoIdx !== -1) {
      physicalRow[controlContadorAtualizacaoIdx] =
        normalize(appScope) === "todos" ? "0" : "1";
    }
    if (controlStatusAtualizacaoIdx !== -1) {
      physicalRow[controlStatusAtualizacaoIdx] =
        normalize(appScope) === "todos"
          ? "SEM INFORMAÇÃO"
          : getUpdateStatus(appScope, initialVersion);
    }

    const appColetorIdx = findHeaderIndex(appHeaders, "COLETOR");
    const appSnIdx = findHeaderIndex(appHeaders, "SN");
    const appVersaoIdx = findHeaderIndex(appHeaders, "VERSAO");
    const appDataAtualizacaoIdx = findHeaderIndex(
      appHeaders,
      "DATA_ATUALIZACAO"
    );
    const appStatusAtualizacaoIdx = findHeaderIndex(
      appHeaders,
      "STATUS_ATUALIZACAO"
    );
    const appResponsavelAtualizacaoIdx = findHeaderIndex(
      appHeaders,
      "RESPONSAVEL_ATUALIZACAO"
    );
    const appContadorAtualizacaoIdx = findHeaderIndex(
      appHeaders,
      "CONTADOR_ATUALIZACAO"
    );
    const appObsIdx = findHeaderIndex(appHeaders, "OBS");

    if (
      appColetorIdx === -1 ||
      appSnIdx === -1 ||
      appUsoIdx === -1 ||
      appVersaoIdx === -1 ||
      appContadorAtualizacaoIdx === -1
    ) {
      return res.status(400).json({
        error: "A estrutura de tbMobileApps está incompatível com o cadastro.",
      });
    }

    const childRows = appsToCreate.map((appName) => {
      const child = new Array(appHeaders.length).fill("");
      const isSingleApp = appsToCreate.length === 1;
      const version = isSingleApp ? initialVersion : "";

      child[appColetorIdx] = coletor;
      child[appSnIdx] = sn;
      child[appUsoIdx] = appName;
      child[appVersaoIdx] = version;
      child[appContadorAtualizacaoIdx] =
        isSingleApp && version ? "1" : "0";

      if (appDataAtualizacaoIdx !== -1) {
        child[appDataAtualizacaoIdx] =
          isSingleApp && version
            ? suppliedDate || getToday()
            : "";
      }
      if (appStatusAtualizacaoIdx !== -1) {
        child[appStatusAtualizacaoIdx] = getUpdateStatus(
          appName,
          version
        );
      }
      if (appResponsavelAtualizacaoIdx !== -1) {
        child[appResponsavelAtualizacaoIdx] =
          isSingleApp && version ? suppliedResponsible : "";
      }
      if (appObsIdx !== -1) {
        child[appObsIdx] = "";
      }

      return child;
    });

    const nextControlRow = controlValues.length + 1;
    const nextAppsRow = appsValues.length + 1;

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: [
          {
            range: `${MOBILE_CONTROL_SHEET}!A${nextControlRow}`,
            values: [physicalRow],
          },
          {
            range: `${MOBILE_APPS_SHEET}!A${nextAppsRow}`,
            values: childRows,
          },
        ],
      },
    });

    return res.status(200).json({
      success: true,
      equipmentCreated: true,
      appsCreated: childRows.length,
      apps: appsToCreate,
    });
  } catch (error: any) {
    if (authErrorResponse(error, res)) return;
    console.error("ERRO CREATE:", error);
    return res.status(500).json({
      error: error.message || "Erro interno ao criar registro.",
    });
  }
}
