"use client";

import React, { useState, useEffect, useMemo } from "react";
import styles from "./page.module.css";
import { supabase } from "../lib/supabase";

const dicionarioHunts: Record<string, { nome: string; icone: string; shinyIcon?: string }> = {
  charizard: { nome: "Charizard Valley", icone: "charizard.png" },
  alakazam: { nome: "Alakazam (Kanto)", icone: "alakazam.png" },
  lycanroc: { nome: "Lycanroc", icone: "lycanroc.png", shinyIcon: "golden_sudowoodo.png" },
  alolan_persian: { nome: "Alolan Persian", icone: "alolan_persian.png", shinyIcon: "shiny_honchkrow.png" },
  drampa: { nome: "Drampa", icone: "drampa.png", shinyIcon: "mega_drampa.png" },
  pyroar: { nome: "Pyroar", icone: "pyroar.png", shinyIcon: "Mega_Pyroar.png" },
  houndoom: { nome: "Houndoom", icone: "houndoom.png", shinyIcon: "mega_houndoom.gif" },
  weavile: { nome: "Weavile", icone: "weavile.png", shinyIcon: "shiny_weavile.png" },
  mixrock: { nome: "Mix Rock", icone: "mixrock.png", shinyIcon: "golden_sudowoodo.png" },
  porygon: { nome: "Porygon", icone: "porygon.png", shinyIcon: "porygonz.png" },
};

type HuntHistory = { id: number; created_at: string; pokemon: string; tempo_caca: string; pokemons_mortos: number; shinies_mortos: number; lucro_bruto_npc: number; despesas_hunt: number; lucro_extra_market: number; };
type DespesaGlobal = { id: number; created_at: string; descricao: string; valor: number; };
type DetalheLoot = { nome: string; quantidade: number; icone: string; };

