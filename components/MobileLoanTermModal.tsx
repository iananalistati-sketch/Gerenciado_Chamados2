import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { MobileLoanTermData } from "./mobileLoanTermData";

interface MobileLoanTermModalProps {
  isOpen: boolean;
  type: "loan" | "return";
  data: MobileLoanTermData | null;
  onClose: () => void;
}

const formatDate = (value: string) => {
  if (!value) return "____/____/________";
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
};

const longDate = (value: string) => {
  if (!value) return "____ de __________________ de ________";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const display = (value: string) => value || "—";

export default function MobileLoanTermModal({
  isOpen,
  type,
  data,
  onClose,
}: MobileLoanTermModalProps) {
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

  const condition = data.returnCondition.toUpperCase();
  const isChecked = (key: string) => condition.split("|").map((item) => item.trim()).includes(key);

  return createPortal(
    <div className="mobile-term-overlay" role="dialog" aria-modal="true" aria-label={type === "loan" ? "Termo de empréstimo" : "Termo de devolução"}>
      <div className="mobile-term-shell">
        <div className="mobile-term-toolbar no-print">
          <div>
            <strong>{type === "loan" ? "Termo de empréstimo" : "Termo de devolução"}</strong>
            <span>Empréstimo {data.loanId || "sem identificação"}</span>
          </div>
          <div>
            <button type="button" className="mobile-term-close" onClick={onClose}>Fechar</button>
            <button type="button" className="mobile-term-print" onClick={handlePrint}>Imprimir / Salvar PDF</button>
          </div>
        </div>

        <article className="mobile-term-document">
          <header className="mobile-term-document-header">
            <img src="https://cssjd-ti.s3.us-east-2.amazonaws.com/LOGO.png" alt="Complexo de Saúde São João de Deus" />
            <div>
              <strong>FUNDAÇÃO GERALDO CORRÊA</strong><br />
              Complexo de Saúde São João de Deus<br />
              CNPJ 20.146.064/0001-02
            </div>
          </header>

          {type === "loan" ? (
            <>
              <h1>Termo de Responsabilidade Sob Concessão de Equipamentos de TI</h1>
              <p>
                Eu, <strong>{display(data.loanCollaboratorName)}</strong>, matriculado(a) nesta instituição sob o número <strong>{display(data.loanCollaboratorRegistration)}</strong>, no cargo de <strong>{display(data.loanCollaboratorRole)}</strong>, do setor <strong>{display(data.destinationSector)}</strong>, recebi da <strong>FUNDAÇÃO GERALDO CORRÊA – COMPLEXO DE SAÚDE SÃO JOÃO DE DEUS</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 20.146.064/0001-02, estabelecida à Rua do Cobre, nº 800, Bairro Niterói, CEP 35.500-227, Divinópolis/MG, o(s) equipamento(s) de TI abaixo descrito(s), em regime de empréstimo, nas condições estabelecidas neste Termo.
              </p>

              <h2>Equipamentos</h2>
              <table>
                <thead><tr><th>Equipamento retirado temporariamente</th><th>Equipamento alocado temporariamente</th></tr></thead>
                <tbody>
                  <tr><td><b>Equipamento:</b> {display(data.originalCollector)}</td><td><b>Equipamento:</b> {display(data.reserveCollector)}</td></tr>
                  <tr><td><b>Marca:</b> {display(data.originalBrand)}</td><td><b>Marca:</b> {display(data.reserveBrand)}</td></tr>
                  <tr><td><b>Modelo:</b> {display(data.originalModel)}</td><td><b>Modelo:</b> {display(data.reserveModel)}</td></tr>
                  <tr><td><b>Número de série:</b> {display(data.originalSerial)}</td><td><b>Número de série:</b> {display(data.reserveSerial)}</td></tr>
                </tbody>
              </table>
              <table>
                <tbody>
                  <tr><td><b>Ordem de Serviço:</b> {display(data.serviceOrder)}</td><td><b>Data da retirada:</b> {formatDate(data.loanDate)}</td></tr>
                  <tr><td colSpan={2}><b>Motivo/observação:</b> {display([data.reason, data.observation].filter(Boolean).join(" — "))}</td></tr>
                </tbody>
              </table>

              <h2>Condições e Responsabilidades</h2>
              <p>Por meio deste instrumento, declaro ter recebido, em regime de empréstimo para uso profissional, o(s) equipamento(s) descrito(s) neste documento, comprometendo-me a utilizá-lo(s) exclusivamente para o desempenho de minhas atividades laborais, observando as normas e políticas internas da instituição. Declaro estar ciente de que:</p>
              <ol>
                <li>Comprometo-me a zelar pela guarda, conservação e utilização adequada do(s) equipamento(s), responsabilizando-me por comunicar imediatamente qualquer ocorrência de dano, perda, furto, roubo ou mau funcionamento à Gerência de Tecnologia da Informação.</li>
                <li>O desgaste natural decorrente do uso regular não será considerado dano de responsabilidade do colaborador.</li>
                <li>Na hipótese de dano, perda, furto ou extravio decorrente de dolo ou culpa comprovada do colaborador, a empresa poderá adotar as medidas cabíveis para apuração dos fatos e eventual responsabilização, observada a legislação trabalhista vigente, as disposições contratuais aplicáveis e o devido processo interno.</li>
                <li>Quando o equipamento for destinado ao uso exclusivo de um colaborador, este será responsável por sua guarda, conservação e utilização adequada durante o período em que permanecer sob sua posse, observadas as disposições deste Termo e as normas internas da instituição. Quando o equipamento for destinado ao uso compartilhado ou disponibilizado para determinado setor, a responsabilidade por sua utilização e conservação será compartilhada entre os usuários autorizados, cabendo ao gestor da área comunicar à Gerência de Tecnologia da Informação qualquer ocorrência de dano, perda, extravio ou uso inadequado de que tenha conhecimento.</li>
                <li>O colaborador compromete-se a cumprir as políticas de Segurança da Informação, confidencialidade e proteção de dados da instituição, mantendo sob sigilo as credenciais de acesso e protegendo as informações corporativas armazenadas ou acessadas por meio do(s) equipamento(s).</li>
                <li>A empresa poderá realizar auditorias, verificações técnicas, inventários patrimoniais e procedimentos de suporte relacionados ao(s) equipamento(s), respeitando a legislação vigente, a privacidade do colaborador e as políticas internas da instituição.</li>
              </ol>
              <p>Declaro que recebi o(s) equipamento(s) em condições adequadas de funcionamento e estou ciente das responsabilidades estabelecidas neste Termo.</p>
              <p className="mobile-term-date">Divinópolis, {longDate(data.loanDate)}.</p>
              <div className="mobile-term-signatures">
                <div><span /><small>{display(data.loanCollaboratorName)}<br />Colaborador responsável pelo recebimento</small></div>
                <div><span /><small>{display(data.loanResponsible)}<br />Técnico responsável pela entrega</small></div>
              </div>
            </>
          ) : (
            <>
              <h1>Termo de Devolução de Equipamento de TI</h1>
              <p>
                Atesto que o equipamento reserva <strong>{display(data.reserveCollector)}</strong>, marca <strong>{display(data.reserveBrand)}</strong>, modelo <strong>{display(data.reserveModel)}</strong>, número de série <strong>{display(data.reserveSerial)}</strong>, vinculado ao empréstimo <strong>{display(data.loanId)}</strong>, foi devolvido em <strong>{formatDate(data.returnDate)}</strong>.
              </p>
              <table>
                <tbody>
                  <tr><td><b>Colaborador que recebeu:</b> {display(data.loanCollaboratorName)}</td><td><b>Matrícula:</b> {display(data.loanCollaboratorRegistration)}</td></tr>
                  <tr><td><b>Colaborador que devolveu:</b> {display(data.returnCollaboratorName)}</td><td><b>Matrícula:</b> {display(data.returnCollaboratorRegistration)}</td></tr>
                  <tr><td><b>Cargo:</b> {display(data.returnCollaboratorRole)}</td><td><b>Setor:</b> {display(data.destinationSector)}</td></tr>
                </tbody>
              </table>

              <h2>Condições de Devolução</h2>
              <div className="mobile-term-checks">
                <div>{isChecked("PERFEITO_ESTADO") ? "☒" : "☐"} Em perfeito estado</div>
                <div>{isChecked("APRESENTANDO_DEFEITO") ? "☒" : "☐"} Apresentando defeito</div>
                <div>{isChecked("FALTANDO_PECAS_ACESSORIOS") ? "☒" : "☐"} Faltando peças/acessórios</div>
              </div>
              <p><b>Detalhamento:</b> {display(data.returnDetails)}</p>
              {data.returnObservation && <p><b>Observação:</b> {data.returnObservation}</p>}
              <p className="mobile-term-date">Divinópolis, {longDate(data.returnDate)}.</p>
              <div className="mobile-term-signatures">
                <div><span /><small>{display(data.returnCollaboratorName)}<br />Colaborador responsável pela devolução</small></div>
                <div><span /><small>{display(data.returnResponsible)}<br />Técnico responsável pelo recebimento</small></div>
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
