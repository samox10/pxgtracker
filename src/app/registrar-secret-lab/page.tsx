"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { supabase } from "../../lib/supabase";

export default function RegistrarSecretLab() {
  const [tentativas, setTentativas] = useState<number | "">("");
  const [tempo, setTempo] = useState(""); // NOVO ESTADO AQUI!
  const [precoDiamond, setPrecoDiamond] = useState(181000);
  const [lootQuantidades, setLootQuantidades] = useState<Record<string, number>>({});
  const [salvando, setSalvando] = useState(false);

  const itensPadrao = ["Unusual Ore", "Y-Ghost", "Nightmare Ore", "Metal Scrap"];

  const handleLootChange = (nomeItem: string, valor: string) => {
    setLootQuantidades({ ...lootQuantidades, [nomeItem]: Number(valor) || 0 });
  };

  const calcularCusto = () => {
    const t = Number(tentativas) || 1;
    if (t <= 1) return 0; 

    let custo = 0;
    const tentativasPagasEmDinheiro = Math.min(t - 1, 5);
    custo += tentativasPagasEmDinheiro * 75000;

    if (t > 6) {
      const tentativasPagasEmDiamond = t - 6;
      custo += tentativasPagasEmDiamond * precoDiamond;
    }
    return custo;
  };

  const salvarQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);

    const t = Number(tentativas) || 1;
    if (t < 1) {
      alert("Você precisa de pelo menos 1 tentativa.");
      setSalvando(false);
      return;
    }

    const nomesLoot = Object.keys(lootQuantidades).filter(nome => lootQuantidades[nome] > 0);
    
    // VERIFICAÇÃO DE NIGHTMARE GEMS (CRAFT DO Y-GHOST)
    const qtdYGhost = lootQuantidades["Y-Ghost"] || 0;
    const gemsNecessarias = qtdYGhost * 1000; 
    let gemData = null;
    let invGemData = null;

    if (qtdYGhost > 0) {
      const { data: dbGem } = await supabase.from('itens_globais').select('id').eq('nome', 'Nightmare Gem').single();
      if (!dbGem) {
        alert("O item 'Nightmare Gem' não está cadastrado. Cadastre-o para poder craftar o Y-Ghost.");
        setSalvando(false);
        return;
      }
      gemData = dbGem;

      const { data: invGem } = await supabase.from('inventario').select('id, quantidade').eq('item_id', gemData.id).single();
      invGemData = invGem;

      const qtdAtualGems = invGem ? invGem.quantidade : 0;
      if (qtdAtualGems < gemsNecessarias) {
        alert(`Você não tem Nightmare Gems suficientes para craftar ${qtdYGhost}x Y-Ghost.\n\nCusto: ${gemsNecessarias} gems.\nVocê tem: ${qtdAtualGems} gems.`);
        setSalvando(false);
        return;
      }
    }

    let lucroBrutoCalculado = 0;
    let despesasCalculadas = calcularCusto();
    let itensGlobais: any[] = [];

    if (nomesLoot.length > 0) {
      const { data } = await supabase.from('itens_globais').select('id, nome, valor_npc').in('nome', nomesLoot);
      if (data) itensGlobais = data;
    }

    for (const nomeItem of nomesLoot) {
      const itemDb = itensGlobais.find(i => i.nome === nomeItem);
      if (itemDb) lucroBrutoCalculado += (itemDb.valor_npc * lootQuantidades[nomeItem]);
    }

    // SALVAR HISTÓRICO DA QUEST (COM O TEMPO AGORA)
    const dadosDaQuest = {
      pokemon: "[Quest] Secret Lab",
      tempo_caca: tempo || "0m", // SALVANDO O TEMPO AQUI!
      pokemons_mortos: t,
      shinies_mortos: 0,
      lucro_bruto_npc: lucroBrutoCalculado,
      despesas_hunt: despesasCalculadas,
      lucro_extra_market: 0
    };

    const { data: novaHunt, error: errorHistorico } = await supabase.from('historico_hunts').insert([dadosDaQuest]).select().single();

    if (errorHistorico || !novaHunt) {
      alert("Erro ao guardar histórico da Quest.");
      setSalvando(false);
      return;
    }

    // ATUALIZAR INVENTÁRIO (RECOMPENSAS)
    const idsDosItensDropados = nomesLoot.map(nome => {
      const itemDb = itensGlobais.find(i => i.nome === nome);
      return itemDb ? itemDb.id : null;
    }).filter(id => id !== null);

    let inventarioAtual: any[] = [];
    if (idsDosItensDropados.length > 0) {
      const { data } = await supabase.from('inventario').select('id, item_id, quantidade').in('item_id', idsDosItensDropados);
      if (data) inventarioAtual = data;
    }

    const pacoteInventario = [];
    const recibosParaSalvar = [];

    for (const nomeItem of nomesLoot) {
      const itemDb = itensGlobais.find(i => i.nome === nomeItem);
      const qtdAdicionada = lootQuantidades[nomeItem];

      if (itemDb) {
        const itemNaMochila = inventarioAtual.find(inv => inv.item_id === itemDb.id);
        if (itemNaMochila) {
          pacoteInventario.push({ id: itemNaMochila.id, item_id: itemDb.id, quantidade: itemNaMochila.quantidade + qtdAdicionada });
        } else {
          pacoteInventario.push({ item_id: itemDb.id, quantidade: qtdAdicionada });
        }
        recibosParaSalvar.push({ hunt_id: novaHunt.id, item_id: itemDb.id, quantidade_total: qtdAdicionada, quantidade_vendida: 0 });
      }
    }

    const itensParaAtualizar = pacoteInventario.filter(item => item.id);
    const itensParaInserir = pacoteInventario.filter(item => !item.id);

    if (itensParaAtualizar.length > 0) await supabase.from('inventario').upsert(itensParaAtualizar);
    if (itensParaInserir.length > 0) await supabase.from('inventario').insert(itensParaInserir);
    if (recibosParaSalvar.length > 0) await supabase.from('hunt_loot').insert(recibosParaSalvar);

    // DESCONTAR AS NIGHTMARE GEMS
    if (qtdYGhost > 0 && gemData && invGemData) {
      const novaQtdGems = invGemData.quantidade - gemsNecessarias;
      if (novaQtdGems > 0) await supabase.from('inventario').update({ quantidade: novaQtdGems }).eq('id', invGemData.id);
      else await supabase.from('inventario').delete().eq('id', invGemData.id); 

      let qtdRestanteParaAbater = gemsNecessarias;
      const { data: recibos } = await supabase.from('hunt_loot').select('*').eq('item_id', gemData.id).order('created_at', { ascending: true });
      
      const recibosAtualizados = [];
      if (recibos) {
        for (const recibo of recibos) {
          if (qtdRestanteParaAbater <= 0) break;
          const disp = (Number(recibo.quantidade_total) || 0) - (Number(recibo.quantidade_vendida) || 0);
          if (disp > 0) {
            const abatendo = Math.min(disp, qtdRestanteParaAbater);
            recibosAtualizados.push({ ...recibo, quantidade_vendida: (Number(recibo.quantidade_vendida) || 0) + abatendo });
            qtdRestanteParaAbater -= abatendo;
          }
        }
      }
      if (recibosAtualizados.length > 0) await supabase.from('hunt_loot').upsert(recibosAtualizados);
    }

    alert(`Secret Lab registrado com sucesso!`);
    setTentativas(""); setTempo(""); setLootQuantidades({});
    setSalvando(false);
  };

  const formatarDinheiro = (valor: number) => valor.toLocaleString('pt-BR');

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Registrar Secret Lab</h1>

      <form className={styles.formBox} onSubmit={salvarQuest}>
        
        <div className={styles.row}>
          <div className={styles.inputGroup}>
            <label>Tentativas Totais</label>
            <input 
              type="number" className={styles.input} min="1" placeholder="Ex: 2"
              value={tentativas} onChange={(e) => setTentativas(e.target.value)} required
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Tempo Levado</label>
            <input 
              type="text" className={styles.input} placeholder="Ex: 1h 20m"
              value={tempo} onChange={(e) => setTempo(e.target.value)} required
            />
          </div>
          <div className={styles.inputGroup}>
            <label>Preço do Diamond</label>
            <input 
              type="number" className={styles.input} min="0" 
              value={precoDiamond} onChange={(e) => setPrecoDiamond(Number(e.target.value))} required
            />
          </div>
        </div>

        {Number(tentativas) > 1 && (
          <div className={styles.infoGastos}>
            Custo Calculado das Entradas: <strong>$ {formatarDinheiro(calcularCusto())}</strong>
            <p className={styles.subInfo}>1ª grátis | 2ª-6ª 75k | 7ª+ 1 Diamond</p>
          </div>
        )}

        <h2 className={styles.sectionTitle}>Recompensas (Loot)</h2>
        <div className={styles.lootGrid}>
          {itensPadrao.map((item, index) => (
            <div key={index} className={styles.inputGroup}>
              <label style={{fontSize: '13px'}}>{item}</label>
              <input 
                type="number" className={styles.input} min="0" placeholder="0" 
                value={lootQuantidades[item] || ""} onChange={(e) => handleLootChange(item, e.target.value)} 
              />
            </div>
          ))}
        </div>

        <button type="submit" className={styles.btnSubmit} disabled={salvando}>
          {salvando ? "Calculando e Salvando..." : "Salvar Secret Lab"}
        </button>
      </form>
    </main>
  );
}