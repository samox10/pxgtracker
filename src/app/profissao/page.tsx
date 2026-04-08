"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { supabase } from "../../lib/supabase";
import { dicionarioCrafts, dicionarioTrocas } from "../../data/recipes";

export default function Profissao() {
  const [abaAtiva, setAbaAtiva] = useState<"craft" | "conversor" | "historico" | "simulador">("craft");

  // --- ESTADOS NOVOS DO SIMULADOR ---
  const [farmPorHora, setFarmPorHora] = useState(1300);
  const [usarTaxaMarket, setUsarTaxaMarket] = useState(true);
  const [craftEmEdicao, setCraftEmEdicao] = useState<string | null>(null);
  const [precosEditados, setPrecosEditados] = useState<Record<number, string>>({});
  
  // ----------------------------------
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  const [inventario, setInventario] = useState<any[]>([]);
  const [itensGlobais, setItensGlobais] = useState<any[]>([]);
  const [historicoCrafts, setHistoricoCrafts] = useState<any[]>([]);

  const [pontosAtual, setPontosAtual] = useState(0);
  const [pontosInput, setPontosInput] = useState("");
  const [pontosGastosMes, setPontosGastosMes] = useState(0);

  const [qtdTroca, setQtdTroca] = useState<Record<string, string>>({});

  const carregarDados = async () => {
    setCarregando(true);
    const { data: inv } = await supabase.from('inventario').select(`id, item_id, quantidade, itens_globais(nome, valor_npc)`);
    if (inv) {
      const formatado = inv.map((i: any) => ({ 
        ...i, 
        nome: i.itens_globais?.nome || "Item Deletado/Desconhecido", 
        valor_npc: i.itens_globais?.valor_npc || 0 
      }));
      setInventario(formatado);
      const p = formatado.find(i => i.nome === "Pontos Designer");
      setPontosAtual(p ? p.quantidade : 0);
    }

    const { data: globais } = await supabase.from('itens_globais').select('*');
    if (globais) setItensGlobais(globais);

    const hoje = new Date();
    const mesAtual = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
    
    // CORREÇÃO: Removemos o .like() do created_at. Pedimos os crafts e filtramos no JS!
    const { data: hunts } = await supabase.from('historico_hunts')
      .select('*')
      .like('pokemon', '[Craft]%')
      .order('created_at', { ascending: false });
    
    if (hunts) {
      // A Mágica do filtro do mês feita no frontend (igual ao Dashboard)
      const craftsDoMes = hunts.filter(h => h.created_at && h.created_at.includes(mesAtual));
      
      setHistoricoCrafts(craftsDoMes);
      let gastos = 0;
      craftsDoMes.forEach(h => { gastos += (Number(h.shinies_mortos) || 0); }); // Os pontos gastos estão salvos em shinies_mortos!
      setPontosGastosMes(gastos);
    }
    setCarregando(false);
  };

  useEffect(() => { carregarDados(); }, []);

  const renderizarIcone = (icone: string) => {
    if (!icone) return <span>📦</span>;
    if (icone.includes('.')) return <img src={`/itens/${icone}`} alt="icone" style={{width: '100%', height: '100%', objectFit: 'contain'}} />;
    return <span>{icone}</span>;
  };

  const atualizarPontos = async () => {
    const novosPontos = Number(pontosInput);
    if (novosPontos < 0 || isNaN(novosPontos)) return;
    setSalvando(true);
    const dbPonto = itensGlobais.find(i => i.nome === "Pontos Designer");
    const invPonto = inventario.find(i => i.nome === "Pontos Designer");
    if (invPonto) await supabase.from('inventario').update({ quantidade: novosPontos }).eq('id', invPonto.id);
    else await supabase.from('inventario').insert({ item_id: dbPonto?.id, quantidade: novosPontos });
    setPontosAtual(novosPontos); setPontosInput(""); setSalvando(false); carregarDados();
  };

  // --- O MOTOR PEPS (FIFO) ---
  const abaterEstoqueE_CalcularCustoExato = async (invMat: any, qtdNecessaria: number) => {
    let custoTotalExato = 0;

    // Remove do inventário visual
    const novaQtd = invMat.quantidade - qtdNecessaria;
    if (novaQtd > 0) await supabase.from('inventario').update({ quantidade: novaQtd }).eq('id', invMat.id);
    else await supabase.from('inventario').delete().eq('id', invMat.id);

    // Busca recibos
    const { data: recibos } = await supabase.from('hunt_loot').select('*').eq('item_id', invMat.item_id).order('created_at', { ascending: true });
    
    if (recibos && recibos.length > 0) {
      // Pega o histórico para saber quanto foi pago em cada recibo
      const huntIds = recibos.map((r: any) => r.hunt_id);
      const { data: huntsDb } = await supabase.from('historico_hunts').select('id, pokemon, despesas_hunt, pokemons_mortos').in('id', huntIds);

      const recibosAtualizados = [];
      let qtdRestante = qtdNecessaria;

      for (const r of recibos) {
        if (qtdRestante <= 0) break;
        const disp = r.quantidade_total - (r.quantidade_vendida || 0);
        if (disp > 0) {
          const abatendo = Math.min(disp, qtdRestante);
          const huntRelacionada = huntsDb?.find(h => h.id === r.hunt_id);
          
          let custoUnitarioDoLote = invMat.valor_npc || 0; // Valor de Drop (Custo Oportunidade)

          // Se veio do Market ou Conversão, divide o total pago pela quantidade do lote!
          if (huntRelacionada && huntRelacionada.pokemon.startsWith('[')) {
            custoUnitarioDoLote = huntRelacionada.despesas_hunt / huntRelacionada.pokemons_mortos;
          }

          custoTotalExato += (abatendo * custoUnitarioDoLote);
          recibosAtualizados.push({ ...r, quantidade_vendida: (r.quantidade_vendida || 0) + abatendo });
          qtdRestante -= abatendo;
        }
      }
      if (recibosAtualizados.length > 0) await supabase.from('hunt_loot').upsert(recibosAtualizados);
    }
    return custoTotalExato;
  };

  // --- LÓGICA DO CONVERSOR NPC ---
  const realizarTroca = async (troca: any) => {
    const qtdDesejada = Number(qtdTroca[troca.nome]) || 0;
    if (qtdDesejada <= 0) return;
    setSalvando(true);

    const custoAurasTotal = qtdDesejada * troca.auraCusto;
    const invAura = inventario.find(i => i.nome === "Solidified Aura");

    if (!invAura || invAura.quantidade < custoAurasTotal) {
      alert(`Você precisa de ${custoAurasTotal} Auras. Você tem ${invAura ? invAura.quantidade : 0}.`);
      setSalvando(false); return;
    }

    const itemFinalDb = itensGlobais.find(i => i.nome === troca.nome);
    
    // Calcula o custo cravado nas compras anteriores e atualiza estoque!
    const custoConvertidoExato = await abaterEstoqueE_CalcularCustoExato(invAura, custoAurasTotal);

    // Registra a Conversão como uma "Hunt" para podermos guardar esse custo exato pro próximo item!
    const dadosConversao = {
      pokemon: `[Conversão] ${troca.nome}`,
      tempo_caca: "0m",
      pokemons_mortos: qtdDesejada, // Salva a QTD pra dividir o preço unitário depois
      shinies_mortos: 0,
      lucro_bruto_npc: 0,
      despesas_hunt: custoConvertidoExato, // O valor de custo real
      lucro_extra_market: 0
    };
    const { data: novaHunt } = await supabase.from('historico_hunts').insert([dadosConversao]).select().single();

    // Adiciona o Star Remains e seu novo Recibo valioso!
    const invItemFinal = inventario.find(i => i.item_id === itemFinalDb.id);
    if (invItemFinal) await supabase.from('inventario').update({ quantidade: invItemFinal.quantidade + qtdDesejada }).eq('id', invItemFinal.id);
    else await supabase.from('inventario').insert({ item_id: itemFinalDb.id, quantidade: qtdDesejada });

    if (novaHunt) {
      await supabase.from('hunt_loot').insert([{ hunt_id: novaHunt.id, item_id: itemFinalDb.id, quantidade_total: qtdDesejada, quantidade_vendida: 0 }]);
    }

    alert(`Troca efetuada! Custo exato PEPS repassado para o(s) ${qtdDesejada}x ${troca.nome}: $ ${custoConvertidoExato.toLocaleString('pt-BR')}`);
    setQtdTroca({ ...qtdTroca, [troca.nome]: "" });
    setSalvando(false); carregarDados();
  };

  // --- LÓGICA DE PRODUÇÃO DO CRAFT ---
  const realizarCraft = async (chaveCraft: string) => {
    const receita = dicionarioCrafts[chaveCraft];
    setSalvando(true);

    if (pontosAtual < receita.pontosNecessarios) { alert("Pontos insuficientes!"); setSalvando(false); return; }

    for (const mat in receita.materiais) {
      const invMat = inventario.find(i => i.nome === mat);
      if (!invMat || invMat.quantidade < receita.materiais[mat]) { alert(`Faltando: ${mat}`); setSalvando(false); return; }
    }

    const itemFinalDb = itensGlobais.find(i => i.nome === receita.nome);
    let custoTotalProducaoExato = 0;

    // Roda o cálculo e desconto em todos os ingredientes
    for (const mat in receita.materiais) {
      const qtdNecessaria = receita.materiais[mat];
      const invMat = inventario.find(i => i.nome === mat);
      custoTotalProducaoExato += await abaterEstoqueE_CalcularCustoExato(invMat, qtdNecessaria);
    }

    // Desconta Pontos
    const invPonto = inventario.find(i => i.nome === "Pontos Designer");
    const novosPontos = pontosAtual - receita.pontosNecessarios;
    await supabase.from('inventario').update({ quantidade: novosPontos }).eq('id', invPonto.id);

    // Adiciona o Item Final
    const invItemFinal = inventario.find(i => i.item_id === itemFinalDb.id);
    if (invItemFinal) await supabase.from('inventario').update({ quantidade: invItemFinal.quantidade + 1 }).eq('id', invItemFinal.id);
    else await supabase.from('inventario').insert({ item_id: itemFinalDb.id, quantidade: 1 });

    // Registra a Produção
    const dadosCraft = {
      pokemon: `[Craft] ${receita.nome}`,
      tempo_caca: "0m",
      pokemons_mortos: 1, // É gerado 1 item
      shinies_mortos: receita.pontosNecessarios, // A mágica: Salva os PONTOS gastos aqui pra recuperar no histórico!
      lucro_bruto_npc: 0,
      despesas_hunt: custoTotalProducaoExato, // O Dashboard ignora, mas a tela de profissões mostra o lucro real!
      lucro_extra_market: 0
    };

    const { data: novaHunt } = await supabase.from('historico_hunts').insert([dadosCraft]).select().single();
    if (novaHunt) {
      await supabase.from('hunt_loot').insert([{ hunt_id: novaHunt.id, item_id: itemFinalDb.id, quantidade_total: 1, quantidade_vendida: 0 }]);
    }

    alert(`${receita.nome} craftado!\nCusto Real da Produção: $ ${custoTotalProducaoExato.toLocaleString('pt-BR')}`);
    setSalvando(false); carregarDados();
  };
  // --- FUNÇÕES DO SIMULADOR (MODAL POR CRAFT) ---
  const abrirModalPrecos = (chaveCraft: string, receita: any) => {
    const precos: Record<number, string> = {};
    
    // Puxa o item final (Produto)
    const finalItem = itensGlobais.find(i => i.nome === receita.nome);
    if (finalItem) precos[finalItem.id] = String(finalItem.valor_market || 0);

    // Puxa os ingredientes
    Object.keys(receita.materiais).forEach(matNome => {
      const matItem = itensGlobais.find(i => i.nome === matNome);
      if (matItem) precos[matItem.id] = String(matItem.valor_market || 0);
    });

    setPrecosEditados(precos);
    setCraftEmEdicao(chaveCraft);
  };

  const fecharModalPrecos = () => {
    setCraftEmEdicao(null);
    setPrecosEditados({});
  };

  const salvarPrecosCraft = async () => {
    setSalvando(true);
    
    const atualizacoes = Object.entries(precosEditados).map(([idStr, valorStr]) => {
      const id = Number(idStr);
      const val = Number(valorStr) || 0;
      const original = itensGlobais.find(i => i.id === id);
      
      // Só manda pro banco se o valor realmente mudou!
      if (!original || (original.valor_market || 0) === val) return null;
      return { id, nome: original.nome, valor_market: val };
    }).filter(Boolean); // Remove os nulos

    if (atualizacoes.length > 0) {
      // Usamos 'as any' rápido aqui porque o filter do TypeScript é chatinho com nulls
      const { error } = await supabase.from('itens_globais').upsert(atualizacoes as any);
      if (error) {
        alert("Erro ao salvar preços!");
        console.error(error);
      }
    }

    fecharModalPrecos();
    setSalvando(false);
    carregarDados();
  };
  // ----------------------------------------------

  if (carregando) return <main className={styles.container}><h2 style={{textAlign: 'center', marginTop: '50px'}}>Carregando Ateliê...</h2></main>;

  const formatarDinheiro = (v: number) => Math.round(v).toLocaleString('pt-BR');

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Ateliê do Designer</h1>

      <div className={styles.tabs}>
        <button className={`${styles.tabButton} ${abaAtiva === "craft" ? styles.activeTab : ""}`} onClick={() => setAbaAtiva("craft")}>🔨 Produção</button>
        <button className={`${styles.tabButton} ${abaAtiva === "conversor" ? styles.activeTab : ""}`} onClick={() => setAbaAtiva("conversor")}>🔄 Trocas no NPC</button>
        <button className={`${styles.tabButton} ${abaAtiva === "historico" ? styles.activeTab : ""}`} onClick={() => setAbaAtiva("historico")}>📜 Histórico / Lucro Real</button>
        <button className={`${styles.tabButton} ${abaAtiva === "simulador" ? styles.activeTab : ""}`} style={{backgroundColor: abaAtiva === "simulador" ? '#3182ce' : '#ebf8ff', color: abaAtiva === "simulador" ? 'white' : '#2b6cb0'}} onClick={() => setAbaAtiva("simulador")}>📈 Simulador</button>
      </div>

      {abaAtiva === "conversor" && (
        <>
          <div style={{ backgroundColor: '#ebf8ff', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #bee3f8', color: '#2b6cb0' }}>
            <p><strong>Solidified Auras Disponíveis:</strong> {inventario.find(i => i.nome === "Solidified Aura")?.quantidade || 0} un.</p>
          </div>
          <div className={styles.gridCrafts}>
            {dicionarioTrocas.map((troca) => (
              <div key={troca.nome} className={styles.cardCraft} style={{ borderColor: '#bee3f8', padding: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                  <div className={styles.itemImage} style={{ width: '40px', height: '40px' }}>{renderizarIcone(troca.icone)}</div>
                  <div>
                    <div style={{ fontWeight: 'bold', color: '#2d3748' }}>{troca.nome}</div>
                    <div style={{ fontSize: '12px', color: '#718096' }}>Custo: {troca.auraCusto} Auras</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <input 
                    type="number" className={styles.inputPontos} style={{ flex: 1, width: '100%' }} placeholder="Qtd" min="1"
                    value={qtdTroca[troca.nome] || ""} onChange={(e) => setQtdTroca({ ...qtdTroca, [troca.nome]: e.target.value })}
                  />
                  <button className={styles.btnAtualizar} style={{ backgroundColor: '#3182ce' }} onClick={() => realizarTroca(troca)} disabled={salvando}>Trocar</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {abaAtiva === "craft" && (
        <>
          <div className={styles.headerProfissao}>
            <div className={styles.pontosBox}>
              <span className={styles.pontosLabel}>Pontos Adquiridos no Mês</span>
              <span className={styles.pontosValue}>{(pontosAtual + pontosGastosMes).toLocaleString('pt-BR')} ✨</span>
              <span style={{fontSize: '12px', color: '#718096'}}>Saldo Atual p/ Uso: <strong>{pontosAtual}</strong></span>
            </div>
            
            <div className={styles.atualizarBox}>
              <input 
                type="number" className={styles.inputPontos} placeholder="Atualizar saldo..."
                value={pontosInput} onChange={(e) => setPontosInput(e.target.value)}
              />
              <button className={styles.btnAtualizar} onClick={atualizarPontos} disabled={salvando}>Salvar</button>
            </div>
          </div>

          <div className={styles.gridCrafts}>
            {Object.entries(dicionarioCrafts).map(([chave, receita]) => {
              const podeCraftar = pontosAtual >= receita.pontosNecessarios && Object.entries(receita.materiais).every(([mat, qtd]) => {
                const inv = inventario.find(i => i.nome === mat);
                return inv && inv.quantidade >= qtd;
              });

              return (
                <div key={chave} className={styles.cardCraft}>
                  <div className={styles.cardHeader}>
                    <div className={styles.itemImage}>{renderizarIcone(receita.icone)}</div>
                    <div>
                      <div className={styles.itemNome}>{receita.nome}</div>
                      <div className={styles.itemPontos}>Custo: {receita.pontosNecessarios} Pontos</div>
                    </div>
                  </div>

                  <div className={styles.materiaisTitle}>Ingredientes Necessários</div>
                  <div style={{marginBottom: '20px'}}>
                    {Object.entries(receita.materiais).map(([mat, qtd]) => {
                      const inv = inventario.find(i => i.nome === mat);
                      const qtdAtual = inv ? inv.quantidade : 0;
                      const falta = qtdAtual < qtd;

                      return (
                        <div key={mat} className={styles.materialRow}>
                          <span>{qtd}x {mat}</span>
                          <span className={falta ? styles.matFaltando : styles.matOk}>({qtdAtual}/{qtd})</span>
                        </div>
                      );
                    })}
                  </div>

                  <button 
                    className={styles.btnCraft} 
                    disabled={!podeCraftar || salvando}
                    onClick={() => realizarCraft(chave)}
                  >
                    {podeCraftar ? "Produzir Item" : "Materiais Insuficientes"}
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {abaAtiva === "historico" && (
        <div>
          <div style={{ backgroundColor: '#fffaf0', border: '1px dashed #dd6b20', padding: '15px', borderRadius: '8px', marginBottom: '20px', color: '#c05621', fontSize: '14px' }}>
            <strong>Contabilidade Exata (PEPS):</strong> O Custo Total abaixo puxa o valor cravado das compras que você fez e converteu, sem mexer no saldo do Dashboard.
          </div>

          {historicoCrafts.length === 0 ? <p>Nenhum item produzido este mês.</p> : (
            historicoCrafts.map(craft => {
              const foiVendido = craft.lucro_extra_market > 0;
              const custoProducao = craft.despesas_hunt; // É o valor PEPS exato lido!
              const lucroReal = craft.lucro_extra_market - custoProducao;
              
              return (
                <div key={craft.id} style={{backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div>
                    <div style={{fontWeight: 'bold', color: '#44337a'}}>{craft.pokemon.replace('[Craft] ', '')}</div>
                    <div style={{fontSize: '12px', color: '#a0aec0'}}>{new Date(craft.created_at).toLocaleDateString('pt-BR')} • {craft.shinies_mortos} pontos usados</div>
                  </div>
                  
                  <div style={{textAlign: 'right'}}>
                    {foiVendido ? (
                      <>
                        <div style={{fontSize: '12px', color: '#718096'}}>Venda Total: $ {formatarDinheiro(craft.lucro_extra_market)}</div>
                        <div style={{fontSize: '12px', color: '#e53e3e'}}>Custo Real (PEPS): - $ {formatarDinheiro(custoProducao)}</div>
                        <div style={{fontWeight: 'bold', fontSize: '16px', color: lucroReal >= 0 ? '#38a169' : '#e53e3e', marginTop: '5px'}}>
                          Lucro Líquido: $ {formatarDinheiro(lucroReal)}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{fontSize: '13px', color: '#dd6b20', fontWeight: 'bold'}}>Aguardando Venda no Inventário</div>
                        <div style={{fontSize: '12px', color: '#e53e3e'}}>Investimento: $ {formatarDinheiro(custoProducao)}</div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
      {/* ======================================================= */}
      {/* TELA DO SIMULADOR DE MERCADO (POR CRAFT) */}
      {/* ======================================================= */}
      {abaAtiva === "simulador" && (
        <div style={{ marginTop: '20px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ebf8ff', padding: '15px', borderRadius: '8px', border: '1px solid #bee3f8', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#2b6cb0', fontWeight: 'bold', display: 'block' }}>Meus Pontos por Hora:</label>
                <input 
                  type="number" 
                  style={{ padding: '8px', borderRadius: '4px', border: '1px solid #bee3f8', width: '120px' }}
                  value={farmPorHora} 
                  onChange={(e) => setFarmPorHora(Number(e.target.value) || 0)} 
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '15px' }}>
                <input 
                  type="checkbox" 
                  id="taxaSimulador" 
                  checked={usarTaxaMarket} 
                  onChange={(e) => setUsarTaxaMarket(e.target.checked)} 
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="taxaSimulador" style={{ color: '#2b6cb0', fontSize: '14px', cursor: 'pointer' }}>Descontar 10% de Market na Venda</label>
              </div>
            </div>
            <div style={{color: '#2b6cb0', fontSize: '13px', fontStyle: 'italic'}}>
              Dica: Clique na engrenagem de um craft para editar seus preços.
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', fontSize: '12px' }}>
              <thead style={{ backgroundColor: '#edf2f7', color: '#4a5568', textAlign: 'left' }}>
                <tr>
                  <th style={{ padding: '8px 12px' }}>Craft / Item</th>
                  <th style={{ padding: '8px 12px' }}>Custo Mat.</th>
                  <th style={{ padding: '8px 12px' }}>Venda Mkt.</th>
                  <th style={{ padding: '8px 12px' }}>Lucro Líquido</th>
                  <th style={{ padding: '8px 12px' }}>Cash / Ponto</th>
                  <th style={{ padding: '8px 12px', backgroundColor: '#e2e8f0', color: '#2b6cb0' }}>Cash / Hora 🔥</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(dicionarioCrafts).map(([chave, receita]) => {
                  let custoMateriais = 0;
                  Object.entries(receita.materiais).forEach(([matNome, qtd]) => {
                    const itemDb = itensGlobais.find(i => i.nome === matNome);
                    custoMateriais += (itemDb?.valor_market || 0) * qtd;
                  });

                  const itemFinalDb = itensGlobais.find(i => i.nome === receita.nome);
                  const vendaBruta = itemFinalDb?.valor_market || 0;
                  const vendaLiquida = usarTaxaMarket ? vendaBruta * 0.90 : vendaBruta;
                  const lucroTotal = vendaLiquida - custoMateriais;
                  const cashPorPonto = receita.pontosNecessarios > 0 ? (lucroTotal / receita.pontosNecessarios) : 0;
                  const cashPorHora = farmPorHora > 0 ? (cashPorPonto * farmPorHora) : 0;

                  return { chave, receita, custoMateriais, vendaBruta, lucroTotal, cashPorPonto, cashPorHora };
                })
                .sort((a, b) => b.cashPorHora - a.cashPorHora)
                .map((linha, index) => (
                  <tr key={linha.chave} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: index === 0 ? '#f0fff4' : 'transparent' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold', color: '#2d3748', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '20px', height: '20px' }}>{renderizarIcone(linha.receita.icone)}</div>
                      {linha.receita.nome}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#e53e3e' }}>- {formatarDinheiro(linha.custoMateriais)}</td>
                    <td style={{ padding: '8px 12px', color: '#3182ce' }}>{formatarDinheiro(linha.vendaBruta)}</td>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold', color: linha.lucroTotal >= 0 ? '#38a169' : '#e53e3e' }}>
                      {formatarDinheiro(linha.lucroTotal)}
                    </td>
                    <td style={{ padding: '8px 12px', color: '#718096' }}>{formatarDinheiro(linha.cashPorPonto)} / pt</td>
                    <td style={{ padding: '8px 12px', fontWeight: 'bold', color: linha.cashPorHora >= 0 ? '#276749' : '#c53030', backgroundColor: index === 0 ? '#c6f6d5' : '#edf2f7' }}>
                      {formatarDinheiro(linha.cashPorHora)}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <button 
                        onClick={() => abrirModalPrecos(linha.chave, linha.receita)}
                        style={{ padding: '4px 8px', backgroundColor: '#edf2f7', border: '1px solid #cbd5e0', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 'bold', color: '#4a5568' }}
                      >
                        ⚙️ Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MODAL DE EDIÇÃO ESPECÍFICO DO CRAFT */}
          {craftEmEdicao && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={fecharModalPrecos}>
              <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '90%', maxWidth: '350px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} onClick={(e) => e.stopPropagation()}>
                
                <h2 style={{ fontSize: '15px', color: '#2d3748', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '15px' }}>
                  Preços: {dicionarioCrafts[craftEmEdicao]?.nome}
                </h2>

                {/* Bloco do Produto Final */}
                <div style={{ marginBottom: '15px', backgroundColor: '#ebf8ff', padding: '12px', borderRadius: '6px', border: '1px solid #bee3f8' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#2b6cb0', display: 'block', marginBottom: '6px' }}>Valor de Venda (Item Final)</label>
                  {(() => {
                    const finalItemDb = itensGlobais.find(i => i.nome === dicionarioCrafts[craftEmEdicao].nome);
                    return finalItemDb ? (
                      <input 
                        type="number" min="0" placeholder="Ex: 1500000"
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #90cdf4', fontSize: '13px' }}
                        value={precosEditados[finalItemDb.id]} 
                        onChange={(e) => setPrecosEditados({ ...precosEditados, [finalItemDb.id]: e.target.value })}
                      />
                    ) : <span style={{color: 'red', fontSize: '11px'}}>Cadastre o item {dicionarioCrafts[craftEmEdicao].nome} no BD global.</span>
                  })()}
                </div>

                {/* Bloco dos Materiais */}
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#4a5568', display: 'block', marginBottom: '8px' }}>Custo dos Materiais</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
                  {Object.keys(dicionarioCrafts[craftEmEdicao].materiais).map(matNome => {
                    const matDb = itensGlobais.find(i => i.nome === matNome);
                    if (!matDb) return <div key={matNome} style={{color: 'red', fontSize: '11px'}}>Item {matNome} não encontrado.</div>;
                    
                    return (
                      <div key={matNome} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f7fafc', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                        <span style={{ fontSize: '12px', color: '#4a5568', fontWeight: '500' }}>{matNome}</span>
                        <input 
                          type="number" min="0" placeholder="0"
                          style={{ width: '90px', padding: '4px 6px', borderRadius: '4px', border: '1px solid #cbd5e0', textAlign: 'right', fontSize: '12px' }}
                          value={precosEditados[matDb.id]} 
                          onChange={(e) => setPrecosEditados({ ...precosEditados, [matDb.id]: e.target.value })}
                        />
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button onClick={fecharModalPrecos} style={{ padding: '8px 12px', backgroundColor: '#e2e8f0', color: '#4a5568', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>Cancelar</button>
                  <button onClick={salvarPrecosCraft} disabled={salvando} style={{ padding: '8px 12px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>
                    {salvando ? "Salvando..." : "💾 Salvar"}
                  </button>
                </div>

              </div>
            </div>
          )}

        </div>
      )}
      {/* ======================================================= */}
    </main>
  );
}