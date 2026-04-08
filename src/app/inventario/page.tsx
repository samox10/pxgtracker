"use client";

import { useState, useEffect } from "react";
import styles from "./page.module.css";
import { supabase } from "../../lib/supabase";

type ItemInventario = {
  id: number;
  item_id: number;
  nome: string;
  quantidade: number;
  valorNpc: number;
  categoria: string;
  icone: string;
};

type ItemCatalogo = {
  id: number;
  nome: string;
  valor_npc: number;
  categoria: string;
  icone: string;
};

export default function Inventario() {
  const [abaAtiva, setAbaAtiva] = useState<"loot" | "suplementos">("loot");
  
  const [meuLoot, setMeuLoot] = useState<ItemInventario[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados de Venda (Loot)
  const [itemParaVender, setItemParaVender] = useState<ItemInventario | null>(null);
  const [quantidadeVenda, setQuantidadeVenda] = useState("");
  const [tipoVenda, setTipoVenda] = useState<"npc" | "player">("npc");
  const [valorPlayerUnidade, setValorPlayerUnidade] = useState("");
  const [cobrarTaxa, setCobrarTaxa] = useState(true); 
  const [modoVendaMassa, setModoVendaMassa] = useState(false);
  const [itensSelecionados, setItensSelecionados] = useState<number[]>([]);

  // Estados de Suplementos (O Novo Sistema de Estoque)
  const [catalogoSuplementos, setCatalogoSuplementos] = useState<ItemCatalogo[]>([]);
  const [estoqueAtual, setEstoqueAtual] = useState<Record<number, { id_inventario: number, quantidade: number }>>({});
  const [modoEdicaoEstoque, setModoEdicaoEstoque] = useState(false);
  const [valoresEditados, setValoresEditados] = useState<Record<number, string>>({});

  const buscarInventarioE_Catalogo = async () => {
    setCarregando(true);
    
    // 1. Busca todo o Inventário
    const { data: invData } = await supabase.from('inventario').select(`id, quantidade, item_id, itens_globais (nome, valor_npc, categoria, icone)`);

    let mapEstoque: Record<number, { id_inventario: number, quantidade: number }> = {};
    
    if (invData) {
      // CORREÇÃO: Adicionado o '?' para evitar o crash com itens deletados no banco global
      const inventarioFormatado = invData.map((linha: any) => ({
        id: linha.id,
        item_id: linha.item_id,
        nome: linha.itens_globais?.nome || "Item Deletado",
        quantidade: linha.quantidade,
        valorNpc: linha.itens_globais?.valor_npc || 0, 
        categoria: linha.itens_globais?.categoria || "loot",
        icone: linha.itens_globais?.icone || ""
      }));

      setMeuLoot(inventarioFormatado.filter(i => i.categoria === 'loot'));
      
      // Mapeia o estoque dos suplementos
      inventarioFormatado.filter(i => i.categoria !== 'loot').forEach(item => {
        mapEstoque[item.item_id] = { id_inventario: item.id, quantidade: item.quantidade };
      });
    }
    setEstoqueAtual(mapEstoque);

    // 2. Busca o Catálogo de todos os Suplementos possíveis
    const { data: catData } = await supabase.from('itens_globais').select('id, nome, valor_npc, categoria, icone').neq('categoria', 'loot').order('nome');
    if (catData) setCatalogoSuplementos(catData);

    setCarregando(false);
  };

  useEffect(() => {
    buscarInventarioE_Catalogo();
  }, []);

  const formatarDinheiro = (valor: number) => {
    if (valor === 0) return "0";
    const abs = Math.abs(valor);
    let formatado = "";
    if (abs >= 1000000) formatado = (abs / 1000000).toFixed(1).replace('.0', '') + 'kk';
    else if (abs >= 1000) formatado = (abs / 1000).toFixed(1).replace('.0', '') + 'k';
    else formatado = abs.toString();
    return valor < 0 ? `- ${formatado}` : formatado;
  };

  const valorTotalNpc = meuLoot.reduce((total, item) => total + (item.quantidade * (item.valorNpc || 0)), 0);

  const renderizarIcone = (icone: string) => {
    if (!icone) return <span>📦</span>;
    if (icone.includes('.')) return <img src={`/itens/${icone}`} alt="icone" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />;
    return <span>{icone}</span>;
  };

  // --- FUNÇÕES DE VENDA (Loot) ---
  const handleClickItem = (item: ItemInventario) => {
    if (modoVendaMassa) {
      if (itensSelecionados.includes(item.id)) setItensSelecionados(itensSelecionados.filter(id => id !== item.id));
      else setItensSelecionados([...itensSelecionados, item.id]);
    } else {
      setItemParaVender(item);
    }
  };

  const fecharModalVenda = () => {
    setItemParaVender(null); setQuantidadeVenda(""); setTipoVenda("npc"); setValorPlayerUnidade(""); setCobrarTaxa(true);
  };

  const confirmarVendaIndividual = async (e: React.FormEvent) => {
    e.preventDefault();
    const qtd = Number(quantidadeVenda) || 0;
    if (!itemParaVender || qtd <= 0 || qtd > itemParaVender.quantidade) return;
    
    setCarregando(true);

    let lucroExtraPorUnidade = 0;
    if (tipoVenda === "player") {
      const precoBrutoPorUnidade = Number(valorPlayerUnidade) || 0;
      const precoLiquidoPorUnidade = cobrarTaxa ? precoBrutoPorUnidade * 0.90 : precoBrutoPorUnidade; 
      lucroExtraPorUnidade = precoLiquidoPorUnidade - Number(itemParaVender.valorNpc);
    }
    
    const novaQtdMochila = Number(itemParaVender.quantidade) - qtd;
    if (novaQtdMochila > 0) {
      await supabase.from('inventario').update({ quantidade: novaQtdMochila }).eq('id', itemParaVender.id);
    } else {
      await supabase.from('inventario').delete().eq('id', itemParaVender.id);
    }
    
    let qtdRestanteParaAbater = qtd;
    const { data: recibos } = await supabase.from('hunt_loot').select('*').eq('item_id', itemParaVender.item_id).order('created_at', { ascending: true });
    
    const recibosAtualizados = [];
    const huntsParaAtualizarLucro: Record<number, number> = {}; 
    
    if (recibos) {
      for (const recibo of recibos) {
        if (qtdRestanteParaAbater <= 0) break;
        const disp = (Number(recibo.quantidade_total) || 0) - (Number(recibo.quantidade_vendida) || 0);
        
        if (disp > 0) {
          const abatendoAgora = Math.min(disp, qtdRestanteParaAbater);
          
          recibosAtualizados.push({
            ...recibo,
            quantidade_vendida: (Number(recibo.quantidade_vendida) || 0) + abatendoAgora
          });
          
          if (lucroExtraPorUnidade !== 0) {
            const extra = abatendoAgora * lucroExtraPorUnidade;
            huntsParaAtualizarLucro[recibo.hunt_id] = (huntsParaAtualizarLucro[recibo.hunt_id] || 0) + extra;
          }
          qtdRestanteParaAbater -= abatendoAgora;
        }
      }
    }

    if (recibosAtualizados.length > 0) {
      await supabase.from('hunt_loot').upsert(recibosAtualizados);
    }

    // AQUI ESTAVA O BUG DO DASHBOARD (agora usando select('*'))
    const huntIds = Object.keys(huntsParaAtualizarLucro).map(Number);
    if (huntIds.length > 0) {
      const { data: huntsAtuais } = await supabase.from('historico_hunts').select('*').in('id', huntIds);
      if (huntsAtuais) {
        const huntsAtualizadas = huntsAtuais.map(h => ({
          ...h,
          lucro_extra_market: (Number(h.lucro_extra_market) || 0) + huntsParaAtualizarLucro[h.id]
        }));
        await supabase.from('historico_hunts').upsert(huntsAtualizadas);
      }
    }

    alert(`Venda registada com sucesso!`);
    fecharModalVenda();
    buscarInventarioE_Catalogo(); 
  };

  const cancelarVendaMassa = () => { setModoVendaMassa(false); setItensSelecionados([]); };
  const valorTotalSelecionados = meuLoot.filter(item => itensSelecionados.includes(item.id)).reduce((total, item) => total + (item.quantidade * (item.valorNpc || 0)), 0);
  
  const confirmarVendaMassa = async () => {
    setCarregando(true);

    const itensParaVender = meuLoot.filter(i => itensSelecionados.includes(i.id));
    if (itensParaVender.length === 0) return;

    const idsInventarioParaDeletar = itensParaVender.map(i => i.id);
    const idsItensGlobais = itensParaVender.map(i => i.item_id);

    await supabase.from('inventario').delete().in('id', idsInventarioParaDeletar);

    const { data: recibos } = await supabase
      .from('hunt_loot')
      .select('*')
      .in('item_id', idsItensGlobais)
      .order('created_at', { ascending: true });

    const recibosAtualizados = [];
    
    for (const item of itensParaVender) {
      let qtdRestante = Number(item.quantidade);
      const recibosDoItem = recibos?.filter(r => r.item_id === item.item_id) || [];

      for (const recibo of recibosDoItem) {
        if (qtdRestante <= 0) break;
        
        const disp = Number(recibo.quantidade_total) - Number(recibo.quantidade_vendida);
        if (disp > 0) {
          const abatendo = Math.min(disp, qtdRestante);
          recibosAtualizados.push({
            ...recibo,
            quantidade_vendida: Number(recibo.quantidade_vendida) + abatendo
          });
          qtdRestante -= abatendo;
        }
      }
    }

    if (recibosAtualizados.length > 0) {
      await supabase.from('hunt_loot').upsert(recibosAtualizados);
    }

    alert(`Venda em massa concluída!`);
    cancelarVendaMassa();
    buscarInventarioE_Catalogo();
  };

  // --- O CÉREBRO DA ATUALIZAÇÃO DE SUPLEMENTOS ---
  const iniciarEdicaoEstoque = () => {
    const valoresIniciais: Record<number, string> = {};
    catalogoSuplementos.forEach(item => {
      valoresIniciais[item.id] = estoqueAtual[item.id] ? String(estoqueAtual[item.id].quantidade) : "0";
    });
    setValoresEditados(valoresIniciais);
    setModoEdicaoEstoque(true);
  };

  const cancelarEdicaoEstoque = () => {
    setModoEdicaoEstoque(false); setValoresEditados({});
  };

  const salvarEstoqueGlobal = async () => {
    setCarregando(true);

    for (const item of catalogoSuplementos) {
      const qtdAntiga = estoqueAtual[item.id] ? estoqueAtual[item.id].quantidade : 0;
      const qtdNovaStr = valoresEditados[item.id];
      const qtdNova = Number(qtdNovaStr) || 0;

      if (qtdNova !== qtdAntiga) {
        if (qtdNova === 0 && estoqueAtual[item.id]) {
          await supabase.from('inventario').delete().eq('id', estoqueAtual[item.id].id_inventario);
        } else if (qtdNova > 0 && estoqueAtual[item.id]) {
          await supabase.from('inventario').update({ quantidade: qtdNova }).eq('id', estoqueAtual[item.id].id_inventario);
        } else if (qtdNova > 0 && !estoqueAtual[item.id]) {
          await supabase.from('inventario').insert({ item_id: item.id, quantidade: qtdNova });
        }
      }
    }

    alert(`Estoque sincronizado com sucesso!`);
    setModoEdicaoEstoque(false);
    buscarInventarioE_Catalogo();
  };

  const suplementosAgrupados = catalogoSuplementos.reduce((grupos, item) => {
    const cat = (item.categoria || "outros").toUpperCase();
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat].push(item);
    return grupos;
  }, {} as Record<string, ItemCatalogo[]>);

  if (carregando) return <main className={styles.container}><h2 style={{textAlign: 'center', marginTop: '50px'}}>Carregando Inventário...</h2></main>;

  return (
    <main className={styles.container}>
      <h1 className={styles.title}>Meu Inventário</h1>

      <div className={styles.tabs}>
        <button className={`${styles.tabButton} ${abaAtiva === "loot" ? styles.activeTab : ""}`} onClick={() => setAbaAtiva("loot")}>Loot Farmado</button>
        <button className={`${styles.tabButton} ${abaAtiva === "suplementos" ? styles.activeTab : ""}`} onClick={() => setAbaAtiva("suplementos")}>Meus Suplementos</button>
      </div>

      {abaAtiva === "loot" && (
        <>
          <div className={styles.headerLoot}>
            <div className={styles.totalWealth} style={{marginBottom: 0}}>Estimativa no NPC: $ {formatarDinheiro(valorTotalNpc)}</div>
            {!modoVendaMassa && <button className={styles.btnVendaMassa} onClick={() => setModoVendaMassa(true)}>📦 Venda em Massa (NPC)</button>}
          </div>
          <div className={styles.itemGrid}>
            {meuLoot.length === 0 ? <p>Nenhum loot no inventário.</p> : meuLoot.map((item) => {
              const isSelecionado = itensSelecionados.includes(item.id);
              return (
                <div key={item.id} className={`${styles.itemCard} ${styles.itemCardLoot} ${isSelecionado ? styles.itemCardSelected : ''}`} onClick={() => handleClickItem(item)}>
                  {isSelecionado && <div className={styles.checkMark}>✓</div>}
                  <div className={styles.itemImage}>{renderizarIcone(item.icone)}</div>
                  <div className={styles.itemName}>{item.nome}</div>
                  <div className={styles.itemQuantity}>{item.quantidade.toLocaleString('pt-BR')} un.</div>
                  <div className={styles.itemValue}>NPC: $ {formatarDinheiro(item.valorNpc || 0)}</div>
                </div>
              );
            })}
          </div>
          {modoVendaMassa && (
            <div className={styles.floatingActionBar}>
              <div className={styles.floatingText}>{itensSelecionados.length} selecionados</div>
              <div className={styles.floatingValue}>+ $ {formatarDinheiro(valorTotalSelecionados)}</div>
              <button className={styles.btnConfirmMass} onClick={confirmarVendaMassa} disabled={itensSelecionados.length === 0}>Confirmar Venda</button>
              <button className={styles.btnCancelMass} onClick={cancelarVendaMassa}>Cancelar</button>
            </div>
          )}
        </>
      )}

      {abaAtiva === "suplementos" && (
        <div style={{ marginTop: '20px' }}>
          <div className={styles.headerLoot} style={{ justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '18px', color: '#2d3748' }}>
              {modoEdicaoEstoque ? "Sincronizando Estoque..." : "Estoque Geral de Suplementos"}
            </h2>
            {!modoEdicaoEstoque ? (
              <button className={styles.btnVendaMassa} style={{ backgroundColor: '#3182ce', borderColor: '#2b6cb0' }} onClick={iniciarEdicaoEstoque}>
                🔄 Atualizar Gastos
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className={styles.btnVendaMassa} style={{ backgroundColor: '#e53e3e', borderColor: '#c53030' }} onClick={cancelarEdicaoEstoque}>Cancelar</button>
                <button className={styles.btnVendaMassa} style={{ backgroundColor: '#38a169', borderColor: '#2f855a' }} onClick={salvarEstoqueGlobal}>💾 Salvar Estoque</button>
              </div>
            )}
          </div>

          {Object.keys(suplementosAgrupados).length === 0 ? (
            <p style={{ marginTop: '20px', color: '#718096' }}>Nenhum suplemento cadastrado no banco de dados.</p>
          ) : (
            Object.entries(suplementosAgrupados).map(([categoria, itens]) => (
              <div key={categoria} style={{ marginBottom: '30px' }}>
                <h3 style={{ backgroundColor: '#edf2f7', padding: '10px', borderRadius: '6px', color: '#4a5568', marginBottom: '15px' }}>
                  {categoria}
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '15px' }}>
                  {itens.map(item => {
                    const qtdNoBanco = estoqueAtual[item.id] ? estoqueAtual[item.id].quantidade : 0;
                    return (
                      <div key={item.id} className={styles.itemCard} style={{ cursor: 'default' }}>
                        <div className={styles.itemImage} style={{ marginBottom: '10px' }}>{renderizarIcone(item.icone)}</div>
                        <div className={styles.itemName} style={{ marginBottom: '10px' }}>{item.nome}</div>
                        
                        {modoEdicaoEstoque ? (
                          <input 
                            type="number" 
                            min="0"
                            style={{ width: '100%', padding: '8px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e0', fontSize: '16px' }}
                            value={valoresEditados[item.id]} 
                            onChange={(e) => setValoresEditados({ ...valoresEditados, [item.id]: e.target.value })}
                          />
                        ) : (
                          <div className={styles.itemQuantity} style={{ backgroundColor: qtdNoBanco > 0 ? '#ebf8ff' : '#f7fafc', color: qtdNoBanco > 0 ? '#3182ce' : '#a0aec0' }}>
                            {qtdNoBanco.toLocaleString('pt-BR')} un.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* MODAL DE VENDA DE LOOT MANTIDO */}
      {itemParaVender && (
        <div className={styles.modalOverlay} onClick={fecharModalVenda}>
          <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeButton} onClick={fecharModalVenda}>X</button>
            <h2 style={{marginBottom: '5px', display: 'flex', alignItems: 'center', gap: '10px'}}>{renderizarIcone(itemParaVender.icone)} Vender {itemParaVender.nome}</h2>
            <p style={{color: '#718096', marginBottom: '20px', fontSize: '14px'}}>Na Mochila: <strong>{itemParaVender.quantidade}</strong></p>
            <form onSubmit={confirmarVendaIndividual}>
              <div className={styles.inputGroup}>
                <label>Quantidade Vendida</label>
                <input type="number" className={styles.input} min="1" max={itemParaVender.quantidade} value={quantidadeVenda} onChange={(e) => setQuantidadeVenda(e.target.value)} required />
              </div>
              <div className={styles.inputGroup}>
                <label>Para quem você vendeu?</label>
                <div className={styles.radioGroup}>
                  <label className={styles.radioLabel}><input type="radio" className={styles.radioInput} checked={tipoVenda === "npc"} onChange={() => setTipoVenda("npc")} />NPC ($ {formatarDinheiro(itemParaVender.valorNpc)})</label>
                  <label className={styles.radioLabel}><input type="radio" className={styles.radioInput} checked={tipoVenda === "player"} onChange={() => setTipoVenda("player")} />Market / Player</label>
                </div>
              </div>
              {tipoVenda === "player" && (
                <>
                  <div className={styles.inputGroup}>
                    <label>Valor por UNIDADE ($)</label>
                    <input type="number" className={styles.input} min="1" value={valorPlayerUnidade} onChange={(e) => setValorPlayerUnidade(e.target.value)} required />
                  </div>
                  <div style={{ marginTop: '10px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input type="checkbox" id="taxaMarket" checked={cobrarTaxa} onChange={(e) => setCobrarTaxa(e.target.checked)} style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                    <label htmlFor="taxaMarket" style={{ fontSize: '14px', cursor: 'pointer', color: '#4a5568', fontWeight: 'bold' }}>Cobrar taxa do Market (10%)</label>
                  </div>
                </>
              )}
              {Number(quantidadeVenda) > 0 && (
                <div className={styles.reciboBox}>
                  <div className={styles.reciboLinha}><span>Valor Bruto:</span><span>$ {formatarDinheiro(Number(quantidadeVenda) * (tipoVenda === "npc" ? itemParaVender.valorNpc : Number(valorPlayerUnidade)))}</span></div>
                  {tipoVenda === "player" && cobrarTaxa && (
                    <div className={`${styles.reciboLinha} ${styles.reciboTaxa}`}><span>Imposto (10%):</span><span>- $ {formatarDinheiro((Number(quantidadeVenda) * Number(valorPlayerUnidade)) * 0.10)}</span></div>
                  )}
                  <div className={styles.reciboTotal}><span>Lucro Líquido:</span><span>$ {formatarDinheiro(tipoVenda === "npc" ? Number(quantidadeVenda) * itemParaVender.valorNpc : (Number(quantidadeVenda) * Number(valorPlayerUnidade)) * (cobrarTaxa ? 0.90 : 1))}</span></div>
                </div>
              )}
              <button type="submit" className={styles.btnSubmit}>Confirmar Venda</button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}