"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { supabase } from "../../lib/supabase";
import { dicionarioHunts } from "../../data/hunts"; // Puxando as hunts do nosso arquivo limpo!

type ItemDinamico = { id: number; nome: string; quantidade: string; categoria?: string };

export default function RegistrarHunt() {
  
  const [huntSelecionada, setHuntSelecionada] = useState("");
  const [tempoCaca, setTempoCaca] = useState("");
  const [pokemonsMortos, setPokemonsMortos] = useState("");
  const [shiniesMortos, setShiniesMortos] = useState(0);
  
  const [lootQuantidades, setLootQuantidades] = useState<Record<string, number>>({});
  
  const [mostrarGastos, setMostrarGastos] = useState(false);
  const [listaGastos, setListaGastos] = useState<ItemDinamico[]>([]);
  const [mortes, setMortes] = useState(0);

  const handleLootChange = (nomeItem: string, valor: string) => {
    setLootQuantidades({ ...lootQuantidades, [nomeItem]: Number(valor) || 0 });
  };

  const adicionarGasto = () => setListaGastos([...listaGastos, { id: Date.now(), nome: "", quantidade: "", categoria: "" }]);
  const removerGasto = (id: number) => setListaGastos(listaGastos.filter(g => g.id !== id));
  
  const atualizarGasto = (id: number, campo: keyof ItemDinamico, valor: string) => {
    setListaGastos(listaGastos.map(g => g.id === id ? { ...g, [campo]: valor } : g));
  };

  const salvarHunt = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!huntSelecionada) {
      alert("Por favor, selecione uma hunt primeiro!");
      return;
    }

    const nomesLoot = Object.keys(lootQuantidades).filter(nome => lootQuantidades[nome] > 0);
    const nomesGastos = listaGastos.map(g => g.nome).filter(nome => nome.trim() !== "");
    const todosNomesParaBuscar = [...nomesLoot, ...nomesGastos];
    
    let lucroBrutoCalculado = 0;
    let despesasCalculadas = mortes * 50000; // Penalidade por morte
    let itensGlobais: any[] = [];

    // Busca os preços de tudo no banco
    if (todosNomesParaBuscar.length > 0) {
      const { data } = await supabase.from('itens_globais').select('id, nome, valor_npc').in('nome', todosNomesParaBuscar);
      if (data) itensGlobais = data;
    }

    // Calcula os valores antes de salvar
    for (const nomeItem of nomesLoot) {
      const itemDb = itensGlobais.find(i => i.nome === nomeItem);
      if (itemDb) lucroBrutoCalculado += (itemDb.valor_npc * lootQuantidades[nomeItem]);
    }

    for (const gasto of listaGastos) {
      const itemDb = itensGlobais.find(i => i.nome === gasto.nome);
      if (itemDb) despesasCalculadas += (itemDb.valor_npc * (Number(gasto.quantidade) || 0));
    }

    // PASSO 1: SALVAR NO HISTÓRICO (E pegar o ID gerado!)
    const dadosDaHunt = {
      pokemon: dicionarioHunts[huntSelecionada].nome,
      tempo_caca: tempoCaca || "0h 00m",
      pokemons_mortos: Number(pokemonsMortos) || 0,
      shinies_mortos: shiniesMortos,
      lucro_bruto_npc: lucroBrutoCalculado,
      despesas_hunt: despesasCalculadas,
      lucro_extra_market: 0
    };

    const { data: novaHunt, error: errorHistorico } = await supabase
      .from('historico_hunts')
      .insert([dadosDaHunt])
      .select()
      .single();

    if (errorHistorico || !novaHunt) {
      console.error("Erro ao guardar histórico:", errorHistorico);
      alert("Erro ao guardar histórico.");
      return;
    }

    // =========================================================================
    // AQUI COMEÇA A MÁGICA DA OTIMIZAÇÃO (SEM LOOP DE REQUISIÇÕES)
    // =========================================================================

    // 1. Pegamos todos os IDs dos itens que o jogador dropou nessa hunt
    const idsDosItensDropados = nomesLoot.map(nome => {
      const itemDb = itensGlobais.find(i => i.nome === nome);
      return itemDb ? itemDb.id : null;
    }).filter(id => id !== null);

    // 2. Fazemos UMA ÚNICA viagem ao banco pedindo para ver a quantidade atual DESSES itens na mochila
    let inventarioAtual: any[] = [];
    if (idsDosItensDropados.length > 0) {
      const { data } = await supabase
        .from('inventario')
        .select('id, item_id, quantidade')
        .in('item_id', idsDosItensDropados);
      if (data) inventarioAtual = data;
    }

    // 3. Montamos o "pacotão" de dados no próprio site (sem usar internet)
    const pacoteInventario = [];
    const recibosParaSalvar = [];

    for (const nomeItem of nomesLoot) {
      const itemDb = itensGlobais.find(i => i.nome === nomeItem);
      const qtdAdicionada = lootQuantidades[nomeItem];

      if (itemDb) {
        // Procura se o item já estava na mochila
        const itemNaMochila = inventarioAtual.find(inv => inv.item_id === itemDb.id);
        
        if (itemNaMochila) {
          // Se já existia, a gente manda o ID da linha e a quantidade SOMADA
          pacoteInventario.push({
            id: itemNaMochila.id,
            item_id: itemDb.id,
            quantidade: itemNaMochila.quantidade + qtdAdicionada
          });
        } else {
          // Se é a primeira vez que dropa, mandamos só o item e a quantidade (o banco cria o ID)
          pacoteInventario.push({
            item_id: itemDb.id,
            quantidade: qtdAdicionada
          });
        }

        // Já deixamos o recibo pronto
        recibosParaSalvar.push({
          hunt_id: novaHunt.id, 
          item_id: itemDb.id,
          quantidade_total: qtdAdicionada,
          quantidade_vendida: 0 
        });
      }
    }

    // 4. Separamos quem é UPDATE (já tem na mochila) e quem é INSERT (novo na mochila)
    const itensParaAtualizar = pacoteInventario.filter(item => item.id);
    const itensParaInserir = pacoteInventario.filter(item => !item.id);

    if (itensParaAtualizar.length > 0) {
      const { error: errUp } = await supabase.from('inventario').upsert(itensParaAtualizar);
      if (errUp) console.error("Erro ao atualizar inventário:", errUp);
    }

    if (itensParaInserir.length > 0) {
      const { error: errIn } = await supabase.from('inventario').insert(itensParaInserir);
      if (errIn) console.error("Erro ao inserir novo item no inventário:", errIn);
    }

    // 5. Mandamos salvar os recibos todos de uma vez (isso você já tinha feito certo!)
    if (recibosParaSalvar.length > 0) {
      const { error: errorRecibos } = await supabase.from('hunt_loot').insert(recibosParaSalvar);
      if (errorRecibos) console.error("Erro ao gerar recibos FIFO:", errorRecibos);
    }

    alert(`Hunt registada com sucesso!\nRecibos gerados para o Dashboard.`);
    
    // Limpar formulário
    setHuntSelecionada(""); setTempoCaca(""); setPokemonsMortos(""); setShiniesMortos(0); 
    setLootQuantidades({}); setListaGastos([]); setMortes(0); setMostrarGastos(false);
  };

  const lootPadraoDaHunt = huntSelecionada ? dicionarioHunts[huntSelecionada].lootEsperado : [];

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Registar Nova Hunt</h1>

      <form className={styles.formBox} onSubmit={salvarHunt}>
        
        <div className={styles.inputGroup}>
          <label>Qual Pokémon caçou?</label>
          <select className={styles.select} value={huntSelecionada} onChange={(e) => setHuntSelecionada(e.target.value)}>
            <option value="">Selecione uma hunt...</option>
            {Object.entries(dicionarioHunts).map(([chave, info]) => (
              <option key={chave} value={chave}>{info.nome}</option>
            ))}
          </select>
        </div>

        <div className={styles.row}>
          <div className={styles.inputGroup}>
            <label>Tempo de Hunt</label>
            <input type="text" className={styles.input} placeholder="0h 00m" value={tempoCaca} onChange={(e) => setTempoCaca(e.target.value)} />
          </div>
          <div className={styles.inputGroup}>
            <label>Qtd. Pokémons Mortos ⚔️</label>
            <input type="number" className={styles.input} min="0" value={pokemonsMortos} onChange={(e) => setPokemonsMortos(e.target.value)} />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.inputGroup}>
            <label>Shinies da Hunt ✨</label>
            <input type="number" className={styles.input} min="0" value={shiniesMortos} onChange={(e) => setShiniesMortos(Number(e.target.value))} />
          </div>
        </div>

        <h2 className={styles.sectionTitle}>Loot Adquirido</h2>
        
        {lootPadraoDaHunt.length > 0 ? (
          <div className={styles.lootGrid}>
            {lootPadraoDaHunt.map((item, index) => (
              <div key={index} className={styles.inputGroup}>
                <label style={{fontSize: '13px'}}>{item}</label>
                <input 
                  type="number" className={styles.input} min="0" placeholder="0" 
                  value={lootQuantidades[item] || ""} onChange={(e) => handleLootChange(item, e.target.value)} 
                />
              </div>
            ))}
          </div>
        ) : (
          <p style={{fontSize: '14px', color: '#a0aec0', marginBottom: '20px'}}>Selecione uma hunt acima para carregar o loot padrão.</p>
        )}

        <button type="submit" className={styles.btnSubmit}>Salvar Hunt</button>
      </form>
    </main>
  );
}