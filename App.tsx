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
  const itemsPerPage = 10;
  const [showForm, setShowForm] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
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
    const url = isEdit ? '/api/data' : `/api/data?sheet=${selectedSheet}`;
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
      
      const url = isEdit ? '/api/data' : `/api/data?sheet=${selectedSheet}`;

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

  const onAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleSave();
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

  const updateFilter = (header: string, value: string) => {
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
        
        const cellValue = (row[colIdx] || "").toString().toLowerCase();
        const searchVal = String(filterValue).toLowerCase();
        
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
  
  const activeFilterCount = Object.values(sheetFilters[selectedSheet] || {}).filter(v => v !== "").length;

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
      const colIdx = headers.indexOf(header);
      if (colIdx === -1) return true;
      
      const cellValue = (row[colIdx] || "").toString().toLowerCase();
      const searchVal = String(filterValue).toLowerCase();
      
      return cellValue.includes(searchVal);
    });
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
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', color: '#F8FAFC' }}>
          Dashboard de Chamados
        </h1>
        <p style={{ color: '#94A3B8', marginBottom: '32px' }}>Gerenciamento inteligente via Google Sheets</p>
        
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
            <option value="tbChamadosMV">tbChamadosMV</option>
            <option value="tbChamadosForhealth">tbChamadosForhealth</option>
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
                    max-width: 250px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    padding: 12px 16px;
                    border-bottom: 1px solid #334155;
                  }

                  /* Coluna de Descrição (3ª coluna) - Permitir quebra */
                  .table-scroll td:nth-child(3) {
                    white-space: normal;
                    word-break: break-word;
                    min-width: 300px;
                    max-width: 400px;
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
                
                <table style={{ 
                  width: '100%', 
                  borderCollapse: 'separate', 
                  borderSpacing: 0,
                  fontSize: '13px', 
                  color: '#E2E8F0',
                  minWidth: '1400px'
                }}>
                  <thead>
                    <tr style={{ backgroundColor: '#0F172A' }}>
                      {data[0]?.map((h, i) => {
                        const name = normalize(h);
                        if (name === "cobranca" || name === "excluido") return null;
                        return (
                          <th key={i} style={{ 
                            textAlign: 'left', 
                            fontWeight: 'bold', 
                            color: '#94A3B8', 
                            textTransform: 'uppercase', 
                            fontSize: '11px', 
                            letterSpacing: '0.5px'
                          }}>
                            {h}
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
                        padding: '16px'
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
                        padding: '16px'
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
                        padding: '16px'
                      }}>
                        Excluído
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const totalPages = Math.ceil(filteredData.length / itemsPerPage);
                      const startIndex = (currentPage - 1) * itemsPerPage;
                      const paginatedData = filteredData.slice(startIndex, startIndex + itemsPerPage);

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
                                <td key={j}>
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

                                  return <td key={j} style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}><span style={labelStyle}>{cell}</span></td>;
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
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', 
                  gap: '20px' 
                }}>
                  {headers.map((h, i) => {
                    const config = getColumnConfig(h, i);
                    const currentVal = sheetFilters[selectedSheet]?.[h] || "";

                    return (
                      <div key={h} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748B', textTransform: 'uppercase' }}>{h}</label>
                        
                        {config.type === 'select' ? (
                          <select 
                            value={currentVal}
                            onChange={(e) => updateFilter(h, e.target.value)}
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
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : (
                          <input 
                            type={config.type}
                            value={currentVal}
                            onChange={(e) => updateFilter(h, e.target.value)}
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
              
              <form onSubmit={onAdd} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
                            <option value="Em andamento" style={{ backgroundColor: '#0F172A' }}>Em andamento</option>
                            <option value="Finalizado" style={{ backgroundColor: '#0F172A' }}>Finalizado</option>
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
                            onBlur={(e) => e.target.style.borderColor = '#334155'}
                            value={formData[header] || ''}
                            onChange={(e) => handleInputChange(header, e.target.value)}
                          />
                        ) : (
                          <input 
                            style={inputStyle}
                            onFocus={(e) => e.target.style.borderColor = '#3B82F6'}
                            onBlur={(e) => e.target.style.borderColor = '#334155'}
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

