import { google } from "googleapis";

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
      (name) =>
        normalize(header) === normalize(name)
    )
  );

export default async function handler(req: any, res: any) {
  try {
    const { rowData, sheet } = req.body;

    console.log("CREATE BODY:", req.body);

    if (!sheet) {
      return res.status(400).json({
        error: "Sheet não informada",
      });
    }

    if (!Array.isArray(rowData)) {
      return res.status(400).json({
        error: "Dados do registro inválidos.",
      });
    }

    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email:
          process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key:
          process.env.GOOGLE_PRIVATE_KEY
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
        error:
          "SPREADSHEET_ID não configurado.",
      });
    }

    if (sheet !== MOBILE_CONTROL_SHEET) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: sheet,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: {
          values: [rowData],
        },
      });

      return res.status(200).json({
        success: true,
      });
    }

    const [
      controlResponse,
      appsResponse,
      configResponse,
    ] = await Promise.all([
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

    const controlValues =
      controlResponse.data.values || [];
    const appsValues =
      appsResponse.data.values || [];
    const configValues =
      configResponse.data.values || [];

    if (controlValues.length === 0) {
      return res.status(400).json({
        error:
          "A aba tbControleMobiles não possui cabeçalho.",
      });
    }

    if (appsValues.length === 0) {
      return res.status(400).json({
        error:
          "A aba tbMobileApps não possui cabeçalho.",
      });
    }

    if (configValues.length === 0) {
      return res.status(400).json({
        error:
          "A aba tbConfigMobiles não possui cabeçalho.",
      });
    }

    const controlHeaders =
      controlValues[0] || [];
    const appHeaders =
      appsValues[0] || [];
    const configHeaders =
      configValues[0] || [];

    const controlColetorIdx =
      findHeaderIndex(controlHeaders, "Coletor");
    const controlSnIdx =
      findHeaderIndex(controlHeaders, "SN");
    const controlStatusIdx =
      findHeaderIndex(controlHeaders, "Status");
    const controlAppIdx =
      findHeaderIndex(
        controlHeaders,
        "App de uso",
        "Aplicativo",
        "App"
      );
    const controlVersaoIdx =
      findHeaderIndex(
        controlHeaders,
        "Versão",
        "Versao"
      );
    const controlDataAtualizacaoIdx =
      findHeaderIndex(
        controlHeaders,
        "Data atualização",
        "Data atualizacao"
      );
    const controlStatusAtualizacaoIdx =
      findHeaderIndex(
        controlHeaders,
        "Status atualização",
        "Status atualizacao"
      );
    const controlResponsavelAtualizacaoIdx =
      findHeaderIndex(
        controlHeaders,
        "Responsável atualização",
        "Responsavel atualizacao"
      );
    const controlContadorAtualizacaoIdx =
      findHeaderIndex(
        controlHeaders,
        "Contador atualização",
        "Contador atualizacao"
      );

    if (
      controlColetorIdx === -1 ||
      controlSnIdx === -1 ||
      controlStatusIdx === -1 ||
      controlAppIdx === -1
    ) {
      return res.status(400).json({
        error:
          "Não foi possível identificar Coletor, SN, Status ou App de uso em tbControleMobiles.",
      });
    }

    const physicalRow = [
      ...rowData.slice(0, controlHeaders.length),
    ];

    while (
      physicalRow.length <
      controlHeaders.length
    ) {
      physicalRow.push("");
    }

    const coletor = String(
      physicalRow[controlColetorIdx] || ""
    ).trim();
    const sn = String(
      physicalRow[controlSnIdx] || ""
    ).trim();
    const status = String(
      physicalRow[controlStatusIdx] || ""
    )
      .trim()
      .toUpperCase();
    const appScope = String(
      physicalRow[controlAppIdx] || ""
    ).trim();
    const initialVersion =
      controlVersaoIdx !== -1
        ? String(
            physicalRow[controlVersaoIdx] || ""
          ).trim()
        : "";

    if (!coletor) {
      return res.status(400).json({
        error: "Informe o Coletor.",
      });
    }

    if (!sn) {
      return res.status(400).json({
        error:
          "Informe o SN do equipamento.",
      });
    }

    if (!appScope) {
      return res.status(400).json({
        error:
          "Informe o App de uso do equipamento.",
      });
    }

    if (!["A", "I", "M"].includes(status)) {
      return res.status(400).json({
        error:
          "Informe um Status válido: A, I ou M.",
      });
    }

    const duplicateSn =
      controlValues
        .slice(1)
        .some((row) => {
          const existingSn = String(
            row[controlSnIdx] || ""
          ).trim();

          return (
            existingSn !== "" &&
            normalize(existingSn) ===
              normalize(sn)
          );
        });

    if (duplicateSn) {
      return res.status(409).json({
        error:
          `Já existe um equipamento cadastrado com o SN "${sn}".`,
      });
    }

    if (status === "A") {
      const activeCollectorExists =
        controlValues
          .slice(1)
          .some((row) => {
            const existingCollector =
              String(
                row[controlColetorIdx] || ""
              ).trim();
            const existingStatus =
              String(
                row[controlStatusIdx] || ""
              )
                .trim()
                .toUpperCase();

            return (
              normalize(existingCollector) ===
                normalize(coletor) &&
              existingStatus === "A"
            );
          });

      if (activeCollectorExists) {
        return res.status(409).json({
          error:
            `Já existe um equipamento ATIVO utilizando o Coletor "${coletor}".`,
        });
      }
    }

    const configAppIdx =
      findHeaderIndex(
        configHeaders,
        "APP_USO"
      );
    const appUsoIdx =
      findHeaderIndex(
        appHeaders,
        "APP_USO"
      );

    if (configAppIdx === -1) {
      return res.status(400).json({
        error:
          "A coluna APP_USO não foi encontrada em tbConfigMobiles.",
      });
    }

    if (appUsoIdx === -1) {
      return res.status(400).json({
        error:
          "A coluna APP_USO não foi encontrada em tbMobileApps.",
      });
    }

    const configuredApps = Array.from(
      new Set(
        configValues
          .slice(1)
          .map((row) =>
            String(row[configAppIdx] || "").trim()
          )
          .filter(
            (app) =>
              app !== "" &&
              normalize(app) !== "todos"
          )
      )
    );

    const existingApps = Array.from(
      new Set(
        appsValues
          .slice(1)
          .map((row) =>
            String(row[appUsoIdx] || "").trim()
          )
          .filter(
            (app) =>
              app !== "" &&
              normalize(app) !== "todos"
          )
      )
    );

    const knownAppsMap = new Map<string, string>();

    [...configuredApps, ...existingApps].forEach(
      (app) => {
        const key = normalize(app);
        if (key && !knownAppsMap.has(key)) {
          knownAppsMap.set(key, app);
        }
      }
    );

    const knownApps = Array.from(
      knownAppsMap.values()
    );

    if (knownApps.length === 0) {
      return res.status(400).json({
        error:
          "Nenhum aplicativo foi encontrado em tbConfigMobiles ou tbMobileApps.",
      });
    }

    let appsToCreate: string[] = [];

    if (normalize(appScope) === "todos") {
      if (initialVersion) {
        return res.status(400).json({
          error:
            "Quando App de uso for TODOS, deixe a Versão em branco. As versões devem ser registradas individualmente para cada App após o cadastro.",
        });
      }

      appsToCreate = knownApps;
    } else {
      const knownApp =
        knownApps.find(
          (app) =>
            normalize(app) ===
            normalize(appScope)
        );

      if (!knownApp) {
        return res.status(400).json({
          error:
            `O aplicativo "${appScope}" não está cadastrado em tbConfigMobiles nem em tbMobileApps.`,
        });
      }

      appsToCreate = [knownApp];
    }

    const appColetorIdx =
      findHeaderIndex(appHeaders, "COLETOR");
    const appSnIdx =
      findHeaderIndex(appHeaders, "SN");
    const appVersaoIdx =
      findHeaderIndex(appHeaders, "VERSAO");
    const appDataAtualizacaoIdx =
      findHeaderIndex(
        appHeaders,
        "DATA_ATUALIZACAO"
      );
    const appStatusAtualizacaoIdx =
      findHeaderIndex(
        appHeaders,
        "STATUS_ATUALIZACAO"
      );
    const appResponsavelAtualizacaoIdx =
      findHeaderIndex(
        appHeaders,
        "RESPONSAVEL_ATUALIZACAO"
      );
    const appContadorAtualizacaoIdx =
      findHeaderIndex(
        appHeaders,
        "CONTADOR_ATUALIZACAO"
      );
    const appObsIdx =
      findHeaderIndex(appHeaders, "OBS");

    if (
      appColetorIdx === -1 ||
      appSnIdx === -1 ||
      appUsoIdx === -1 ||
      appVersaoIdx === -1 ||
      appContadorAtualizacaoIdx === -1
    ) {
      return res.status(400).json({
        error:
          "A estrutura de tbMobileApps está incompatível com o cadastro de equipamentos.",
      });
    }

    const childRows =
      appsToCreate.map((appName) => {
        const row = new Array(
          appHeaders.length
        ).fill("");

        row[appColetorIdx] = coletor;
        row[appSnIdx] = sn;
        row[appUsoIdx] = appName;
        row[appVersaoIdx] =
          appsToCreate.length === 1
            ? initialVersion
            : "";
        row[appContadorAtualizacaoIdx] = "0";

        if (appDataAtualizacaoIdx !== -1) {
          row[appDataAtualizacaoIdx] = "";
        }

        if (appStatusAtualizacaoIdx !== -1) {
          row[appStatusAtualizacaoIdx] = "";
        }

        if (appResponsavelAtualizacaoIdx !== -1) {
          row[appResponsavelAtualizacaoIdx] = "";
        }

        if (appObsIdx !== -1) {
          row[appObsIdx] = "";
        }

        return row;
      });

    [
      controlVersaoIdx,
      controlDataAtualizacaoIdx,
      controlStatusAtualizacaoIdx,
      controlResponsavelAtualizacaoIdx,
      controlContadorAtualizacaoIdx,
    ].forEach((index) => {
      if (index !== -1) {
        physicalRow[index] = "";
      }
    });

    const nextControlRow =
      controlValues.length + 1;
    const nextAppsRow =
      appsValues.length + 1;

    const writeData: Array<{
      range: string;
      values: string[][];
    }> = [
      {
        range:
          `${MOBILE_CONTROL_SHEET}!A${nextControlRow}`,
        values: [physicalRow],
      },
      {
        range:
          `${MOBILE_APPS_SHEET}!A${nextAppsRow}`,
        values: childRows,
      },
    ];

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: writeData,
      },
    });

    return res.status(200).json({
      success: true,
      equipmentCreated: true,
      appsCreated: childRows.length,
      apps: appsToCreate,
    });
  } catch (error: any) {
    console.error("ERRO CREATE:", error);

    return res.status(500).json({
      error:
        error.message ||
        "Erro interno ao criar registro.",
    });
  }
}
