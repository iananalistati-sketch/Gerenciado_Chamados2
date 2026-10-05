import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ACCESSORY_OPTIONS, type ExternalMaintenanceTermData } from "./externalMaintenanceData";

interface ExternalMaintenanceTermModalProps {
  isOpen: boolean;
  type: "receipt" | "return";
  data: ExternalMaintenanceTermData | null;
  onClose: () => void;
}

const formatDate = (value: string) => {
  if (!value) return "____/____/________";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const longDate = (value: string) => {
  if (!value) return "____ de __________________ de ________";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
};

const display = (value: string) => value || "—";

export default function ExternalMaintenanceTermModal({
  isOpen,
  type,
  data,
  onClose,
}: ExternalMaintenanceTermModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onAfterPrint = () => document.body.classList.remove("printing-mobile-term");
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("afterprint", onAfterPrint);
      document.body.classList.remove("printing-mobile-term");
    };
  }, [isOpen]);

  if (!isOpen || !data) return null;

  const handlePrint = () => {
    document.body.classList.add("printing-mobile-term");
    window.print();
  };

  const accessoryItems = data.accessories.split("|").map((item) => item.trim()).filter(Boolean);
  const otherAccessories = accessoryItems
    .filter((item) => item.toUpperCase().startsWith("OUTROS:"))
    .map((item) => item.slice(7).trim())
    .join(", ");
  const hasAccessory = (key: string) => accessoryItems.some((item) => item.toUpperCase() === key);
  const title = type === "receipt" ? "Termo de recebimento para manutenção externa" : "Termo de devolução pós-manutenção externa";

  return createPortal(
    <div className="mobile-term-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="mobile-term-shell">
        <div className="mobile-term-toolbar no-print">
          <div>
            <strong>{title}</strong>
            <span>Manutenção {data.maintenanceId || "sem identificação"}</span>
          </div>
          <div>
            <button type="button" className="mobile-term-close" onClick={onClose}>Fechar</button>
            <button type="button" className="mobile-term-print" onClick={handlePrint}>Imprimir / Salvar PDF</button>
          </div>
        </div>

        <article className="mobile-term-document mobile-term-document-loan mobile-term-document-external">
          <header className="mobile-term-document-header">
            <img src="https://cssjd-ti.s3.us-east-2.amazonaws.com/LOGO.png" alt="Complexo de Saúde São João de Deus" />
            <div>
              <strong>FUNDAÇÃO GERALDO CORRÊA</strong><br />
              Complexo de Saúde São João de Deus<br />
              CNPJ 20.146.064/0001-02
            </div>
          </header>

          {type === "receipt" ? (
            <>
              <h1>Termo de Recebimento de Equipamento para Manutenção Externa</h1>
              <p>
                A Gerência de Tecnologia da Informação da <strong>FUNDAÇÃO GERALDO CORRÊA – COMPLEXO DE SAÚDE SÃO JOÃO DE DEUS</strong> declara ter recebido de <strong>{display(data.deliveryName)}</strong>, matrícula <strong>{display(data.deliveryRegistration)}</strong>, cargo <strong>{display(data.deliveryRole)}</strong>, do setor <strong>{display(data.originSector)}</strong>, o equipamento de TI abaixo descrito, para encaminhamento à assistência técnica externa, conforme as condições deste Termo.
              </p>

              <h2>Equipamento recebido</h2>
              <table>
                <tbody>
                  <tr><td><b>Equipamento:</b> {display(data.collector)}</td><td><b>Número de série:</b> {display(data.serial)}</td></tr>
                  <tr><td><b>Marca:</b> {display(data.brand)}</td><td><b>Modelo:</b> {display(data.model)}</td></tr>
                  <tr><td><b>Setor:</b> {display(data.originSector)}</td><td><b>Ordem de Serviço:</b> {display(data.serviceOrder)}</td></tr>
                  <tr><td><b>Data do recebimento:</b> {formatDate(data.sendDate)}</td><td><b>Protocolo:</b> {display(data.maintenanceId)}</td></tr>
                </tbody>
              </table>

              <h2>Defeito relatado</h2>
              <p>{display(data.reportedDefect)}</p>

              <h2>Acessórios entregues junto ao equipamento</h2>
              <div className="mobile-term-checks">
                {ACCESSORY_OPTIONS.map((option) => (
                  <div key={option.key}>{hasAccessory(option.key) ? "☒" : "☐"} {option.label}</div>
                ))}
                <div>{otherAccessories ? "☒" : "☐"} Outros: {otherAccessories || "________________"}</div>
              </div>
              {data.sendObservation && <p><b>Observação:</b> {data.sendObservation}</p>}

              <h2>Condições</h2>
              <ol>
                <li>O equipamento será encaminhado para avaliação e reparo por assistência técnica externa. O prazo de retorno depende do diagnóstico e do atendimento do fornecedor.</li>
                <li>No momento do recebimento não havia equipamento reserva disponível para empréstimo; por isso, o setor permanecerá sem o equipamento até o seu retorno.</li>
                <li>Somente os acessórios assinalados acima foram entregues à Gerência de Tecnologia da Informação. Itens não listados não são de responsabilidade da TI.</li>
                <li>Caso o laudo técnico identifique avaria decorrente de mau uso, dano físico ou ausência de peça/acessório, a ocorrência poderá ser apurada e os custos direcionados ao setor responsável, conforme as normas e autorizações internas da instituição.</li>
                <li>O retorno do equipamento ao setor será formalizado por meio do Termo de Devolução pós-manutenção externa.</li>
              </ol>

              <p className="mobile-term-date">Divinópolis, {longDate(data.sendDate)}.</p>
              <div className="mobile-term-signatures">
                <div><span /><small>{display(data.deliveryName)}<br />Colaborador responsável pela entrega</small></div>
                <div><span /><small>{display(data.receiptResponsible)}<br />Técnico responsável pelo recebimento</small></div>
              </div>
            </>
          ) : (
            <>
              <h1>Termo de Devolução de Equipamento — Retorno de Manutenção Externa</h1>
              <p>
                Atesto que o equipamento <strong>{display(data.collector)}</strong>, marca <strong>{display(data.brand)}</strong>, modelo <strong>{display(data.model)}</strong>, número de série <strong>{display(data.serial)}</strong>, encaminhado para manutenção externa em <strong>{formatDate(data.sendDate)}</strong> (protocolo <strong>{display(data.maintenanceId)}</strong>), retornou do reparo e foi entregue ao setor <strong>{display(data.returnSector)}</strong> em <strong>{formatDate(data.returnDate)}</strong>.
              </p>

              <table>
                <tbody>
                  <tr><td><b>Colaborador que recebeu:</b> {display(data.receiverName)}</td><td><b>Matrícula:</b> {display(data.receiverRegistration)}</td></tr>
                  <tr><td><b>Cargo:</b> {display(data.receiverRole)}</td><td><b>Setor:</b> {display(data.returnSector)}</td></tr>
                  <tr><td><b>Ordem de Serviço:</b> {display(data.serviceOrder)}</td><td><b>Entregue ao TI por:</b> {display(data.deliveryName)}</td></tr>
                </tbody>
              </table>

              <h2>Defeito relatado no envio</h2>
              <p>{display(data.reportedDefect)}</p>
              <h2>Serviço realizado</h2>
              <p>{display(data.serviceDone)}</p>
              {data.returnObservation && <p><b>Observação:</b> {data.returnObservation}</p>}

              <p>Declaro que recebi o equipamento acima em condições de funcionamento, juntamente com os acessórios entregues no envio para manutenção.</p>

              <p className="mobile-term-date">Divinópolis, {longDate(data.returnDate)}.</p>
              <div className="mobile-term-signatures">
                <div><span /><small>{display(data.receiverName)}<br />Colaborador responsável pelo recebimento</small></div>
                <div><span /><small>{display(data.returnResponsible)}<br />Técnico responsável pela entrega</small></div>
              </div>
            </>
          )}

          <footer>Fundação Geraldo Corrêa – Complexo de Saúde São João de Deus | Rua do Cobre, nº 800, Bairro Niterói, Divinópolis/MG | CEP 35.500-227</footer>
        </article>
      </div>
    </div>,
    document.body
  );
}
