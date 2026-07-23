import React from "react";

type ColumnConfig =
  | {
      type: "select";
      options: string[];
    }
  | {
      type: "date" | "number" | "text";
      options?: never;
    };

type FiltroModalProps = {
  isOpen: boolean;
  headers: string[];
  selectedSheet: string;
  sheetFilters: Record<string, Record<string, string>>;
  normalize: (value: string) => string;
  getColumnConfig: (header: string, index: number) => ColumnConfig;
  updateFilter: (header: string, value: string) => void;
  clearFilters: () => void;
  onClose: () => void;
};

export default function FiltroModal({
  isOpen,
  headers,
  selectedSheet,
  sheetFilters,
  normalize,
  getColumnConfig,
  updateFilter,
  clearFilters,
  onClose
}: FiltroModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
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
            onClick={() => onClose()}
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
                    config.type === "select"
                      ? [...config.options].sort((a, b) =>
                          a.localeCompare(b, "pt-BR", {
                            sensitivity: "base"
                          })
                        )
                      : [];
                  
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
            onClick={() => onClose()}
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
  );
}