export default function Dashboard() {
  const [hunts, setHunts] = useState<HuntHistory[]>([]);
  const [despesasGlobais, setDespesasGlobais] = useState<DespesaGlobal[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [mesSelecionado, setMesSelecionado] = useState(() => {
    const hoje = new Date(); return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });

  const [huntSelecionadaModal, setHuntSelecionadaModal] = useState<HuntHistory | null>(null);
  const [detalhesLoot, setDetalhesLoot] = useState<DetalheLoot[]>([]);
  const [carregandoDetalhes, setCarregandoDetalhes] = useState(false);

  const formatarDinheiro = (valor: number) => {
    if (valor === 0) return "0";
    const abs = Math.abs(valor);
    let formatado = "";
    if (abs >= 1000000) formatado = (abs / 1000000).toFixed(1).replace('.0', '') + 'kk';
    else if (abs >= 1000) formatado = (abs / 1000).toFixed(1).replace('.0', '') + 'k';
    else formatado = abs.toString();
    return valor < 0 ? `- ${formatado}` : formatado;
  };

  const converterParaMinutos = (tempoString: string) => {
    let horas = 0; let minutos = 0;
    const t = (tempoString || "").toLowerCase().trim();
    const hM = t.match(/(\d+)\s*h/); const mM = t.match(/(\d+)\s*m/);
    if (hM && hM) horas = parseInt(hM, 10);
    if (mM && mM) minutos = parseInt(mM, 10);
    
    if (!hM && !mM && t.includes(':')) {
        const p = t.split(':'); 
        if (p.length > 0) horas = parseInt(p, 10) || 0; 
        if (p.length > 1) minutos = parseInt(p, 10) || 0;
    } else if (!hM && !mM && /^\d+$/.test(t)) {
      const total = parseInt(t, 10); horas = Math.floor(total / 60); minutos = total % 60;
    }
    return (horas * 60) + minutos;
  };

  const formatarTempo = (tempoString: string) => {
    const totalMinutos = converterParaMinutos(tempoString);
    if (totalMinutos === 0) return "0m";
    const h = Math.floor(totalMinutos / 60); const m = totalMinutos % 60;
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`; return `${m}m`;
  };

  useEffect(() => {
    async function carregarDashboard() {
      try {
        const { data: dataHunts } = await supabase.from('historico_hunts').select('*').order('created_at', { ascending: false });
        if (dataHunts) setHunts(dataHunts);
        const { data: dataDespesas } = await supabase.from('despesas_globais').select('*');
        if (dataDespesas) setDespesasGlobais(dataDespesas);
      } catch (error) { console.error(error); } finally { setCarregando(false); }
    }
    carregarDashboard();
  }, []);

  const formatarData = (dataIso: string) => { const data = new Date(dataIso); return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); };

  const dashboardData = useMemo(() => {
    const anoSelecionadoStr = mesSelecionado.substring(0, 4);
    const todasHuntsDoMes = hunts.filter(h => h.created_at && h.created_at.includes(mesSelecionado));
    
    const huntsNormais = todasHuntsDoMes.filter(h => !h.pokemon.startsWith("["));
    const questsDoMes = todasHuntsDoMes.filter(h => h.pokemon.startsWith("[Quest]"));

    const huntsDoAno = hunts.filter(h => h.created_at && h.created_at.includes(anoSelecionadoStr));
    const despesasDoMes = despesasGlobais.filter(d => d.created_at && d.created_at.includes(mesSelecionado));
    const despesasDoAno = despesasGlobais.filter(d => d.created_at && d.created_at.includes(anoSelecionadoStr));

    let somaShinies = 0; let totalMinutosMes = 0;
    let lucroBrutoMes = 0; let despesasHuntsMes = 0; let despesasFechamentoMes = 0;
    let lucroBrutoAno = 0; let despesasHuntsAno = 0; let despesasFechamentoAno = 0;

    todasHuntsDoMes.forEach(hunt => {
      // Ignora shinies das profissões/market pq usamos essa coluna pra guardar os Pontos!
      if (!hunt.pokemon.startsWith("[")) {
        somaShinies += Number(hunt.shinies_mortos) || 0;
      }
      
      // Adiciona lucro de todas vendas
      lucroBrutoMes += (Number(hunt.lucro_bruto_npc) || 0) + (Number(hunt.lucro_extra_market) || 0);
      
      // CUSTOS REAIS (IGNORA CONVERSÃO E CRAFT PRA NÃO DUPLICAR GASTO)
      if (!hunt.pokemon.startsWith("[Conversão]") && !hunt.pokemon.startsWith("[Craft]")) {
        despesasHuntsMes += Number(hunt.despesas_hunt) || 0;
      }
      totalMinutosMes += converterParaMinutos(hunt.tempo_caca);
    });
    
    despesasDoMes.forEach(d => { despesasFechamentoMes += (Number(d.valor) || 0); });

    huntsDoAno.forEach(hunt => {
      lucroBrutoAno += (Number(hunt.lucro_bruto_npc) || 0) + (Number(hunt.lucro_extra_market) || 0);
      if (!hunt.pokemon.startsWith("[Conversão]") && !hunt.pokemon.startsWith("[Craft]")) {
        despesasHuntsAno += Number(hunt.despesas_hunt) || 0;
      }
    });
    despesasDoAno.forEach(d => { despesasFechamentoAno += (Number(d.valor) || 0); });

    const despesasTotaisMes = despesasHuntsMes + despesasFechamentoMes;
    const lucroMes = lucroBrutoMes - despesasTotaisMes;
    const lucroAno = lucroBrutoAno - (despesasHuntsAno + despesasFechamentoAno);

    const horasFinais = Math.floor(totalMinutosMes / 60); const minutosFinais = totalMinutosMes % 60;
    let tempoTotalFormatado = "0m";
    if (horasFinais > 0 && minutosFinais > 0) tempoTotalFormatado = `${horasFinais}h ${minutosFinais}m`;
    else if (horasFinais > 0) tempoTotalFormatado = `${horasFinais}h`;
    else if (minutosFinais > 0) tempoTotalFormatado = `${minutosFinais}m`;

    const huntsAgrupadasPorDia = huntsNormais.reduce((grupos, hunt) => {
      const dataStr = formatarData(hunt.created_at);
      if (!grupos[dataStr]) grupos[dataStr] = []; grupos[dataStr].push(hunt); return grupos;
    }, {} as Record<string, HuntHistory[]>);

    const questsAgrupadasPorDia = questsDoMes.reduce((grupos, quest) => {
      const dataStr = formatarData(quest.created_at);
      if (!grupos[dataStr]) grupos[dataStr] = []; grupos[dataStr].push(quest); return grupos;
    }, {} as Record<string, HuntHistory[]>);

    return { huntsNormais, huntsAgrupadasPorDia, questsDoMes, questsAgrupadasPorDia, tempoTotalFormatado, totalShinies: somaShinies, lucroMes, despesasMes: despesasTotaisMes, lucroAno };
  }, [mesSelecionado, hunts, despesasGlobais]);

  const abrirModalDetalhes = async (hunt: HuntHistory) => {
    setHuntSelecionadaModal(hunt); setCarregandoDetalhes(true); setDetalhesLoot([]);
    const { data } = await supabase.from('hunt_loot').select(`quantidade_total, itens_globais (nome, icone)`).eq('hunt_id', hunt.id);
    if (data) setDetalhesLoot(data.map((linha: any) => ({ nome: linha.itens_globais.nome, quantidade: linha.quantidade_total, icone: linha.itens_globais.icone })));
    setCarregandoDetalhes(false);
  };

  const fecharModalDetalhes = () => { setHuntSelecionadaModal(null); setDetalhesLoot([]); };
  const renderizarIcone = (icone: string) => {
    if (!icone) return <span>📦</span>;
    if (icone.includes('.')) return <img src={`/itens/${icone}`} alt="icone" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    return <span>{icone}</span>;
  };

  if (carregando) return <main className={styles.container}><h2 style={{textAlign: 'center', marginTop: '50px', color: '#9AA0A6'}}>Carregando Dados...</h2></main>;
  const modalIsQuest = huntSelecionadaModal?.pokemon.startsWith("[Quest]");

  return (
    <main className={styles.container}>
      <div className={styles.headerDashboard}>
        <h1 className={styles.title}>PxG Tracker</h1>
        <div className={styles.monthFilter}>
          <input type="month" className={styles.monthInput} value={mesSelecionado} onChange={(e) => setMesSelecionado(e.target.value)} />
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Tempo Total</span>
          <span className={styles.statValue}>{dashboardData.tempoTotalFormatado}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Lucro Mensal</span>
          <span className={`${styles.statValue} ${dashboardData.lucroMes >= 0 ? styles.textProfit : styles.textLoss}`}>{formatarDinheiro(dashboardData.lucroMes)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Shinies ✨</span>
          <span className={styles.statValue}>{dashboardData.totalShinies.toLocaleString('pt-BR')}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Gastos / Waste</span>
          <span className={`${styles.statValue} ${styles.textLoss}`}>{formatarDinheiro(dashboardData.despesasMes)}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statTitle}>Lucro Anual</span>
          <span className={`${styles.statValue} ${dashboardData.lucroAno >= 0 ? styles.textProfit : styles.textLoss}`}>{formatarDinheiro(dashboardData.lucroAno)}</span>
        </div>
      </div>

      <div className={styles.historySection}>
        <h2 className={styles.sectionTitle}>Histórico de Hunts do Mês</h2>
        {dashboardData.huntsNormais.length === 0 ? (
          <div style={{textAlign: 'center', padding: '30px', color: '#9AA0A6'}}>Nenhuma hunt registrada neste mês.</div>
        ) : (
          <div style={{overflowX: 'auto'}}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Pokémon</th>
                  <th className={styles.centerColumn}>Abates</th>
                  <th className={styles.centerColumn}>Shinies</th>
                  <th className={styles.centerColumn}>Líquido</th>
                  <th className={styles.centerColumn}>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(dashboardData.huntsAgrupadasPorDia).map(([dataStr, huntsDoDia]) => {
                  const lucroTotalDoDia = huntsDoDia.reduce((total, hunt) => total + (Number(hunt.lucro_bruto_npc) || 0) + (Number(hunt.lucro_extra_market) || 0) - (Number(hunt.despesas_hunt) || 0), 0);
                  return (
                    <React.Fragment key={dataStr}>
                      {huntsDoDia.map((hunt) => {
                        const huntKey = Object.keys(dicionarioHunts).find(key => dicionarioHunts[key].nome === hunt.pokemon);
                        const huntInfo = huntKey ? dicionarioHunts[huntKey] : null;
                        const iconePokemon = huntInfo?.icone || "item_desconhecido.png";
                        const lucroLiquido = (Number(hunt.lucro_bruto_npc) || 0) + (Number(hunt.lucro_extra_market) || 0) - (Number(hunt.despesas_hunt) || 0);
                        
                        return (
                          <tr key={hunt.id} className={styles.clickableRow} onClick={() => abrirModalDetalhes(hunt)}>
                            <td style={{color: '#9AA0A6'}}>{dataStr}</td>
                            <td>
                              <div className={styles.pokemonCell}>
                                <div className={styles.pokemonSprite}>{renderizarIcone(iconePokemon)}</div>
                                <div className={styles.pokemonName}>{hunt.pokemon}</div>
                              </div>
                            </td>
                            <td className={styles.centerColumn}>{hunt.pokemons_mortos.toLocaleString('pt-BR')}</td>
                            <td className={styles.centerColumn}>
                              <div className={styles.shinyCell}>
                                {hunt.shinies_mortos > 0 && huntInfo?.shinyIcon ? (
                                  <div style={{ width: '28px', height: '28px', display: 'flex', justifyContent: 'center' }}>{renderizarIcone(huntInfo.shinyIcon)}</div>
                                ) : hunt.shinies_mortos > 0 ? (
                                  <span style={{color: '#F28B82'}}>✨</span>
                                ) : <span style={{color: '#3C4043'}}>-</span>}
                                {hunt.shinies_mortos > 0 && <span className={styles.shinyCount}>{hunt.shinies_mortos}</span>}
                              </div>
                            </td>
                            <td className={`${styles.centerColumn} ${lucroLiquido < 0 ? styles.textLoss : styles.textProfit}`} style={{fontWeight: '500'}}>{formatarDinheiro(lucroLiquido)}</td>
                            <td className={styles.centerColumn} style={{color: '#9AA0A6'}}>{formatarTempo(hunt.tempo_caca)}</td>
                          </tr>
                        );
                      })}
                      <tr className={styles.totalDiaRow}>
                        <td colSpan={4} style={{ textAlign: 'right', fontSize: '12px', color: '#9AA0A6' }}>Total do dia:</td>
                        <td className={`${styles.centerColumn} ${styles.totalDiaValue} ${lucroTotalDoDia < 0 ? styles.textLoss : styles.textProfit}`}>{formatarDinheiro(lucroTotalDoDia)}</td>
                        <td></td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className={styles.historySection} style={{ marginTop: '30px' }}>
        <h2 className={styles.sectionTitle} style={{ color: '#d6bcfa' }}>Tarefas e Quests do Mês</h2>
        {dashboardData.questsDoMes.length === 0 ? (
          <div style={{textAlign: 'center', padding: '30px', color: '#9AA0A6'}}>Nenhuma quest registrada neste mês.</div>
        ) : (
          <div style={{overflowX: 'auto'}}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Atividade</th>
                  <th className={styles.centerColumn}>Tentativas</th>
                  <th className={styles.centerColumn}>Despesas (Custo)</th>
                  <th className={styles.centerColumn}>Líquido Final</th>
                  <th className={styles.centerColumn}>Tempo</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(dashboardData.questsAgrupadasPorDia).map(([dataStr, questsDoDia]) => {
                  return (
                    <React.Fragment key={`quest-${dataStr}`}>
                      {questsDoDia.map((quest) => {
                        const lucroLiquido = (Number(quest.lucro_bruto_npc) || 0) + (Number(quest.lucro_extra_market) || 0) - (Number(quest.despesas_hunt) || 0);
                        const nomeQuest = quest.pokemon.replace('[Quest] ', '');
                        return (
                          <tr key={quest.id} className={styles.clickableRow} onClick={() => abrirModalDetalhes(quest)}>
                            <td style={{color: '#9AA0A6'}}>{dataStr}</td>
                            <td>
                              <div className={styles.pokemonCell}>
                                <div className={styles.pokemonSprite}>{renderizarIcone("quest_icon.png")}</div>
                                <div className={styles.pokemonName} style={{color: '#d6bcfa'}}>{nomeQuest}</div>
                              </div>
                            </td>
                            <td className={styles.centerColumn}>{quest.pokemons_mortos.toLocaleString('pt-BR')}</td>
                            <td className={`${styles.centerColumn} ${styles.textLoss}`}>- {formatarDinheiro(quest.despesas_hunt)}</td>
                            <td className={`${styles.centerColumn} ${lucroLiquido < 0 ? styles.textLoss : styles.textProfit}`} style={{fontWeight: '500'}}>{formatarDinheiro(lucroLiquido)}</td>
                            <td className={styles.centerColumn} style={{color: '#9AA0A6'}}>{formatarTempo(quest.tempo_caca)}</td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {huntSelecionadaModal && (
        <div className={styles.modalOverlay} onClick={fecharModalDetalhes}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={fecharModalDetalhes}>✕</button>
            <div className={styles.modalHeader}>
              <h2 style={{color: modalIsQuest ? '#d6bcfa' : '#E8EAED'}}>
                {modalIsQuest ? huntSelecionadaModal.pokemon.replace('[Quest] ', 'Quest: ') : huntSelecionadaModal.pokemon}
              </h2>
              <div className={styles.modalSubHeader}>
                Data: {formatarData(huntSelecionadaModal.created_at)} &nbsp;•&nbsp; Tempo: {formatarTempo(huntSelecionadaModal.tempo_caca)} &nbsp;•&nbsp;
                {modalIsQuest ? `Tentativas: ${huntSelecionadaModal.pokemons_mortos}` : `Mortes: ${huntSelecionadaModal.pokemons_mortos}`}
              </div>
            </div>
            {carregandoDetalhes ? (
              <p style={{textAlign: 'center', color: '#9AA0A6', padding: '20px'}}>Buscando...</p>
            ) : detalhesLoot.length === 0 ? (
              <p style={{textAlign: 'center', color: '#F28B82', padding: '20px'}}>Nada registrado.</p>
            ) : (
              <div className={styles.detalhesGrid}>
                {detalhesLoot.map((item, index) => (
                  <div key={index} className={styles.detalheItem}>
                    <div className={styles.detalheIcone}>{renderizarIcone(item.icone)}</div>
                    <span className={styles.detalheNome}>{item.nome}</span>
                    <span className={styles.detalheQtd}>{item.quantidade.toLocaleString('pt-BR')}</span>
                  </div>
                ))}
              </div>
            )}
            <div className={styles.modalResumoFinanceiro}>
              <div className={styles.resumoLinha}><span>Lucro no NPC:</span><span>{formatarDinheiro(huntSelecionadaModal.lucro_bruto_npc || 0)}</span></div>
              <div className={styles.resumoLinha} style={{color: '#8AB4F8'}}><span>Extra Market:</span><span>+ {formatarDinheiro(huntSelecionadaModal.lucro_extra_market || 0)}</span></div>
              <div className={styles.resumoLinha} style={{color: '#F28B82'}}><span>{modalIsQuest ? 'Custo:' : 'Waste:'}</span><span>- {formatarDinheiro(huntSelecionadaModal.despesas_hunt || 0)}</span></div>
              <div className={styles.resumoLinha}>
                <span>LÍQUIDO:</span>
                <span className={((Number(huntSelecionadaModal.lucro_bruto_npc) || 0) + (Number(huntSelecionadaModal.lucro_extra_market) || 0) - (Number(huntSelecionadaModal.despesas_hunt) || 0)) < 0 ? styles.textLoss : styles.textProfit}>
                  {formatarDinheiro((Number(huntSelecionadaModal.lucro_bruto_npc) || 0) + (Number(huntSelecionadaModal.lucro_extra_market) || 0) - (Number(huntSelecionadaModal.despesas_hunt) || 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}