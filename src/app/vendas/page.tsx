"use client";

import { useState } from "react";
import styles from "./page.module.css";

// Simulando o que você tem no inventário no momento
const inventarioMock = [
  { id: 1, nome: "Wolf Tail", quantidadeDisponivel: 1090, valorNpc: 300 },
  { id: 2, nome: "Golden Nugget", quantidadeDisponivel: 5, valorNpc: 150000 },
  { id: 3, nome: "Essence of Fire", quantidadeDisponivel: 3450, valorNpc: 120 },
];

export default function RegistrarVenda() {
  const [itemSelecionado, setItemSelecionado] = useState("");
  const [quantidadeVenda, setQuantidadeVenda] = useState("");
  const [tipoVenda, setTipoVenda] = useState<"npc" | "player">("npc");
  const [valorPlayerUnidade, setValorPlayerUnidade] = useState("");

  // Busca os dados do item selecionado
  const itemData = inventarioMock.find((i) => i.id.toString() === itemSelecionado);
  const qtd = Number(quantidadeVenda) || 0;

  // LÓGICA FINANCEIRA
  let valorBruto = 0;
  let taxaMarket = 0;
  let valorLiquido = 0;

  if (itemData) {
    if (tipoVenda === "npc") {
      // NPC não tem taxa
      valorBruto = qtd * itemData.valorNpc;
      valorLiquido = valorBruto;
    } else if (tipoVenda === "player") {
      // Venda para player tem 10% de taxa sobre o valor total da venda
      const precoUnitario = Number(valorPlayerUnidade) || 0;
      valorBruto = qtd * precoUnitario;
      taxaMarket = valorBruto * 0.10; // Calcula os 10%
      valorLiquido = valorBruto - taxaMarket;
    }
  }

  const salvarVenda = (e: React.FormEvent) => {
    e.preventDefault();
    alert(`Venda registrada! Lucro líquido: $ ${valorLiquido.toLocaleString('pt-BR')}\nNo futuro, isso atualizará as hunts antigas (FIFO).`);
  };

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Registrar Venda de Loot</h1>

      <form className={styles.formBox} onSubmit={salvarVenda}>
        
        {/* SELEÇÃO DO ITEM */}
        <div className={styles.inputGroup}>
            <label>Para quem você vendeu?</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="tipoVenda" 
                  value="npc" 
                  className={styles.radioInput} /* <-- ADICIONAMOS AQUI */
                  checked={tipoVenda === "npc"} 
                  onChange={() => setTipoVenda("npc")} 
                />
                NPC (Valor fixo)
              </label>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="tipoVenda" 
                  value="player" 
                  className={styles.radioInput} /* <-- ADICIONAMOS AQUI TAMBÉM */
                  checked={tipoVenda === "player"} 
                  onChange={() => setTipoVenda("player")} 
                />
                Market / Player
              </label>
            </div>
          </div>

        {/* QUANTIDADE */}
        <div className={styles.row}>
          <div className={styles.inputGroup}>
            <label>Quantidade Vendida</label>
            <input 
              type="number" 
              className={styles.input} 
              min="1" 
              max={itemData?.quantidadeDisponivel || 999999}
              placeholder="Ex: 600"
              value={quantidadeVenda}
              onChange={(e) => setQuantidadeVenda(e.target.value)}
            />
          </div>
        </div>

        {/* TIPO DE VENDA (NPC ou Player) */}
        {itemSelecionado && (
          <div className={styles.inputGroup}>
            <label>Para quem você vendeu?</label>
            <div className={styles.radioGroup}>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="tipoVenda" 
                  value="npc" 
                  checked={tipoVenda === "npc"} 
                  onChange={() => setTipoVenda("npc")} 
                />
                NPC (Valor fixo)
              </label>
              <label className={styles.radioLabel}>
                <input 
                  type="radio" 
                  name="tipoVenda" 
                  value="player" 
                  checked={tipoVenda === "player"} 
                  onChange={() => setTipoVenda("player")} 
                />
                Market / Player
              </label>
            </div>
          </div>
        )}

        {/* CAMPO EXTRA: Preço por unidade (Só aparece se for Player) */}
        {tipoVenda === "player" && itemSelecionado && (
          <div className={styles.inputGroup}>
            <label>Valor de venda por UNIDADE ($)</label>
            <input 
              type="number" 
              className={styles.input} 
              min="1" 
              placeholder="Ex: 700"
              value={valorPlayerUnidade}
              onChange={(e) => setValorPlayerUnidade(e.target.value)}
            />
          </div>
        )}

        {/* RECIBO VIRTUAL (Cálculos em tempo real) */}
        {itemSelecionado && qtd > 0 && (
          <div className={styles.reciboBox}>
            <h3 style={{marginBottom: '15px', color: '#2d3748', fontSize: '16px'}}>Resumo da Transação</h3>
            
            <div className={styles.reciboLinha}>
              <span>Valor Bruto Total:</span>
              <span>$ {valorBruto.toLocaleString('pt-BR')}</span>
            </div>

            {tipoVenda === "player" && (
              <div className={`${styles.reciboLinha} ${styles.reciboTaxa}`}>
                <span>Imposto do Market (10%):</span>
                <span>- $ {taxaMarket.toLocaleString('pt-BR')}</span>
              </div>
            )}

            <div className={styles.reciboTotal}>
              <span>Lucro Líquido Real:</span>
              <span>$ {valorLiquido.toLocaleString('pt-BR')}</span>
            </div>
            
            {tipoVenda === "player" && (
              <p style={{fontSize: '11px', color: '#718096', marginTop: '10px', textAlign: 'center'}}>
                * O lucro de {valorLiquido.toLocaleString('pt-BR')} substituirá o valor de NPC das suas hunts antigas usando o método PEPS.
              </p>
            )}
          </div>
        )}

        <button type="submit" className={styles.btnSubmit}>
          Confirmar Venda
        </button>

      </form>
    </main>
  );
}