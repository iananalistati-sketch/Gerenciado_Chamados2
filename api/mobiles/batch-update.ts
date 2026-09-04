import type { VercelRequest, VercelResponse } from "@vercel/node";
import { google } from "googleapis";

const CONTROLE_SHEET = "tbControleMobiles";
const APPS_SHEET = "tbMobileApps";

const normalize = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const findHeaderIndex = (
  headers: string[],
  ...names: string[]
) =>
  headers.findIndex((header) =>
    names.some(
      (name) =>
        normalize(header) === normalize(name)
    )
  );

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== "PUT") {
    return res.status(405).json({
      error: "Método não permitido.",
    });
  }

  try {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
      return res.status(400).json({
        error: "Updates inválidos.",
      });
    }

    if (updates.length === 0) {
      return res.status(400).json({
        error: "Nenhum equipamento informado.",
      });
    }

    for (const update of updates) {
      if (
        typeof update.rowIndex !== "number" ||
        !Array.isArray(update.rowData)
      ) {
        return res.status(400).json({
          error:
            "Estrutura de atualização inválida.",
        });
      }

      if (update.rowIndex < 2) {
        return res.status(400).json({
          error: "Índice de linha inválido.",
        });
      }
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

    const [controleResponse, appsResponse] =
      await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${CONTROLE_SHEET}!A:Z`,
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${APPS_SHEET}!A:Z`,
        }),
      ]);

    const controleValues =
      controleResponse.data.values || [];
    const appsValues =
      appsResponse.data.values || [];

    if (
      controleValues.length === 0 ||
      appsValues.length === 0
    ) {
      return res.status(400).json({
        error:
          "Não foi possível carregar as abas de controle de mobiles.",
      });
    }

    const controleHeaders =
      controleValues[0] || [];
    const appHeaders =
      appsValues[0] || [];

    const controleColetorIdx =
      findHeaderIndex(
        controleHeaders,
        "Coletor"
      );
    const controleVersaoIdx =
      findHeaderIndex(
        controleHeaders,
        "Versão",
        "Versao"
      );
    const controleDataIdx =
      findHeaderIndex(
        controleHeaders,
        "Data atualização",
        "Data atualizacao"
      );
    const controleStatusIdx =
      findHeaderIndex(
        controleHeaders,
        "Status"
      );
    const controleStatusAtualizacaoIdx =
      findHeaderIndex(
        controleHeaders,
        "Status atualização",
        "Status atualizacao"
      );
    const controleObsIdx =
      findHeaderIndex(
        controleHeaders,
        "Obs",
        "Observação",
        "Observacao"
      );

    const appColetorIdx =
      findHeaderIndex(
        appHeaders,
        "COLETOR"
      );
    const appUsoIdx =
      findHeaderIndex(
        appHeaders,
        "APP_USO"
      );
    const appVersaoIdx =
      findHeaderIndex(
        appHeaders,
        "VERSAO"
      );
    const appDataIdx =
      findHeaderIndex(
        appHeaders,
        "DATA_ATUALIZACAO"
      );
    const appResponsavelIdx =
      findHeaderIndex(
        appHeaders,
        "RESPONSAVEL_ATUALIZACAO"
      );
    const appContadorIdx =
      findHeaderIndex(
        appHeaders,
        "CONTADOR_ATUALIZACAO"
      );
    const appObsIdx =
      findHeaderIndex(
        appHeaders,
        "OBS"
      );

    const requiredControleIndexes = [
      controleColetorIdx,
      controleVersaoIdx,
      controleDataIdx,
      controleStatusIdx,
      controleStatusAtualizacaoIdx,
    ];

    const requiredAppIndexes = [
      appColetorIdx,
      appUsoIdx,
      appVersaoIdx,
      appDataIdx,
      appResponsavelIdx,
      appContadorIdx,
    ];

    if (
      requiredControleIndexes.some(
        (index) => index === -1
      ) ||
      requiredAppIndexes.some(
        (index) => index === -1
      )
    ) {
      return res.status(400).json({
        error:
          "Estrutura das abas de mobiles incompatível com a atualização em lote.",
      });
    }

    const preparedUpdates: Array<{
      range: string;
      values: string[][];
    }> = [];

    const skipped: Array<{
      coletor: string;
      app: string;
      reason: string;
    }> = [];

    for (const update of updates) {
      const sourceRow =
        controleValues[
          update.rowIndex - 1
        ] || [];

      const coletor = String(
        sourceRow[controleColetorIdx] ||
          update.rowData[
            controleColetorIdx
          ] ||
          ""
      ).trim();

      // O modal utiliza temporariamente os campos abaixo
      // como transporte até a refatoração do callback legado:
      // Status atualização -> APP_USO
      // Status -> usuário responsável
      const selectedApp = String(
        update.rowData[
          controleStatusAtualizacaoIdx
        ] || ""
      ).trim();

      const newVersion = String(
        update.rowData[
          controleVersaoIdx
        ] || ""
      ).trim();

      const updateDate = String(
        update.rowData[
          controleDataIdx
        ] || ""
      ).trim();

      const responsible = String(
        update.rowData[
          controleStatusIdx
        ] || ""
      ).trim();

      const observation =
        controleObsIdx !== -1
          ? String(
              update.rowData[
                controleObsIdx
              ] || ""
            ).trim()
          : "";

      if (
        !coletor ||
        !selectedApp ||
        !newVersion
      ) {
        skipped.push({
          coletor: coletor || "Não informado",
          app: selectedApp || "Não informado",
          reason:
            "Coletor, aplicativo ou versão não informados.",
        });
        continue;
      }

      const matchingIndexes: number[] = [];

      appsValues
        .slice(1)
        .forEach((row, index) => {
          const rowColetor = String(
            row[appColetorIdx] || ""
          ).trim();
          const rowApp = String(
            row[appUsoIdx] || ""
          ).trim();

          if (
            normalize(rowColetor) ===
              normalize(coletor) &&
            normalize(rowApp) ===
              normalize(selectedApp)
          ) {
            matchingIndexes.push(index + 1);
          }
        });

      if (matchingIndexes.length === 0) {
        skipped.push({
          coletor,
          app: selectedApp,
          reason:
            "Aplicativo não cadastrado para este equipamento.",
        });
        continue;
      }

      if (matchingIndexes.length > 1) {
        skipped.push({
          coletor,
          app: selectedApp,
          reason:
            "Mais de um registro encontrado para o mesmo Coletor e App.",
        });
        continue;
      }

      const appArrayIndex =
        matchingIndexes[0];
      const appRow = [
        ...(appsValues[appArrayIndex] || []),
      ];

      while (
        appRow.length < appHeaders.length
      ) {
        appRow.push("");
      }

      const oldVersion = String(
        appRow[appVersaoIdx] || ""
      ).trim();

      const versionChanged =
        oldVersion !== newVersion;

      appRow[appVersaoIdx] =
        newVersion;

      if (versionChanged) {
        appRow[appDataIdx] =
          updateDate;
        appRow[appResponsavelIdx] =
          responsible;

        const currentCounter =
          Number(
            String(
              appRow[appContadorIdx] || "0"
            )
              .trim()
              .replace(",", ".")
          ) || 0;

        appRow[appContadorIdx] =
          String(currentCounter + 1);
      }

      if (
        appObsIdx !== -1 &&
        observation
      ) {
        appRow[appObsIdx] =
          observation;
      }

      if (
        !versionChanged &&
        !observation
      ) {
        skipped.push({
          coletor,
          app: selectedApp,
          reason:
            "A versão informada já é a versão atual.",
        });
        continue;
      }

      const sheetRowIndex =
        appArrayIndex + 1;

      preparedUpdates.push({
        range: `${APPS_SHEET}!A${sheetRowIndex}`,
        values: [appRow],
      });
    }

    if (preparedUpdates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: preparedUpdates,
        },
      });
    }

    return res.status(200).json({
      success: true,
      updated: preparedUpdates.length,
      skipped: skipped.length,
      skippedItems: skipped,
    });
  } catch (error: any) {
    console.error(
      "Erro na atualização em lote de apps:",
      error
    );

    return res.status(500).json({
      error:
        error.message ||
        "Erro interno ao atualizar aplicativos dos equipamentos.",
    });
  }
}
