"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { supabase } from "../../lib/supabase";

type ItemGlobal = { id: number; nome: string; };

export default function ComprasMarket() {
  const [itensCatalogo, setItensCatalogo] = useState<ItemGlobal[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [itemSelecionado, setItemSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState("");
  // Agora usamos valorUnidade em vez de valorTotal!
  const [valorUnidade, setValorUnidade] = useState("");

  useEffect(() => {
    async function carregarItens() {
      const { data } = await supabase.from('itens_globais').select('id, nome').order('nome', { ascending: true });
      if (data) setItensCatalogo(data);
      setCarregando(false);
    }
    carregarItens();
  }, []);

  const registrarCompra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemSelecionado) return alert("Por favor, selecione um item.");

    setSalvando(true);
    const qtd = Number(quantidade) || 0;
    const precoUnidade = Number(valorUnidade) || 0;
    
    // A MATÉMATICA ACONTECE AQUI:
    const gastoTotal = qtd * precoUnidade; 
    
    const itemIdNum = Number(itemSelecionado);
    const itemNome = itensCatalogo.find(i => i.id === itemIdNum)?.nome || "Item Desconhecido";

    // 1. O Livro Caixa: Cria a compra no Histórico usando o Gasto Total
    const dadosCompra = {
      pokemon: `[Market] Compra de ${itemNome}`,
      tempo_caca: "0m",
      pokemons_mortos: qtd, // A MÁGICA: Guardamos a qtd para calcular o PEPS
      shinies_mortos: 0,
      lucro_bruto_npc: 0,
      despesas_hunt: gastoTotal, // Vai descontar o TOTAL no Dashboard
      lucro_extra_market: 0
    };
    const { data: novaHunt } = await supabase.from('historico_hunts').insert([dadosCompra]).select().single();

    // 2. Atualiza Inventário
    const { data: invAtual } = await supabase.from('inventario').select('id, quantidade').eq('item_id', itemIdNum).single();
    if (invAtual) await supabase.from('inventario').update({ quantidade: invAtual.quantidade + qtd }).eq('id', invAtual.id);
    else await supabase.from('inventario').insert({ item_id: itemIdNum, quantidade: qtd });

    // 3. A Papelada: Gera o recibo pro método PEPS (FIFO)
    if (novaHunt) {
      await supabase.from('hunt_loot').insert({
        hunt_id: novaHunt.id,
        item_id: itemIdNum,
        quantidade_total: qtd,
        quantidade_vendida: 0
      });
    }

    alert(`Compra registrada!\nVocê pagou $ ${precoUnidade.toLocaleString('pt-BR')} cada.\nGasto Total: $ ${gastoTotal.toLocaleString('pt-BR')}`);
    
    setItemSelecionado(""); setQuantidade(""); setValorUnidade(""); setSalvando(false);
  };

  if (carregando) return <main className={styles.container}><h2 style={{textAlign: 'center', marginTop: '50px'}}>Carregando Catálogo...</h2></main>;

  const formatarDinheiro = (v: number) => v.toLocaleString('pt-BR');
  const calculoTotalEmTempoReal = (Number(quantidade) || 0) * (Number(valorUnidade) || 0);

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>🛒 Comprar no Market</h1>
      <form className={styles.formBox} onSubmit={registrarCompra}>
        <div className={styles.inputGroup}>
          <label>Qual item você comprou?</label>
          <select className={styles.select} value={itemSelecionado} onChange={(e) => setItemSelecionado(e.target.value)} required>
            <option value="">Selecione um item ou pesquise...</option>
            {itensCatalogo.map(item => (<option key={item.id} value={item.id}>{item.nome}</option>))}
          </select>
        </div>
        
        <div className={styles.row}>
          <div className={styles.inputGroup}>
            <label>Quantidade Comprada</label>
            <input type="number" className={styles.input} min="1" placeholder="Ex: 3" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} required />
          </div>
          <div className={styles.inputGroup}>
            <label>Valor de CADA UNIDADE ($)</label>
            <input type="number" className={styles.input} min="1" placeholder="Ex: 50000" value={valorUnidade} onChange={(e) => setValorUnidade(e.target.value)} required />
          </div>
        </div>

        {/* Resumo em tempo real para ajudar visualmente */}
        {calculoTotalEmTempoReal > 0 && (
          <div style={{ backgroundColor: '#fff5f5', border: '1px dashed #fc8181', padding: '15px', borderRadius: '6px', color: '#c53030', textAlign: 'center' }}>
            Valor Total do Lote: <strong>$ {formatarDinheiro(calculoTotalEmTempoReal)}</strong>
            <p style={{fontSize: '12px', marginTop: '5px'}}>Este é o valor que será abatido como despesa no Dashboard.</p>
          </div>
        )}

        <button type="submit" className={styles.btnSubmit} disabled={salvando}>
          {salvando ? "Registrando..." : "Confirmar Compra"}
        </button>
      </form>
    </main>
  );
}