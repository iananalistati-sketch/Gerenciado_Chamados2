/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import ConcluirModal from "./components/ConcluirModal";
import Dashboard from "./components/Dashboard";
import ChamadosTable from "./components/ChamadosTable";
import CobrancaModal from "./components/CobrancaModal";
import FiltroModal from "./components/FiltroModal";
import Login from "./components/Login";
import { useAuth } from "./contexts/AuthContext";

/**
 * App.tsx - Mínimo Funcional
 * Focado apenas na lógica de leitura e escrita no Google Sheets.
 */

function AppContent() {
  const { user, logout } = useAuth();
  const [data, setData] = useState<string[][]>([]);
  // allData: Armazena os dados de todas as abas carregadas
  const [allData, setAllData] = useState<Record<string, string[][]>>({
    tbChamadosMV: [],
    tbChamadosForhealth: []
  });
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [selectedSheet, setSelectedSheet] = useState('tbChamadosMV');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<{
    columnIndex: number | null;
    direction: "asc" | "desc";
  }>({
    columnIndex: null,
    direction: "asc"
  });
  const itemsPerPage = 10;
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  //const [editingRow, setEditingRow] = useState<any>(null);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [showCobrarModal, setShowCobrarModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showConcluirModal, setShowConcluirModal] = useState(false);
  
  const [rowToConclude, setRowToConclude] =
  useState<{
      row: string[];
      rowIndex: number;
  } | null>(null);
  
  const [conclusionDate, setConclusionDate] =
    useState("");
  const [sheetFilters, setSheetFilters] = useState<Record<string, Record<string, string>>>({
    tbChamadosMV: {},
    tbChamadosForhealth: {}
  });
  const [error, setError] = useState<string | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);

  // Helper para normalizar cabeçalhos (remove acentos, espaços e padroniza caixa)
  const normalize = (str: string) => 
    (str || "")
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();

  const fetchData = async () => {
  setLoading(true);
  setError(null);

  try {
    const res = await fetch(`/api/data?sheet=${selectedSheet}`);
    const json = await res.json();
    
    const values = Array.isArray(json)
      ? json.filter((row) => Array.isArray(row))
      : [];
    
    // 🔥 ADICIONE ISSO AQUI
    values.forEach((row, i) => {
      (row as any)._originalIndex = i + 1;
    });



    setData(values);
    setAllData(prev => ({ ...prev, [selectedSheet]: values }));
    setFormData({});
  } catch (e: any) {
    setError(e.message);
  } finally {
    setLoading(false);
  }
};


  useEffect(() => {
    fetchData();
  }, [selectedSheet]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedSheet]);

  useEffect(() => {
    const headers = data[0] || [];
  
    const excluidoHeader = headers.find(
      header => normalize(header) === "excluido"
    );
  
    if (!excluidoHeader) {
      return;
    }
  
    setSheetFilters(prev => {
      const currentSheetFilters =
        prev[selectedSheet] || {};
  
      if (
        Object.prototype.hasOwnProperty.call(
          currentSheetFilters,
          excluidoHeader
        )
      ) {
        return prev;
      }
  
      return {
        ...prev,
        [selectedSheet]: {
          ...currentSheetFilters,
          [excluidoHeader]: "NAO"
        }
      };
    });
  }, [data, selectedSheet]);

    const handleSaveRow = async (rowData: string[], rowIndex: number) => {
      setLoading(true);

      console.log("SALVANDO LINHA", { rowData, rowIndex, selectedSheet });
      
      console.log("DEBUG ENVIO:", {
        data: rowData,
        rowIndex,
        sheet: selectedSheet
      });
    
      try {
      const res = await fetch('/api/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowData,
          rowIndex,
          sheet: selectedSheet
        }),
      });
  
      if (res.ok) {
        fetchData();
      } else {
        const err = await res.json();
        alert('Erro ao salvar linha: ' + (err.error));
      }
    } catch (e: any) {
      alert('Erro de rede: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
  
    const rowData = prepareFormRow();

    if (!rowData) {
      return;
    }
  
    console.log("FORM SUBMIT:", {
      rowData,
      isEdit,
      selectedSheet,
      editingRowIndex
    });
  
    try {
      if (isEdit) {
        if (editingRowIndex === null) {
          alert("Erro: índice da linha não definido");
          return;
        }
  
        await handleSaveRow(rowData as string[], editingRowIndex);
  
        alert("Alteração salva com sucesso ✅");
  
      } else {
        await onAdd(e);
        alert("Chamado criado com sucesso ✅");
      }
  
      // 🔥 FECHAR MODAL
      setShowForm(false);
  
      // 🔥 LIMPAR ESTADOS
      setFormData({});
      setEditingRowIndex(null);
      setIsEdit(false);
  
      // 🔥 GARANTIR REFRESH FINAL
      fetchData();
  
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    }
  };


  const handleAddRow = async (newRow: string[]) => {
  setLoading(true);
  try {
    const res = await fetch('/api/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        data: newRow,
        sheet: selectedSheet 
      }),
    });

    if (res.ok) {
      fetchData();
    } else {
      const err = await res.json();
      alert('Erro ao adicionar: ' + err.error);
    }
  } catch (e: any) {
    alert('Erro de rede: ' + e.message);
  } finally {
    setLoading(false);
  }
};

  const onAdd = async (e: any) => {
  e.preventDefault();

  const rowData = prepareFormRow();

  if (!rowData) {
    return;
  }

  try {
    const res = await fetch('/api/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rowData,
        sheet: selectedSheet
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      throw new Error(result.error);
    }

    alert("Chamado criado com sucesso ✅");

    setShowForm(false);
    setFormData({});
    fetchData();

  } catch (err: any) {
    alert("Erro ao criar: " + err.message);
  }
};


  const handleOpenForm = () => {
    setIsEdit(false);
    setEditingRowIndex(null);
    const today = new Date().toISOString().split('T')[0];
    
    const headers = data[0] || [];
    const newValues: Record<string, string> = {};

    headers.forEach(h => {
    const hNorm = normalize(h);
  
    if (
      hNorm.includes("data") &&
      hNorm.includes("abertura")
    ) {
      newValues[h] = today;
    }
  
    if (
      hNorm.includes("metodo") &&
      hNorm.includes("acionamento")
    ) {
      newValues[h] = "Email";
    }
  
    if (
      (
        selectedSheet === "tbChamadosMV" ||
        selectedSheet === "tbChamadosForhealth"
      ) &&
      (
        hNorm === "cobranca" ||
        hNorm === "excluido"
      )
    ) {
      newValues[h] = "NAO";
    }
  });
    
    setFormData(newValues);
    setShowForm(true);
  };

    const parseDateToNumber = (value: string): number | null => {
    if (!value) return null;
  
    const cleanValue = String(value).trim();
  
    // Formato AAAA-MM-DD
    const isoMatch = cleanValue.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})/
    );
  
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
  
      return Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day)
      );
    }
  
    // Formato DD/MM/AAAA
    const brMatch = cleanValue.match(
      /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
    );
  
    if (brMatch) {
      const [, day, month, year] = brMatch;
  
      return Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day)
      );
    }
  
    return null;
  };
  
  const handleEdit = (row: string[]) => {
    setEditingRow([...row]);
    // Busca o índice original armazenado na linha durante o fetchData
    const rowIndex = (row as any)._originalIndex;
    
    if (rowIndex === undefined) {
      console.warn("RowIndex não encontrado na linha selecionada. Tentando fallback...");
      const idx = data.indexOf(row);
      if (idx === -1) return;
      setEditingRowIndex(idx + 1);
    } else {
      setEditingRowIndex(rowIndex);
    }
    
    setIsEdit(true);
    
    const headers = data[0] || [];
    const newValues: Record<string, string> = {};
    
    const today = new Date()
      .toISOString()
      .split("T")[0];
    
    headers.forEach((h, i) => {
      const headerName = normalize(h);
    
      if (
        headerName.includes("data") &&
        headerName.includes("ultima") &&
        headerName.includes("interacao")
      ) {
        newValues[h] = today;
      } else {
        newValues[h] = row[i] || "";
      }
    });
    
    setFormData(newValues);
    setShowForm(true);
  };

  const handleDeleteCurrentRow = async () => {
    if (!isEdit || editingRowIndex === null) {
      alert(
        "Não foi possível identificar o chamado para exclusão."
      );
      return;
    }
  
    const confirmed = window.confirm(
      "Confirma a exclusão deste chamado?\n\n" +
      "O registro será marcado como excluído e poderá ser consultado em \"Ver Excluídos\"."
    );
  
    if (!confirmed) {
      return;
    }
  
    const headers = data[0] || [];
  
    const excluidoIdx = headers.findIndex(
      header => normalize(header) === "excluido"
    );
  
    if (excluidoIdx === -1) {
      alert(
        "A coluna Excluído não foi encontrada."
      );
      return;
    }
  
    /*
     * Usa os dados originais da linha em edição.
     * Isso evita perder valores de campos ocultos.
     */
    if (!editingRow) {
      alert(
        "Não foi possível recuperar os dados originais do chamado."
      );
      return;
    }
  
    const updatedRow = [...editingRow];
  
    /*
     * Altera somente Excluído para SIM.
     */
    updatedRow[excluidoIdx] = "SIM";
  
    try {
      await handleSaveRow(
        updatedRow,
        editingRowIndex
      );
  
      setShowForm(false);
      setFormData({});
      setEditingRow(null);
      setEditingRowIndex(null);
      setIsEdit(false);
  
      alert(
        "Chamado marcado como excluído com sucesso."
      );
    } catch (error: any) {
      alert(
        "Erro ao excluir o chamado: " +
        error.message
      );
    }
  };

  const getTodayISO = () => {
    const now = new Date();
  
    const localDate = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    );
  
    return localDate.toISOString().split("T")[0];
  };
  
  const handleOpenConcluirModal = (row: string[]) => {

      const rowIndex = (row as any)._originalIndex;
  
      setRowToConclude({
          row: [...row],
          rowIndex
      });
  
      setConclusionDate(getTodayISO());
  
      setShowConcluirModal(true);
  };
  
  const handleCloseConcluirModal = () => {
    setShowConcluirModal(false);
    setRowToConclude(null);
    setConclusionDate("");
  };
  
  const handleConfirmConclusion = async () => {
    if (!rowToConclude) {
      alert("Não foi possível identificar o chamado.");
      return;
    }
  
    if (!conclusionDate) {
      alert("Informe a Data da Última Interação.");
      return;
    }
  
    const headers = data[0] || [];
  
    const situacaoIdx = headers.findIndex(
      header => normalize(header) === "situacao"
    );
  
    const dataUltimaInteracaoIdx = headers.findIndex(header => {
      const headerName = normalize(header);
  
      return (
        headerName.includes("data") &&
        headerName.includes("ultima") &&
        headerName.includes("interacao")
      );
    });
  
    if (situacaoIdx === -1) {
      alert("A coluna Situação não foi encontrada.");
      return;
    }
  
    if (dataUltimaInteracaoIdx === -1) {
      alert(
        "A coluna Data da Última Interação não foi encontrada."
      );
      return;
    }
  
    const rowIndex = rowToConclude.rowIndex;
  
    if (rowIndex === undefined || rowIndex === null) {
      alert(
        "Não foi possível identificar o índice original do chamado."
      );
      return;
    }
  
    const updatedRow = [...rowToConclude.row];
  
    updatedRow[situacaoIdx] = "Concluído";
    updatedRow[dataUltimaInteracaoIdx] = conclusionDate;
  
    try {
      await handleSaveRow(updatedRow, rowIndex);
  
      handleCloseConcluirModal();
  
      alert("Chamado concluído com sucesso.");
    } catch (error: any) {
      alert(
        "Erro ao concluir chamado: " +
        error.message
      );
    }
  };

  const handleInputChange = (header: string, value: string) => {
    setFormData(prev => ({ ...prev, [header]: value }));
  };

  const prepareFormRow = (): string[] | null => {
    const headers = data[0] || [];
  
    const preparedData: Record<string, string> = {
      ...formData
    };
  
    /*
     * Preenche Cobrança e Excluído com NAO
     * nas duas abas, quando estiverem vazios.
     */
    headers.forEach(header => {
      const headerName = normalize(header);
  
      if (
        headerName === "cobranca" ||
        headerName === "excluido"
      ) {
        const value = preparedData[header];
  
        if (!value || String(value).trim() === "") {
          preparedData[header] = "NAO";
        }
      }
    });
  
    let requiredHeaders: string[] = [];
  
    /*
     * Campos obrigatórios da aba MV
     */
    if (selectedSheet === "tbChamadosMV") {
      requiredHeaders = headers.filter(header => {
        const headerName = normalize(header);
  
        return (
          (
            headerName.includes("numero") &&
            headerName.includes("chamado")
          ) ||
          headerName === "titulo" ||
          (
            headerName.includes("descricao") &&
            headerName.includes("problema")
          ) ||
          headerName === "situacao" ||
          (
            headerName.includes("data") &&
            headerName.includes("abertura")
          ) ||
          (
            headerName.includes("data") &&
            headerName.includes("ultima") &&
            headerName.includes("interacao")
          ) ||
          headerName === "gravidade" ||
          headerName === "responsavel"
        );
      });
    }
  
    /*
     * Campos obrigatórios da aba ForHealth
     */
    if (selectedSheet === "tbChamadosForhealth") {
      requiredHeaders = headers.filter(header => {
        const headerName = normalize(header);
  
        return (
          (
            headerName.includes("os") &&
            headerName.includes("aberta")
          ) ||
          (
            headerName.includes("metodo") &&
            headerName.includes("acionamento")
          ) ||
          headerName === "titulo" ||
          (
            headerName.includes("descricao") &&
            headerName.includes("problema")
          ) ||
          headerName === "situacao" ||
          (
            headerName.includes("data") &&
            headerName.includes("abertura")
          ) ||
          (
            headerName.includes("data") &&
            headerName.includes("ultima") &&
            headerName.includes("interacao")
          ) ||
          headerName === "gravidade" ||
          headerName === "responsavel"
        );
      });
    }
  
    const missingHeaders = requiredHeaders.filter(header => {
      const value = preparedData[header];
  
      return !value || String(value).trim() === "";
    });
  
    if (missingHeaders.length > 0) {
      alert(
        "Preencha os campos obrigatórios:\n\n" +
        missingHeaders
          .map(header => `• ${header}`)
          .join("\n")
      );
  
      return null;
    }
  
    return headers.map(
      header => preparedData[header] || ""
    );
  };
  
  const updateFilter = (header: string, value: string) => {
    
    console.log("updateFilter:", header, value);
    
    setSheetFilters(prev => ({
      ...prev,
      [selectedSheet]: {
        ...prev[selectedSheet],
        [header]: value
      }
    }));
    setCurrentPage(1);
  };

  const handleToggleDeleted = () => {
    const headers = data[0] || [];
  
    const excluidoHeader = headers.find(
      header => normalize(header) === "excluido"
    );
  
    const nextShowDeleted = !showDeleted;
    const nextFilterValue = nextShowDeleted
      ? "SIM"
      : "NAO";
  
    setShowDeleted(nextShowDeleted);
  
    if (!excluidoHeader) {
      return;
    }
  
    setSheetFilters(prev => ({
      ...prev,
      [selectedSheet]: {
        ...(prev[selectedSheet] || {}),
        [excluidoHeader]: nextFilterValue
      }
    }));
  
    setCurrentPage(1);
  };

  const clearFilters = () => {
    const headers = data[0] || [];
  
    const excluidoHeader = headers.find(
      header => normalize(header) === "excluido"
    );
  
    setSheetFilters(prev => ({
      ...prev,
      [selectedSheet]: excluidoHeader
        ? {
            [excluidoHeader]: showDeleted
              ? "SIM"
              : "NAO"
          }
        : {}
    }));
  
    setCurrentPage(1);
  };

  const handleSort = (columnIndex: number) => {
    setSortConfig(prev => {
      if (prev.columnIndex === columnIndex) {
        return {
          columnIndex,
          direction: prev.direction === "asc" ? "desc" : "asc"
        };
      }
  
      return {
        columnIndex,
        direction: "asc"
      };
    });
  
    setCurrentPage(1);
  };

  const handleDashboardFilter = (
    normalizedHeader: string,
    selectedValue: string
  ) => {
    const actualHeader = headers.find(
      header => normalize(header) === normalizedHeader
    );
  
    if (!actualHeader) {
      console.warn(
        `Coluna não encontrada para o filtro: ${normalizedHeader}`
      );
      return;
    }
  
    const currentValue =
      sheetFilters[selectedSheet]?.[actualHeader] || "";
  
    // Se clicar novamente no mesmo valor, remove o filtro.
    const nextValue =
      currentValue === selectedValue
        ? ""
        : selectedValue;
  
    updateFilter(actualHeader, nextValue);
  };
  
  type ColumnConfig =
  | {
      type: "select";
      options: string[];
    }
  | {
      type: "date" | "number" | "text";
      options?: never;
    };

  // Heurística para identificar o tipo de dado da coluna
  const getColumnConfig = (
    header: string,
    index: number
  ): ColumnConfig => {
    const rawValues: string[] = data
      .slice(1)
      .map(row => String(row[index] || "").trim())
      .filter((value): value is string => value !== "");

    const uniqueValues: string[] = Array.from(
      new Set<string>(rawValues)
    ).sort((a, b) =>
      a.localeCompare(b, "pt-BR", {
        sensitivity: "base"
      })
    );
    
    // Se tem poucas opções, vira Select
    if (uniqueValues.length > 0 && uniqueValues.length <= 12) {
      return { type: 'select', options: uniqueValues };
    }
    
    // Se parece data (DD/MM/AAAA ou AAAA-MM-DD)
    const dateSample = rawValues.find(v => v.match(/^\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/));
    if (dateSample) {
      return { type: 'date' };
    }

    // Se é numérico
    const numSample = rawValues.find(v => v !== "" && !isNaN(Number(v.replace(',', '.'))));
    if (numSample && rawValues.every(v => v === "" || !isNaN(Number(v.replace(',', '.'))))) {
      return { type: 'number' };
    }

    return { type: 'text' };
  };
  
  // Extração dinâmica de valores únicos para os filtros e campos
  const headers = data[0] || [];

  const cobIdx = headers.findIndex(h => normalize(h) === "cobranca");
  const currentSheetCount = cobIdx !== -1 
    ? data.slice(1).filter(row => (row[cobIdx] || "").trim().toUpperCase() === "SIM").length 
    : 0;
  
  const exportToExcel = () => {
    // Busca os índices das colunas de identificação e cobrança
    const headers = data[0] || [];
    const idIdx = headers.findIndex(h => normalize(h).includes("numero") && normalize(h).includes("chamado"));
    const fallbackIdx = headers.findIndex(h => normalize(h).includes("os") && normalize(h).includes("aberta"));
    const cobrancaIdx = headers.findIndex(h => normalize(h) === "cobranca");
    const finalIdx = idIdx !== -1 ? idIdx : fallbackIdx;

    const selectedRows = data.slice(1).filter(row => {
      return cobrancaIdx !== -1 && (row[cobrancaIdx] || "").trim().toUpperCase() === "SIM";
    });
    
    if (selectedRows.length === 0) {
        alert("Nenhum chamado marcado para cobrança nesta aba.");
        return;
    }

    const csvContent = [
      headers.join(';'),
      ...selectedRows.map(row => 
        headers.map((_, i) => {
          let val = row[i] || "";
          val = val.toString().replace(/"/g, '""');
          return `"${val}"`;
        }).join(';')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `cobranca_${selectedSheet}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

    const exportFilteredData = () => {
    const currentFilters = sheetFilters[selectedSheet] || {};
    const currentHeaders = data[0] || [];
  
    const filteredData = data.slice(1).filter(row => {
      return Object.entries(currentFilters).every(
        ([header, filterValue]) => {
          if (!filterValue) return true;
  
          const isDataInicio =
            header.endsWith("__inicio");
  
          const isDataFim =
            header.endsWith("__fim");
  
          // Tratamento dos filtros de período
          if (isDataInicio || isDataFim) {
            const originalHeader = header
              .replace("__inicio", "")
              .replace("__fim", "");
  
            const dataColIdx = currentHeaders.findIndex(
              currentHeader =>
                normalize(currentHeader) ===
                normalize(originalHeader)
            );
  
            if (dataColIdx === -1) {
              return true;
            }
  
            const dataCelula = parseDateToNumber(
              row[dataColIdx] || ""
            );
  
            const dataFiltro = parseDateToNumber(
              String(filterValue)
            );
  
            if (
              dataCelula === null ||
              dataFiltro === null
            ) {
              return false;
            }
  
            if (isDataInicio) {
              return dataCelula >= dataFiltro;
            }
  
            return dataCelula <= dataFiltro;
          }
  
          // Demais filtros
          const colIdx = currentHeaders.findIndex(
            currentHeader =>
              normalize(currentHeader) ===
              normalize(header)
          );
  
          if (colIdx === -1) {
            return true;
          }
  
          const cellValue = (row[colIdx] || "")
            .toString()
            .trim()
            .toLowerCase();
  
          const searchVal = String(filterValue)
            .trim()
            .toLowerCase();
  
          // Se possuir múltiplos valores
          if (searchVal.includes("|")) {
            const filtros = searchVal
              .split("|")
              .map(value => value.trim())
              .filter(Boolean);
  
            return filtros.includes(cellValue);
          }
  
          // Filtro normal
          return cellValue.includes(searchVal);
        }
      );
    });

    if (filteredData.length === 0) return;

    const csvContent = [
      currentHeaders.join(';'),
      ...filteredData.map(row => 
        currentHeaders.map((_, i) => {
          let val = row[i] || "";
          val = val.toString().replace(/"/g, '""');
          return `"${val}"`;
        }).join(';')
      )
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `filtros_${selectedSheet}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };
  
  const activeFilterCount = (() => {
    const filters = sheetFilters[selectedSheet] || {};
  
    let count = 0;
    let hasDatePeriod = false;
  
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
  
      if (
        key.endsWith("__inicio") ||
        key.endsWith("__fim")
      ) {
        hasDatePeriod = true;
        return;
      }
  
      count++;
    });
  
    if (hasDatePeriod) {
      count++;
    }
  
    return count;
  })();

  // Lógica de filtragem centralizada para Dashboard e Tabela
  const currentFilters = sheetFilters[selectedSheet] || {};
  const situacaoIdx = data[0]?.findIndex(h => normalize(h) === "situacao");
  const excluidoIdx = data[0]?.findIndex(h => normalize(h) === "excluido");

  const filteredData = data.slice(1).filter(row => {
    const headers = data[0] || [];
    const excluidoIdx = headers.findIndex(h => normalize(h) === "excluido");
    
    // Physical Exclusion Filter
    const isExcluded = excluidoIdx !== -1 && (row[excluidoIdx] || "").trim().toUpperCase() === "SIM";
    if (showDeleted) {
        if (!isExcluded) return false;
    } else {
        if (isExcluded) return false;
    }

    return Object.entries(currentFilters).every(([header, filterValue]) => {
      if (!filterValue) return true;

      const isDataInicio = header.endsWith("__inicio");
      const isDataFim = header.endsWith("__fim");
      
      if (isDataInicio || isDataFim) {
        const originalHeader = header
          .replace("__inicio", "")
          .replace("__fim", "");
      
        const dataColIdx = headers.findIndex(
          h => normalize(h) === normalize(originalHeader)
        );
      
        if (dataColIdx === -1) return true;
      
        const dataCelula = parseDateToNumber(
          row[dataColIdx] || ""
        );
      
        const dataFiltro = parseDateToNumber(
          String(filterValue)
        );
      
        if (dataCelula === null || dataFiltro === null) {
          return false;
        }
      
        if (isDataInicio) {
          return dataCelula >= dataFiltro;
        }
      
        return dataCelula <= dataFiltro;
      }
      
      const colIdx = headers.findIndex(
          h => normalize(h) === normalize(header)
      );
      if (colIdx === -1) return true;
      
      const cellValue = (row[colIdx] || "")
        .toString()
        .trim()
        .toLowerCase();
      
      const searchVal = String(filterValue)
        .trim()
        .toLowerCase();
      
      if (searchVal.includes("|")) {
      
          const filtros = searchVal
              .split("|")
              .map(v => v.trim())
              .filter(Boolean);
      
          return filtros.some(f => f === cellValue);
      }
      
      return cellValue.includes(searchVal);
    });
  });

  const sortedData = [...filteredData].sort((rowA, rowB) => {
    const columnIndex = sortConfig.columnIndex;
  
    if (columnIndex === null) {
      return 0;
    }
  
    const header = headers[columnIndex] || "";
    const normalizedHeader = normalize(header);
  
    const valueA = (rowA[columnIndex] || "").toString().trim();
    const valueB = (rowB[columnIndex] || "").toString().trim();
  
    let comparison = 0;
  
    // Ordenação de datas
    if (normalizedHeader.includes("data")) {
      const dateA = parseDateToNumber(valueA);
      const dateB = parseDateToNumber(valueB);
  
      if (dateA === null && dateB === null) {
        comparison = 0;
      } else if (dateA === null) {
        comparison = 1;
      } else if (dateB === null) {
        comparison = -1;
      } else {
        comparison = dateA - dateB;
      }
  
    // Ordenação numérica
    } else if (
      valueA !== "" &&
      valueB !== "" &&
      !isNaN(Number(valueA.replace(",", "."))) &&
      !isNaN(Number(valueB.replace(",", ".")))
    ) {
      comparison =
        Number(valueA.replace(",", ".")) -
        Number(valueB.replace(",", "."));
  
    // Ordenação textual
    } else {
      comparison = valueA.localeCompare(valueB, "pt-BR", {
        sensitivity: "base",
        numeric: true
      });
    }
  
    return sortConfig.direction === "asc"
      ? comparison
      : -comparison;
  });
  
  const groupBy = (data: string[][], index: number) => {
    return data.reduce((acc: Record<string, number>, row) => {
      const key = (row[index] || "Não informado").trim() || "Não informado";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  };

  const getDashboardStats = () => {
    const sIdx = headers.findIndex(h => normalize(h) === "situacao");
    const gIdx = headers.findIndex(h => normalize(h) === "gravidade");
    const rIdx = headers.findIndex(h => normalize(h) === "responsavel");

    const statusMap = sIdx !== -1 ? groupBy(filteredData, sIdx) : {};
    const gravityMap = gIdx !== -1 ? groupBy(filteredData, gIdx) : {};
    const responsibleMap = rIdx !== -1 ? groupBy(filteredData, rIdx) : {};

    const criticalCount = Object.entries(gravityMap)
      .filter(([k]) => k.toLowerCase() === 'crítico' || k.toLowerCase() === 'urgente')
      .reduce((sum, [, v]) => sum + v, 0);

    const completedCount = Object.entries(statusMap)
      .filter(([k]) => k.toLowerCase() === 'concluído' || k.toLowerCase() === 'finalizado')
      .reduce((sum, [, v]) => sum + v, 0);

    return { statusMap, gravityMap, responsibleMap, criticalCount, completedCount };
  };

  const stats = getDashboardStats();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (logoutError) {
      console.error("Erro ao encerrar sessão:", logoutError);
      alert("Não foi possível encerrar a sessão.");
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#0F172A', 
      color: '#E2E8F0',
      padding: '40px 20px', 
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif' 
    }}>
      <div
        style={{
          width: "100%",
          maxWidth: "none",
          margin: "0 auto"
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '20px',
            flexWrap: 'wrap',
            marginBottom: '32px'
          }}
        >
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', color: '#F8FAFC' }}>
              Gestor de Chamados
            </h1>
            <p style={{ color: '#94A3B8', margin: 0 }}>Base de dados via Google Sheets</p>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 12px',
              backgroundColor: '#1E293B',
              border: '1px solid #334155',
              borderRadius: '10px'
            }}
          >
            <span style={{ fontSize: '13px', color: '#CBD5E1' }}>
              {user?.email || 'Usuário autenticado'}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              style={{
                padding: '8px 14px',
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600'
              }}
            >
              Sair
            </button>
          </div>
        </div>
        
        <div style={{ 
          marginBottom: '32px', 
          padding: '20px', 
          backgroundColor: '#1E293B', 
          borderRadius: '12px',
          border: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <label style={{ fontSize: '14px', fontWeight: '600', color: '#94A3B8' }}>Selecionar Aba:</label>
          <select 
            value={selectedSheet} 
            onChange={(e) => setSelectedSheet(e.target.value)}
            style={{ 
              padding: '8px 12px', 
              fontSize: '14px', 
              backgroundColor: '#0F172A', 
              color: '#F8FAFC', 
              border: '1px solid #334155',
              borderRadius: '6px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="tbChamadosMV">MV</option>
            <option value="tbChamadosForhealth">ForHealth</option>
          </select>
          <div style={{ width: '1px', height: '24px', backgroundColor: '#334155', margin: '0 10px' }}></div>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            A estrutura de campos é atualizada dinamicamente conforme a aba.
          </span>
        </div>

        {!loading && data.length > 1 && (
          <Dashboard
            totalFiltered={filteredData.length}
            stats={stats}
            onFilter={handleDashboardFilter}
          />
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Cabeçalho de Ações e Filtros */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: '20px'
          }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setShowFilterModal(true)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#1E293B',
                  color: activeFilterCount > 0 ? '#3B82F6' : '#94A3B8',
                  border: activeFilterCount > 0 ? '1px solid #3B82F6' : '1px solid #334155',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#334155';
                  e.currentTarget.style.color = '#F8FAFC';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#1E293B';
                  e.currentTarget.style.color = activeFilterCount > 0 ? '#3B82F6' : '#94A3B8';
                }}
              >
                <span>🔍</span> 
                {activeFilterCount > 0 ? `Filtros Ativos (${activeFilterCount})` : 'Filtrar Dados'}
              </button>

              <button 
                onClick={handleToggleDeleted}
                style={{
                  padding: '12px 20px',
                  backgroundColor: showDeleted ? '#334155' : '#1E293B',
                  color: showDeleted ? '#3B82F6' : '#94A3B8',
                  border: showDeleted ? '1px solid #3B82F6' : '1px solid #334155',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>{showDeleted ? '👁️' : '🕶️'}</span>
                {showDeleted ? 'Ocultar Excluídos' : 'Ver Excluídos'}
              </button>

              {activeFilterCount > 0 && (
                <button 
                  onClick={exportFilteredData}
                  style={{
                    padding: '12px 20px',
                    backgroundColor: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#047857'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                >
                  <span>📥</span> Exportar Filtros
                </button>
              )}

              <button 
                onClick={fetchData} 
                style={{ 
                  padding: '0 20px', 
                  backgroundColor: '#1E293B', 
                  color: '#94A3B8', 
                  border: '1px solid #334155', 
                  borderRadius: '10px', 
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: '600',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#334155';
                  e.currentTarget.style.color = '#F8FAFC';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#1E293B';
                  e.currentTarget.style.color = '#94A3B8';
                }}
              >
                ↻ Atualizar
              </button>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={() => setShowCobrarModal(true)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: currentSheetCount > 0 ? '#EF4444' : '#334155',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  fontSize: '14px',
                  boxShadow: currentSheetCount > 0 ? '0 4px 6px -1px rgba(239, 68, 68, 0.5)' : 'none'
                }}
              >
                Cobrança
                {currentSheetCount > 0 && (
                  <span style={{
                    backgroundColor: 'white',
                    color: '#EF4444',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {currentSheetCount}
                  </span>
                )}
              </button>

              <button 
                onClick={handleOpenForm}
                style={{ 
                  padding: '12px 24px', 
                  backgroundColor: '#3B82F6', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '10px', 
                  cursor: 'pointer',
                  fontWeight: '600',
                  fontSize: '14px',
                  boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.2)',
                  transition: 'transform 0.1s, background 0.2s'
                }}
                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
              >
                + Adicionar Chamado
              </button>
            </div>
          </div>

          <ChamadosTable
            loading={loading}
            error={error}
            headers={data}
            sortedData={sortedData}
            currentPage={currentPage}
            itemsPerPage={itemsPerPage}
            sortConfig={sortConfig}
            normalize={normalize}
            onSort={handleSort}
            onEdit={handleEdit}
            onToggleCobranca={handleSaveRow}
            onConcluir={handleOpenConcluirModal}
          />

          {/* Controles de Paginação */}
          {!loading && data.length > 0 && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '20px', 
              marginTop: '16px',
              padding: '16px',
              backgroundColor: '#1E293B',
              borderRadius: '12px',
              border: '1px solid #334155'
            }}>
                      {(() => {
                        const totalPages = Math.max(1, Math.ceil(filteredData.length / itemsPerPage));

                return (
                  <>
                    <button 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      style={{ 
                        padding: '8px 16px', 
                        backgroundColor: currentPage === 1 ? '#0F172A' : '#334155', 
                        color: currentPage === 1 ? '#475569' : '#F8FAFC',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      ← Anterior
                    </button>
                    <span style={{ fontSize: '14px', color: '#94A3B8', fontWeight: '500' }}>
                      Página <strong style={{ color: '#F8FAFC' }}>{currentPage}</strong> de <strong style={{ color: '#F8FAFC' }}>{totalPages}</strong>
                      <span style={{ marginLeft: '10px', opacity: 0.6, fontSize: '12px' }}>
                        ({filteredData.length} registros)
                      </span>
                    </span>
                    <button 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      style={{ 
                        padding: '8px 16px', 
                        backgroundColor: currentPage === totalPages ? '#0F172A' : '#334155', 
                        color: currentPage === totalPages ? '#475569' : '#F8FAFC',
                        border: '1px solid #475569',
                        borderRadius: '8px',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '13px',
                        fontWeight: '600'
                      }}
                    >
                      Próxima →
                    </button>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <CobrancaModal
          isOpen={showCobrarModal}
          data={data}
          selectedSheet={selectedSheet}
          currentSheetCount={currentSheetCount}
          normalize={normalize}
          onClose={() => setShowCobrarModal(false)}
          onSaveRow={handleSaveRow}
          onExport={exportToExcel}
        />  

        <ConcluirModal
          isOpen={showConcluirModal}
          conclusionDate={conclusionDate}
          onDateChange={setConclusionDate}
          onClose={handleCloseConcluirModal}
          onConfirm={handleConfirmConclusion}
        />

        <FiltroModal
          isOpen={showFilterModal}
          headers={headers}
          selectedSheet={selectedSheet}
          sheetFilters={sheetFilters}
          normalize={normalize}
          getColumnConfig={getColumnConfig}
          updateFilter={updateFilter}
          clearFilters={clearFilters}
          onClose={() => setShowFilterModal(false)}
        />

        {/* Modal do Formulário Dinâmico */}
        {showForm && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            backgroundColor: 'rgba(2, 6, 23, 0.8)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            zIndex: 1000,
            padding: '20px',
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{ 
              backgroundColor: '#1E293B', 
              padding: '32px', 
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              border: '1px solid #334155',
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
              animation: 'modalSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }}>
              <style>{`
                @keyframes modalSlideUp {
                  from { transform: translateY(30px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
                *::-webkit-scrollbar {
                  width: 8px;
                }
                *::-webkit-scrollbar-track {
                  background: #1E293B;
                }
                *::-webkit-scrollbar-thumb {
                  background: #334155;
                  border-radius: 10px;
                }
                *::-webkit-scrollbar-thumb:hover {
                  background: #475569;
                }
              `}</style>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#F8FAFC' }}>
                  {isEdit ? 'Editar Chamado' : 'Novo Registro'}
                </h3>
                <button 
                  onClick={() => setShowForm(false)}
                  style={{ background: '#334155', color: '#94A3B8', border: 'none', cursor: 'pointer', fontSize: '14px', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Fechar"
                >
                  ✕
                </button>
              </div>
              
              <p style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '32px' }}>
                Insira os detalhes na aba <strong>{selectedSheet}</strong>.
              </p>
              
              <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ 
                  overflowY: 'auto', 
                  marginBottom: '24px', 
                  paddingRight: '12px', 
                  flex: 1,
                  minHeight: 0
                }}>
                  {data[0]?.map((header, index) => {
                    const hClean = header.toLowerCase().trim();
                    const inputStyle: React.CSSProperties = { 
                      width: '100%', 
                      padding: '12px', 
                      borderRadius: '8px', 
                      border: '1px solid #334155', 
                      backgroundColor: '#0F172A', 
                      color: '#F8FAFC',
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    };
                    
                    return (
                      <div key={index} style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '8px', color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {header}
                        </label>
                        
                        {hClean.includes("situação") || hClean.includes("situacao") ? (
                          <select 
                            style={inputStyle}
                            value={formData[header] || ''}
                            onChange={(e) => handleInputChange(header, e.target.value)}
                            required
                          >
                            <option value="" style={{ backgroundColor: '#0F172A' }}>Selecione...</option>
                            <option value="Aberto" style={{ backgroundColor: '#0F172A' }}>Aberto</option>
                            <option value="Agendado" style={{ backgroundColor: '#0F172A' }}>Agendado</option>
                            <option value="Em andamento" style={{ backgroundColor: '#0F172A' }}>Em andamento</option>
                            <option value="Concluído" style={{ backgroundColor: '#0F172A' }}>Concluído</option>
                            <option value="Aguardando Atendimento" style={{ backgroundColor: '#0F172A' }}>Aguardando Atendimento</option>
                            <option value="Pendente Aplicação Pacote" style={{ backgroundColor: '#0F172A' }}>Pendente Aplicação Pacote</option>
                            <option value="Ticket Rejeitado" style={{ backgroundColor: '#0F172A' }}>Ticket Rejeitado</option>
                            <option value="Cancelado" style={{ backgroundColor: '#0F172A' }}>Cancelado</option>
                            <option value="Retorno Cliente" style={{ backgroundColor: '#0F172A' }}>Retorno Cliente</option>
                            <option value="Em Correção" style={{ backgroundColor: '#0F172A' }}>Em Correção</option>
                            <option value="Outros" style={{ backgroundColor: '#0F172A' }}>Outros</option>
                          </select>
                        ) : hClean.includes("gravidade") ? (
                            <select 
                              style={inputStyle}
                              value={formData[header] || ''}
                              onChange={(e) => handleInputChange(header, e.target.value)}
                              required
                            >
                              <option value="" style={{ backgroundColor: '#0F172A' }}>Selecione...</option>
                              <option value="Crítico" style={{ backgroundColor: '#0F172A' }}>Crítico</option>
                              <option value="Urgente" style={{ backgroundColor: '#0F172A' }}>Urgente</option>
                              <option value="Intermediário" style={{ backgroundColor: '#0F172A' }}>Intermediário</option>
                              <option value="Baixa" style={{ backgroundColor: '#0F172A' }}>Baixa</option>
                            </select>
                        ) : hClean.includes("responsável") || hClean.includes("responsavel") ? (
                          <select 
                            style={inputStyle}
                            value={formData[header] || ''}
                            onChange={(e) => handleInputChange(header, e.target.value)}
                          >
                            <option value="" style={{ backgroundColor: '#0F172A' }}>Selecione...</option>
                            {Array.from(new Set(data.slice(1).map(row => (row[index] || "").trim()).filter(v => v !== ""))).sort().map(name => (
                              <option key={name} value={name} style={{ backgroundColor: '#0F172A' }}>{name}</option>
                            ))}
                          </select>
                        ) : hClean.includes("método") || hClean.includes("metodo") ? (
                          <select 
                            style={inputStyle}
                            value={formData[header] || 'Email'}
                            onChange={(e) => handleInputChange(header, e.target.value)}
                          >
                            <option value="Email" style={{ backgroundColor: '#0F172A' }}>Email</option>
                            <option value="Telefone" style={{ backgroundColor: '#0F172A' }}>Telefone</option>
                            <option value="WhatsApp" style={{ backgroundColor: '#0F172A' }}>WhatsApp</option>
                            <option value="Portal" style={{ backgroundColor: '#0F172A' }}>Portal</option>
                          </select>
                        ) : hClean.includes("data") ? (
                          <input 
                            type="date"
                            style={inputStyle}
                            onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                            value={formData[header] || ''}
                            onChange={(e) => handleInputChange(header, e.target.value)}
                          />

                        ) : (
                          <input 
                            style={inputStyle}
                            onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                            value={formData[header] || ''}
                            onChange={(e) => handleInputChange(header, e.target.value)}
                            placeholder={`Digite ${header}...`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    paddingTop: '24px',
                    borderTop: '1px solid #334155',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    {isEdit && (
                      <button
                        type="button"
                        onClick={handleDeleteCurrentRow}
                        style={{
                          padding: '14px',
                          backgroundColor: '#DC2626',
                          color: '#FFFFFF',
                          fontWeight: '700',
                          cursor: 'pointer',
                          border: 'none',
                          borderRadius: '10px',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) =>
                          e.currentTarget.style.backgroundColor = '#B91C1C'
                        }
                        onMouseOut={(e) =>
                          e.currentTarget.style.backgroundColor = '#DC2626'
                        }
                      >
                        Excluir Chamado
                      </button>
                    )}
                  </div>
                
                  <div
                    style={{
                      display: 'flex',
                      gap: '12px'
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      style={{
                        padding: '14px',
                        backgroundColor: 'transparent',
                        color: '#94A3B8',
                        fontWeight: '600',
                        cursor: 'pointer',
                        border: '1px solid #334155',
                        borderRadius: '10px',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={(e) =>
                        e.currentTarget.style.backgroundColor = '#334155'
                      }
                      onMouseOut={(e) =>
                        e.currentTarget.style.backgroundColor = 'transparent'
                      }
                    >
                      Descartar
                    </button>
                
                    <button
                      type="submit"
                      style={{
                        minWidth: isEdit ? '160px' : 'auto',
                        padding: '14px',
                        backgroundColor: '#3B82F6',
                        color: '#fff',
                        fontWeight: '700',
                        cursor: 'pointer',
                        border: 'none',
                        borderRadius: '10px',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 6px -1px rgba(59, 130, 246, 0.4)'
                      }}
                      onMouseOver={(e) =>
                        e.currentTarget.style.backgroundColor = '#2563EB'
                      }
                      onMouseOut={(e) =>
                        e.currentTarget.style.backgroundColor = '#3B82F6'
                      }
                    >
                      {isEdit ? 'Salvar Alterações' : 'Criar Chamado'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0F172A',
          color: '#E2E8F0',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
        }}
      >
        Validando sessão...
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <AppContent />;
}