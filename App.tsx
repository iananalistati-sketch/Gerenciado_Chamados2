/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

/**
 * App.tsx - Mínimo Funcional
 * Focado apenas na lógica de leitura e escrita no Google Sheets.
 */

export default function App() {
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
  
    const headers = data[0] || [];
  
    // Cria uma cópia local para não alterar diretamente o estado.
    const normalizedFormData: Record<string, string> = {
      ...formData
    };
  
    // Somente na aba MV, preenche Cobrança e Excluído com NAO.
    if (selectedSheet === "tbChamadosMV") {
      headers.forEach(header => {
        const name = normalize(header);
  
        if (
          name === "cobranca" ||
          name === "excluido"
        ) {
          const currentValue =
            normalizedFormData[header];
  
          if (
            !currentValue ||
            String(currentValue).trim() === ""
          ) {
            normalizedFormData[header] = "NAO";
          }
        }
      });
    }
  
    // Validação obrigatória somente para a aba MV.
    const missingFields = headers.filter(header => {
      if (!isRequiredMvField(header)) {
        return false;
      }
  
      const value = normalizedFormData[header];
  
      return (
        !value ||
        String(value).trim() === ""
      );
    });
  
    if (missingFields.length > 0) {
      alert(
        "Preencha os campos obrigatórios:\n\n" +
        missingFields
          .map(field => `• ${field}`)
          .join("\n")
      );
  
      return;
    }
  
    // Mantém exatamente a ordem das colunas da planilha.
    const rowData = headers.map(
      header => normalizedFormData[header] || ""
    );
  
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
        await onAdd(rowData);
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


  const handleSave = async (dataToSave = formData) => {
    setLoading(true);
    const headers = data[0] || [];
    const rowData = headers.map(h => dataToSave[h] || "");

    try {
      const method = isEdit ? 'PUT' : 'POST';
      const body = isEdit 
        ? { rowData, rowIndex: editingRowIndex, sheet: selectedSheet }
        : { rowData };
      
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setFormData({});
        setShowForm(false);
        setIsEdit(false);
        setEditingRowIndex(null);
        fetchData();
      } else {
        const err = await res.json();
        alert('Erro: ' + (err.details || err.error));
      }
    } catch (e: any) {
      alert('Erro de rede: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const onAdd = async (rowData: string[]) => {
  e.preventDefault();

  const rowData = data[0].map((header) => formData[header] || '');

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
      // Preenchimento automático de Data (formato ISO para input type="date")
      if (hNorm.includes("data") && hNorm.includes("abertura")) {
        newValues[h] = today;
      }
      // Valor padrão para Método de Acionamento
      if (hNorm.includes("metodo") && hNorm.includes("acionamento")) {
        newValues[h] = "Email";
      }
    });
    
    setFormData(newValues);
    setShowForm(true);
  };

  const formatDateBR = (dateString: string) => {
    if (!dateString) return "";
    // Se já estiver no formato BR, retorna
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return dateString;
    
    // Se for formato ISO ou similar, converte
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    // Forçar fuso horário local para evitar problemas de data no fuso UTC
    const [year, month, day] = date.toISOString().split('T')[0].split('-').map(Number);
    // Mas Date constructor com string yyyy-mm-dd às vezes assume UTC.
    // Usando toLocaleDateString é mais seguro se o objeto for válido.
    return date.toLocaleDateString("pt-BR", { timeZone: 'UTC' }).split(',')[0]; 
    // Nota: O ajuste de fuso depende de como o Date foi criado.
    // Se a string era YYYY-MM-DD, o JS costuma assumir meia-noite UTC.
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
    headers.forEach((h, i) => {
      newValues[h] = row[i] || "";
    });
    
    setFormData(newValues);
    setShowForm(true);
  };

  const handleInputChange = (header: string, value: string) => {
    setFormData(prev => ({ ...prev, [header]: value }));
  };

  const isRequiredMvField = (header: string): boolean => {
    if (selectedSheet !== "tbChamadosMV") {
      return false;
    }
  
    const name = normalize(header);
  
    return (
      (
        name.includes("numero") &&
        name.includes("chamado")
      ) ||
      name === "titulo" ||
      (
        name.includes("descricao") &&
        name.includes("problema")
      ) ||
      name === "situacao" ||
      (
        name.includes("data") &&
        name.includes("abertura")
      ) ||
      (
        name.includes("data") &&
        name.includes("ultima") &&
        name.includes("interacao")
      ) ||
      name === "gravidade" ||
      name === "responsavel"
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

  const clearFilters = () => {
    setSheetFilters(prev => ({
      ...prev,
      [selectedSheet]: {}
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
  
  // Heurística para identificar o tipo de dado da coluna
  const getColumnConfig = (header: string, index: number) => {
    const rawValues = data.slice(1).map(row => (row[index] || "").trim()).filter(v => v !== "");
    const uniqueValues = Array.from(new Set(rawValues)).sort();
    
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

  const getTableColumnStyle = (
    header: string
  ): React.CSSProperties => {
    const name = normalize(header);
  
    // Número do chamado
    if (
      name.includes("numero") &&
      name.includes("chamado")
    ) {
      return {
        width: "7%",
        minWidth: 0
      };
    }
  
    // Título
    if (name === "titulo") {
      return {
        width: "12%",
        minWidth: 0
      };
    }
  
    // Descrição
    if (
      name.includes("descricao") &&
      name.includes("problema")
    ) {
      return {
        width: "25%",
        minWidth: 0,
        whiteSpace: "normal",
        wordBreak: "break-word",
        overflowWrap: "anywhere"
      };
    }
  
    // Situação
    if (name === "situacao") {
      return {
        width: "9%",
        minWidth: 0
      };
    }
  
    // OS aberta
    if (
      name.includes("os") &&
      name.includes("aberta")
    ) {
      return {
        width: "7%",
        minWidth: 0
      };
    }
  
    // Datas
    if (name.includes("data")) {
      return {
        width: "9%",
        minWidth: 0
      };
    }
  
    // Gravidade
    if (name === "gravidade") {
      return {
        width: "8%",
        minWidth: 0
      };
    }
  
    // Responsável
    if (name === "responsavel") {
      return {
        width: "10%",
        minWidth: 0
      };
    }
  
    // Ticket de referência
    if (
      name.includes("ticket") &&
      name.includes("referencia")
    ) {
      return {
        width: "9%",
        minWidth: 0
      };
    }
  
    // Método de acionamento — aba ForHealth
    if (
      name.includes("metodo") &&
      name.includes("acionamento")
    ) {
      return {
        width: "10%",
        minWidth: 0
      };
    }
  
    // Demais colunas
    return {
      width: "8%",
      minWidth: 0
    };
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
      return Object.entries(currentFilters).every(([header, filterValue]) => {
        if (!filterValue) return true;
        const colIdx = currentHeaders.indexOf(header);
        if (colIdx === -1) return true;
        
        const cellValue = (row[colIdx] || "")
          .toString()
          .trim()
          .toLowerCase();
        
        const searchVal = String(filterValue)
          .trim()
          .toLowerCase();
        
        // Se possuir múltiplos valores (checkbox)
        if (searchVal.includes("|")) {
        
          const filtros = searchVal
            .split("|")
            .map(v => v.trim())
            .filter(Boolean);
        
          // ===== LOGS TEMPORÁRIOS =====
          if (normalize(header) === "situacao") {
            console.log("================================");
            console.log("Header:", header);
            console.log("Filtro:", filtros);
            console.log("Valor da célula:", `"${cellValue}"`);
            console.log("Resultado:", filtros.includes(cellValue));
          }
          // ============================
        
          return filtros.includes(cellValue);
        
        }
        
        // Filtro normal
        return cellValue.includes(searchVal);
      });
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
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', color: '#F8FAFC' }}>
          Gestor de Chamados
        </h1>
        <p style={{ color: '#94A3B8', marginBottom: '32px' }}>Base de dados via Google Sheets</p>
        
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
            required={required}
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

        {/* Painel de Dashboard */}
        {!loading && data.length > 1 && (
          <div style={{ marginBottom: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* KPI Cards */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
              gap: '20px' 
            }}>
              <div style={{ backgroundColor: '#1E293B', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
                <p style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Total Filtrado</p>
                <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#F8FAFC' }}>{filteredData.length}</h3>
              </div>
              <div style={{ backgroundColor: '#1E293B', padding: '24px', borderRadius: '12px', border: '1px solid #334155', borderLeft: '4px solid #EF4444' }}>
                <p style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Críticos / Urgentes</p>
                <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#EF4444' }}>{stats.criticalCount}</h3>
              </div>
              <div style={{ backgroundColor: '#1E293B', padding: '24px', borderRadius: '12px', border: '1px solid #334155', borderLeft: '4px solid #10B981' }}>
                <p style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Concluídos</p>
                <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#10B981' }}>{stats.completedCount}</h3>
              </div>
              <div style={{ backgroundColor: '#1E293B', padding: '24px', borderRadius: '12px', border: '1px solid #334155' }}>
                <p style={{ fontSize: '12px', color: '#94A3B8', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '8px' }}>Pendentes</p>
                <h3 style={{ fontSize: '32px', fontWeight: 'bold', color: '#3B82F6' }}>{filteredData.length - stats.completedCount}</h3>
              </div>
            </div>

            {/* Gráficos */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', 
              gap: '20px' 
            }}>
              <div style={{ backgroundColor: '#1E293B', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
                <h4 style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px', fontWeight: 'bold' }}>Distribuição por Situação</h4>
                <div style={{ height: '220px', display: 'flex', justifyContent: 'center' }}>
                  <Pie 
                    data={{
                      labels: Object.keys(stats.statusMap),
                      datasets: [{
                        data: Object.values(stats.statusMap),
                        backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#64748B'],
                        borderWidth: 0
                      }]
                    }}
                    options={{ maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#94A3B8', font: { size: 10 } } } } }}
                  />
                </div>
              </div>

              <div style={{ backgroundColor: '#1E293B', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
                <h4 style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px', fontWeight: 'bold' }}>Distribuição por Gravidade</h4>
                <div style={{ height: '220px' }}>
                  <Bar 
                    data={{
                      labels: Object.keys(stats.gravityMap),
                      datasets: [{
                        label: 'Chamados',
                        data: Object.values(stats.gravityMap),
                        backgroundColor: '#3B82F6',
                        borderRadius: 4
                      }]
                    }}
                    options={{ 
                      maintainAspectRatio: false, 
                      scales: { 
                        y: { ticks: { color: '#94A3B8' }, grid: { color: '#334155' } },
                        x: { ticks: { color: '#94A3B8' }, grid: { display: false } }
                      },
                      plugins: { legend: { display: false } }
                    }}
                  />
                </div>
              </div>

              <div style={{ backgroundColor: '#1E293B', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
                <h4 style={{ fontSize: '14px', color: '#94A3B8', marginBottom: '20px', fontWeight: 'bold' }}>Chamados por Responsável</h4>
                <div style={{ height: '220px' }}>
                  <Bar 
                    data={{
                      labels: Object.keys(stats.responsibleMap),
                      datasets: [{
                        label: 'Chamados',
                        data: Object.values(stats.responsibleMap),
                        backgroundColor: '#8B5CF6',
                        borderRadius: 4
                      }]
                    }}
                    options={{ 
                      indexAxis: 'y',
                      maintainAspectRatio: false, 
                      scales: { 
                        y: { ticks: { color: '#94A3B8' }, grid: { display: false } },
                        x: { ticks: { color: '#94A3B8' }, grid: { color: '#334155' } }
                      },
                      plugins: { legend: { display: false } }
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
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
                onClick={() => setShowDeleted(!showDeleted)}
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
          
          {/* Tabela de Dados */}
          {loading && data.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: '#1E293B', borderRadius: '12px', color: '#94A3B8' }}>
              Carregando dados da planilha...
            </div>
          ) : error ? (
            <div style={{ padding: '20px', backgroundColor: '#FEF2F2', border: '1px solid #FEE2E2', borderRadius: '10px', color: '#DC2626' }}>
              <strong>Erro:</strong> {error}
            </div>
          ) : (
            <div className="table-wrapper" style={{ 
              width: '100%', 
              overflow: 'hidden',
              backgroundColor: '#1E293B', 
              borderRadius: '12px', 
              border: '1px solid #334155', 
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              <div className="table-scroll" style={{ 
                width: '100%', 
                overflowX: 'auto', 
                overflowY: 'visible', // Permitir que o sticky header funcione com o scroll da página ou container superior
                scrollbarWidth: 'auto'
              }}>
                <style>{`
                  /* Cabeçalho Fixo */
                  .table-scroll thead th {
                    position: sticky;
                    top: 0;
                    z-index: 10;
                    background-color: #0F172A;
                    border-bottom: 2px solid #334155;
                  }

                  /* Primeira Coluna Fixa */
                  .table-scroll td:first-child,
                  .table-scroll th:first-child {
                    position: sticky;
                    left: 0;
                    z-index: 11;
                    border-right: 2px solid #334155;
                    background-color: inherit;
                  }

                  /* Intersecção (Topo Esquerdo) */
                  .table-scroll th:first-child {
                    z-index: 12;
                  }
                  
                  /* Controle de Largura e Texto */
                  .table-scroll td,
                  .table-scroll th {
                    min-width: 0;
                    max-width: none;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    padding: 10px 8px;
                    border-bottom: 1px solid #334155;
                    vertical-align: middle;
                    box-sizing: border-box;
                  }


                  /* Garantir Visibilidade da Scrollbar */
                  .table-scroll {
                    scrollbar-width: auto;
                    scrollbar-color: #475569 #1E293B;
                  }

                  .table-scroll::-webkit-scrollbar {
                    height: 12px;
                    background: #1E293B;
                    display: block !important;
                  }

                  .table-scroll::-webkit-scrollbar-thumb {
                    background: #475569;
                    border-radius: 6px;
                    border: 3px solid #1E293B;
                  }

                  .table-scroll::-webkit-scrollbar-thumb:hover {
                    background: #64748B;
                  }
                `}</style>
                
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "separate",
                    borderSpacing: 0,
                    fontSize: "clamp(11px, 0.75vw, 13px)",
                    color: "#E2E8F0",
                    tableLayout: "fixed"
                  }}
                >
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A' }}>
                      {data[0]?.map((h, i) => {
                        const name = normalize(h);
                        if (name === "cobranca" || name === "excluido") return null;
                        return (
                          <th
                            key={i}
                            onClick={() => handleSort(i)}
                            title={`Ordenar por ${h}`}
                            style={{
                              textAlign: "left",
                              fontWeight: "bold",
                              color:
                                sortConfig.columnIndex === i
                                  ? "#F8FAFC"
                                  : "#94A3B8",
                              textTransform: "uppercase",
                              fontSize: "11px",
                              letterSpacing: "0.5px",
                              cursor: "pointer",
                              userSelect: "none",
                              transition: "color 0.2s",
                          
                              ...getTableColumnStyle(h)
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px"
                              }}
                            >
                              {h}
                        
                              {sortConfig.columnIndex === i && (
                                <span
                                  style={{
                                    color: "#3B82F6",
                                    fontSize: "12px"
                                  }}
                                >
                                  {sortConfig.direction === "asc" ? "▲" : "▼"}
                                </span>
                              )}
                            </span>
                          </th>
                        );
                      })}
                      <th style={{ 
                        textAlign: 'center', 
                        fontWeight: 'bold', 
                        color: '#94A3B8', 
                        textTransform: 'uppercase', 
                        fontSize: '11px', 
                        letterSpacing: '0.5px',
                        padding: '8px 4px',
                        width: "55px",
                        minWidth: "55px",
                        maxWidth: "55px",
                      }}>
                        Ações
                      </th>
                      <th style={{ 
                        textAlign: 'center', 
                        fontWeight: 'bold', 
                        color: '#94A3B8', 
                        textTransform: 'uppercase', 
                        fontSize: '11px', 
                        letterSpacing: '0.5px',
                        padding: "8px 4px",
                        width: "55px",
                        minWidth: "55px",
                        maxWidth: "55px"
                      }}>
                        Cobrança
                      </th>
                      <th style={{ 
                        textAlign: 'center', 
                        fontWeight: 'bold', 
                        color: '#94A3B8', 
                        textTransform: 'uppercase', 
                        fontSize: '11px', 
                        letterSpacing: '0.5px',
                        padding: "8px 4px",
                        width: "55px",
                        minWidth: "55px",
                        maxWidth: "55px"
                      }}>
                        Excluído
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const totalPages = Math.ceil(sortedData.length / itemsPerPage);
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      
                      const paginatedData = sortedData.slice(
                        startIndex,
                        startIndex + itemsPerPage
                      );

                        return paginatedData.map((row, i) => {
                          const headers = data[0] || [];
                          const situacaoIdx = headers.findIndex(h => normalize(h) === "situacao");
                          const gravidadeIdx = headers.findIndex(h => normalize(h) === "gravidade");
                          const cobrancaIdx = headers.findIndex(h => normalize(h) === "cobranca");
                          const excluidoIdx = headers.findIndex(h => normalize(h) === "excluido");
                          
                          const idIdx = headers.findIndex(h => normalize(h).includes("numero") && normalize(h).includes("chamado"));
                          const fallbackIdx = headers.findIndex(h => normalize(h).includes("os") && normalize(h).includes("aberta"));
                          const finalIdx = idIdx !== -1 ? idIdx : fallbackIdx;
                          
                          const ticketId = finalIdx !== -1 ? String(row[finalIdx] || "") : `row-${startIndex + i}`;
                          const rowIndex = (row as any)._originalIndex;

                          // Regra de status
                          const situacaoValue = (row[situacaoIdx] || "").trim().toLowerCase();
                        const isRowGreen = situacaoValue === "concluído" || situacaoValue === "finalizado";
                        const rowBg = i % 2 === 0 ? '#1E293B' : '#1a2434'; 
                        const activeRowBg = isRowGreen ? '#065F46' : rowBg;

                        return (
                          <tr key={startIndex + i} style={{ 
                            backgroundColor: activeRowBg,
                            transition: 'background 0.2s',
                           }}
                           onMouseOver={(e) => e.currentTarget.style.backgroundColor = isRowGreen ? '#064E3B' : '#334155'}
                           onMouseOut={(e) => e.currentTarget.style.backgroundColor = activeRowBg}
                          >
                            {headers.map((h, j) => {
                              const name = normalize(h);
                              if (name === "cobranca" || name === "excluido") return null;
                              
                              let cell = row[j] || "";
                              const hClean = normalize(h);
                              
                              // Formatação de Data Brasileira se o cabeçalho tiver "Data"
                              if (hClean.includes("data")) {
                                cell = formatDateBR(cell);
                              }
                              
                              if (j === gravidadeIdx) {
                                const gravValue = cell.trim().toLowerCase();
                                const labelStyle: React.CSSProperties = {
                                  fontWeight: "bold",
                                  borderRadius: '4px',
                                  padding: '4px 8px',
                                  display: 'inline-block',
                                  fontSize: '11px',
                                };
                                
                                if (gravValue === "crítico") {
                                  labelStyle.backgroundColor = "#7F1D1D";
                                  labelStyle.color = "#FCA5A5";
                                } else if (gravValue === "urgente") {
                                  labelStyle.backgroundColor = "#78350F";
                                  labelStyle.color = "#FCD34D";
                                } else if (gravValue === "intermediário") {
                                  labelStyle.backgroundColor = "#451a03";
                                  labelStyle.color = "#fbbf24";
                                } else if (gravValue === "baixa") {
                                  labelStyle.backgroundColor = "#064E3B";
                                  labelStyle.color = "#6EE7B7";
                                }

                                return (
                                  <td key={j}>
                                    <span style={labelStyle}>{cell}</span>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={j}
                                  style={{
                                    ...getTableColumnStyle(h)
                                  }}
                                >
                                  {cell}
                                </td>
                              );
                            })}
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              <button 
                                onClick={() => handleEdit(row)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#3B82F6',
                                  cursor: 'pointer',
                                  fontSize: '16px',
                                  padding: '4px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background 0.2s'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#334155'}
                                onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                title="Editar Registro"
                              >
                                ✏️
                              </button>
                             </td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              <input 
                                type="checkbox" 
                                checked={cobrancaIdx !== -1 && (row[cobrancaIdx] || "").trim().toUpperCase() === "SIM"}
                                required={required}
                                onChange={() => {
                                    if (cobrancaIdx === -1) return;
                                    const nextRow = [...row];
                                    nextRow[cobrancaIdx] = (row[cobrancaIdx] || "").trim().toUpperCase() === "SIM" ? "NAO" : "SIM";
                                    handleSaveRow(nextRow, row._originalIndex);
                                }}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer',
                                  accentColor: '#EF4444'
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                              <input 
                                type="checkbox" 
                                checked={excluidoIdx !== -1 && (row[excluidoIdx] || "").trim().toUpperCase() === "SIM"}
                                onChange={() => {
                                    if (excluidoIdx === -1) return;
                                    const nextRow = [...row];
                                    nextRow[excluidoIdx] = (row[excluidoIdx] || "").trim().toUpperCase() === "SIM" ? "NAO" : "SIM";
                                    handleSaveRow(nextRow, row._originalIndex);
                                }}
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  cursor: 'pointer',
                                  accentColor: '#3B82F6'
                                }}
                              />
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

            </div>
          )}

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


        {/* Modal de Cobrança */}
        {showCobrarModal && (
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
              padding: '30px', 
              borderRadius: '16px', 
              width: '100%', 
              maxWidth: '1200px', 
              maxHeight: '90vh', 
              overflowY: 'auto',
              border: '1px solid #334155',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#F8FAFC' }}>
                  Tickets em Cobrança ({currentSheetCount})
                </h2>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#94A3B8' }}>
                    Aba: <strong>{selectedSheet}</strong>
                  </span>
                  <button 
                    onClick={() => setShowCobrarModal(false)}
                    style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '24px' }}
                  >
                    &times;
                </button>
                </div>
              </div>

              {currentSheetCount === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
                  Nenhum ticket da aba <strong>{selectedSheet}</strong> selecionado.
                </div>
              ) : (
                <div style={{ 
                  width: '100%', 
                  overflowX: 'auto',
                  border: '1px solid #334155',
                  borderRadius: '12px'
                }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'separate', 
                    borderSpacing: 0,
                    fontSize: '13px', 
                    color: '#E2E8F0',
                    minWidth: '1000px'
                  }}>
                    <thead>
                      <tr style={{ backgroundColor: '#0F172A' }}>
                        {data[0]?.map((h, i) => (
                          <th key={i} style={{ 
                            padding: '16px',
                            textAlign: 'left', 
                            fontWeight: 'bold', 
                            color: '#94A3B8', 
                            textTransform: 'uppercase', 
                            fontSize: '11px',
                            borderBottom: '1px solid #334155'
                          }}>
                            {h}
                          </th>
                        ))}
                        <th style={{ padding: '16px', borderBottom: '1px solid #334155' }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const currentData = data || [];
                        const headers = currentData[0] || [];
                        const cobrancaIdx = headers.findIndex(h => normalize(h) === "cobranca");
                        const gravidadeIdx = headers.findIndex(h => normalize(h) === "gravidade");
                        
                        // Lista registros marcados físicamente na planilha
                        const cobrancaData = currentData.slice(1).filter(row => {
                           return cobrancaIdx !== -1 && (row[cobrancaIdx] || "").trim().toUpperCase() === "SIM";
                        });

                        return cobrancaData.map((row, i) => {
                          const rowIndex = (row as any)._originalIndex;

                          return (
                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#1E293B' : '#1a2434' }}>
                              {headers.map((_, j) => {
                                const cell = row[j] || "";
                                if (j === gravidadeIdx) {
                                  const gravValue = cell.trim().toLowerCase();
                                  const labelStyle: React.CSSProperties = {
                                    fontWeight: "bold",
                                    borderRadius: '4px',
                                    padding: '4px 8px',
                                    display: 'inline-block',
                                    fontSize: '11px',
                                  };
                                  if (gravValue === "crítico") { labelStyle.backgroundColor = "#7F1D1D"; labelStyle.color = "#FCA5A5"; }
                                  else if (gravValue === "urgente") { labelStyle.backgroundColor = "#78350F"; labelStyle.color = "#FCD34D"; }
                                  else if (gravValue === "intermediário") { labelStyle.backgroundColor = "#451a03"; labelStyle.color = "#fbbf24"; }
                                  else if (gravValue === "baixa") { labelStyle.backgroundColor = "#064E3B"; labelStyle.color = "#6EE7B7"; }

                                  return (
                                    <td
                                      key={j}
                                      style={{
                                        ...getTableColumnStyle(h)
                                      }}
                                    >
                                      <span style={labelStyle}>{cell}</span>
                                    </td>
                                  );
                                }
                                return <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>{cell}</td>;
                              })}
                              <td style={{ padding: '12px 16px', borderBottom: '1px solid #334155', textAlign: 'center' }}>
                                <button 
                                  onClick={() => {
                                      if (cobrancaIdx === -1) return;
                                      const nextRow = [...row];
                                      nextRow[cobrancaIdx] = "";
                                      handleSaveRow(nextRow, row._originalIndex);
                                  }}
                                  style={{
                                    backgroundColor: '#EF4444',
                                    color: 'white',
                                    border: 'none',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          );
                        });
                      })()}
                    </tbody>
                  </table>
                </div>
              )}
              
              <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                {currentSheetCount > 0 && (
                  <button 
                    onClick={exportToExcel}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#10B981',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <span>📊</span> Exportar Excel
                  </button>
                )}
                <button 
                  onClick={() => setShowCobrarModal(false)}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#334155',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Filtros Dinâmicos */}
        {showFilterModal && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            backgroundColor: 'rgba(2, 6, 23, 0.85)', 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            zIndex: 1000,
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{ 
              backgroundColor: '#1E293B', 
              width: '90%', 
              maxWidth: '800px', 
              maxHeight: '85vh',
              borderRadius: '16px', 
              border: '1px solid #334155',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
            }}>
              <div style={{ padding: '24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: '#F8FAFC' }}>Filtros Avançados</h2>
                  <p style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px' }}>Aba: {selectedSheet}</p>
                </div>
                <button 
                  onClick={() => setShowFilterModal(false)}
                  style={{ backgroundColor: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: '24px' }}>×</button>
              </div>

              <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                    gap: "20px",
                    alignItems: "start"
                  }}
                >
                  {headers.map((h, i) => {
                    const config = getColumnConfig(h, i);
                    const currentVal = sheetFilters[selectedSheet]?.[h] || "";
                    const normalizedHeader = normalize(h);

                    // Define somente a ordem visual dos filtros.
                    // Não altera o índice ou a estrutura da planilha.
                    let filterOrder = 999;
                    
                    if (selectedSheet === "tbChamadosForhealth") {
                    
                      // Primeira linha
                      if (normalizedHeader === "titulo") {
                        filterOrder = 10;
                    
                      } else if (
                        normalizedHeader.includes("descricao") &&
                        normalizedHeader.includes("problema")
                      ) {
                        filterOrder = 20;
                    
                      } else if (
                        normalizedHeader.includes("os") &&
                        normalizedHeader.includes("aberta")
                      ) {
                        filterOrder = 30;
                    
                      // Segunda linha
                      } else if (normalizedHeader === "cobranca") {
                        filterOrder = 40;
                    
                      } else if (
                        normalizedHeader.includes("data") &&
                        normalizedHeader.includes("ultima") &&
                        normalizedHeader.includes("interacao")
                      ) {
                        filterOrder = 50;
                    
                      } else if (
                        normalizedHeader.includes("data") &&
                        normalizedHeader.includes("abertura")
                      ) {
                        filterOrder = 60;
                    
                      // Terceira linha: filtros menores
                      } else if (normalizedHeader === "excluido") {
                        filterOrder = 70;
                    
                      } else if (
                        normalizedHeader.includes("metodo") &&
                        normalizedHeader.includes("acionamento")
                      ) {
                        filterOrder = 80;
                    
                      // Coluna sem título, caso realmente exista na planilha
                      } else if (normalizedHeader === "") {
                        filterOrder = 90;
                    
                      // Última linha: listas maiores
                      } else if (normalizedHeader === "situacao") {
                        filterOrder = 100;
                    
                      } else if (normalizedHeader === "gravidade") {
                        filterOrder = 110;
                    
                      } else if (normalizedHeader === "responsavel") {
                        filterOrder = 120;
                      }
                    
                    } else {
                    
                      // Ordenação da aba tbChamadosMV, que já está funcionando
                      if (
                        normalizedHeader.includes("numero") &&
                        normalizedHeader.includes("chamado")
                      ) {
                        filterOrder = 10;
                    
                      } else if (normalizedHeader === "titulo") {
                        filterOrder = 20;
                    
                      } else if (
                        normalizedHeader.includes("descricao") &&
                        normalizedHeader.includes("problema")
                      ) {
                        filterOrder = 30;
                    
                      } else if (
                        normalizedHeader.includes("os") &&
                        normalizedHeader.includes("aberta")
                      ) {
                        filterOrder = 40;
                    
                      } else if (
                        normalizedHeader.includes("ticket") &&
                        normalizedHeader.includes("referencia")
                      ) {
                        filterOrder = 50;
                    
                      } else if (normalizedHeader === "cobranca") {
                        filterOrder = 60;
                    
                      } else if (
                        normalizedHeader.includes("data") &&
                        normalizedHeader.includes("ultima") &&
                        normalizedHeader.includes("interacao")
                      ) {
                        filterOrder = 70;
                    
                      } else if (
                        normalizedHeader.includes("data") &&
                        normalizedHeader.includes("abertura")
                      ) {
                        filterOrder = 80;
                    
                      } else if (normalizedHeader === "excluido") {
                        filterOrder = 90;
                    
                      } else if (normalizedHeader === "situacao") {
                        filterOrder = 100;
                    
                      } else if (normalizedHeader === "gravidade") {
                        filterOrder = 110;
                    
                      } else if (normalizedHeader === "responsavel") {
                        filterOrder = 120;
                      }
                    }
                    
                    const isDataAbertura =
                      normalizedHeader.includes("data") &&
                      normalizedHeader.includes("abertura");
                    
                    const isDataUltimaInteracao =
                      normalizedHeader.includes("data") &&
                      normalizedHeader.includes("ultima") &&
                      normalizedHeader.includes("interacao");
                    
                    const isDateRangeField =
                      isDataAbertura || isDataUltimaInteracao;
                    
                    const dataInicioKey = `${h}__inicio`;
                    const dataFimKey = `${h}__fim`;
                    
                    const dataInicio =
                      sheetFilters[selectedSheet]?.[dataInicioKey] || "";
                    
                    const dataFim =
                      sheetFilters[selectedSheet]?.[dataFimKey] || "";
                    const multiSelectFields = [
                        "situacao",
                        "gravidade",
                        "responsavel"
                    ];
                    const isMultiSelect =
                    multiSelectFields.includes(
                        normalize(h)
                    );
            
                    return (
                      <div
                        key={h}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          order: filterOrder,
                          minWidth: 0,
                    
                          // Na aba ForHealth, Situação inicia uma nova linha.
                          gridColumnStart:
                            selectedSheet === "tbChamadosForhealth" &&
                            normalizedHeader === "situacao"
                              ? 1
                              : "auto"
                        }}
                      >
                        <label style={{ fontSize: '12px', lineHeight:"18px", fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase' }}>{h}</label>
                        
                        {isMultiSelect ? (

                        <div
                            style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "6px",
                                height: "180px",
                                minHeight: "180px",
                                maxHeight: "180px",
                                overflowY: "auto",
                                padding: "10px",
                                paddingRight: "6px",
                                backgroundColor: "#0F172A",
                                border: "1px solid #334155",
                                borderRadius: "8px",
                                boxSizing: "border-box"
                            }}
                        >
                        
                        {(() => {

                        const sortedOptions =
                            [...(config.options || [])]
                                .sort((a, b) =>
                                    a.localeCompare(
                                        b,
                                        "pt-BR",
                                        {
                                            sensitivity: "base"
                                        }
                                    )
                                );
                        
                        const selectedValues = currentVal
                            ? currentVal.split("|")
                            : [];
                        
                        const allSelected =
                            sortedOptions.length > 0 &&
                            sortedOptions.every(op => selectedValues.includes(op));
                        
                        return (
                        <>
                        
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                cursor: "pointer",
                                fontWeight: 600,
                                color: "#F8FAFC",
                                paddingBottom: "4px",
                                marginBottom: "4px",
                                borderBottom: "1px solid #334155"
                            }}
                        >
                        
                        <input
                            type="checkbox"                        
                            checked={allSelected}
                            required={required}
                            onChange={(e)=>{
                        
                                if(e.target.checked){
                        
                                    updateFilter(
                                        h,
                                        sortedOptions.join("|")
                                    );
                        
                                }else{
                        
                                    updateFilter(
                                        h,
                                        ""
                                    );
                        
                                }
                        
                            }}
                        />
                        
                        <span>Todos</span>
                        
                        </label>
                        
                        
                        {sortedOptions.map(opcao => {
                        
                            const selecionado =
                                selectedValues.includes(opcao);
                        
                            return(
                        
                        <label
                            key={opcao}
                            style={{
                                display:"flex",
                                alignItems:"center",
                                gap:"8px",
                                cursor:"pointer"
                            }}
                        >
                        
                        <input
                        
                        type="checkbox"
                        
                        checked={selecionado}
                        
                        onChange={(e)=>{
                        
                            let valores = [...selectedValues];
                        
                            if(e.target.checked){
                        
                                if(!valores.includes(opcao))
                                    valores.push(opcao);
                        
                            }else{
                        
                                valores =
                                    valores.filter(
                                        x=>x!==opcao
                                    );
                        
                            }

                            console.log("currentVal:", currentVal);
                            console.log("valores:", valores);
                            console.log("gravando:", valores.join("|"));
                          
                            updateFilter(
                                h,
                                valores.join("|")
                            );
                        
                        }}
                        
                         />
                        
                        <span>{opcao}</span>
                        
                        </label>
                        
                            )
                        
                        })}

                        </>
                        
                        );
                        
                        })()}
                        
                        
                        </div>
                        
                        ) : isDateRangeField ? (

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              padding: "10px",
                              backgroundColor: "#0F172A",
                              border: "1px solid #334155",
                              borderRadius: "8px",
                              boxSizing: "border-box"
                            }}
                          >
                            <label
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "5px",
                                fontSize: "11px",
                                color: "#94A3B8"
                              }}
                            >
                              De
                        
                              <input
                                type="date"
                                value={dataInicio}
                                max={dataFim || undefined}
                                required={required}
                                onChange={(e) =>
                                  updateFilter(dataInicioKey, e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  padding: "9px",
                                  backgroundColor: "#1E293B",
                                  color: "#F8FAFC",
                                  border: "1px solid #334155",
                                  borderRadius: "6px",
                                  outline: "none",
                                  boxSizing: "border-box"
                                }}
                              />
                            </label>
                        
                            <label
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "5px",
                                fontSize: "11px",
                                color: "#94A3B8"
                              }}
                            >
                              Até
                        
                              <input
                                type="date"
                                value={dataFim}
                                min={dataInicio || undefined}
                                required={required}
                                onChange={(e) =>
                                  updateFilter(dataFimKey, e.target.value)
                                }
                                style={{
                                  width: "100%",
                                  padding: "9px",
                                  backgroundColor: "#1E293B",
                                  color: "#F8FAFC",
                                  border: "1px solid #334155",
                                  borderRadius: "6px",
                                  outline: "none",
                                  boxSizing: "border-box"
                                }}
                              />
                            </label>
                          </div>
                        
                        ) : config.type === "select" ? (

                        <select
                            value={currentVal}
                            onChange={(e) => updateFilter(h, e.target.value)}
                            required={required}
                            style={{
                                padding: '10px',
                                backgroundColor: '#0F172A',
                                color: '#F8FAFC',
                                border: '1px solid #334155',
                                borderRadius: '8px',
                                outline: 'none'
                            }}
                        >
                            <option value="">Todos</option>
                        
                            {config.options?.map(opt => (
                                <option key={opt} value={opt}>
                                    {opt}
                                </option>
                            ))}
                        
                        </select>
                        
                        ) : ( 
                          <input 
                            type={config.type}
                            value={currentVal}
                            onChange={(e) => updateFilter(h, e.target.value)}
                            required={required}
                            placeholder={`Buscar em ${h}...`}
                            style={{
                              padding: '10px',
                              backgroundColor: '#0F172A',
                              color: '#F8FAFC',
                              border: '1px solid #334155',
                              borderRadius: '8px',
                              outline: 'none'
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ padding: '24px', borderTop: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button 
                  onClick={clearFilters}
                  style={{
                    padding: '10px 16px',
                    backgroundColor: 'transparent',
                    color: '#EF4444',
                    border: '1px solid #EF4444',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Limpar Todos
                </button>
                <button 
                  onClick={() => setShowFilterModal(false)}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: '#3B82F6',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Visualizar Resultados
                </button>
              </div>
            </div>
          </div>
        )}

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
                    const required = isRequiredMvField(header);
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

                          {required && (
                            <span
                              style={{
                                color: "#EF4444",
                                marginLeft: "4px"
                              }}
                            >
                              *
                            </span>
                          )}
                        </label>
                        
                        {hClean.includes("situação") || hClean.includes("situacao") ? (
                          <select 
                            style={inputStyle}
                            value={formData[header] || ''}
                            onChange={(e) => handleInputChange(header, e.target.value)}
                            required={required}
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
                              required={required}
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
                            required={required}
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
                            required={required}
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
                            required={required}
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

                <div style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  paddingTop: '24px', 
                  borderTop: '1px solid #334155',
                  alignItems: 'center',
                  justifyContent: 'flex-end'
                }}>
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
                      transition: 'all 0.2s',
                      flex: isEdit ? '0 1 auto' : '1'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#334155'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit" 
                    style={{ 
                      flex: isEdit ? '0 1 auto' : '2',
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
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563EB'}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3B82F6'}
                  >
                    {isEdit ? 'Salvar Alterações' : 'Criar Chamado'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
