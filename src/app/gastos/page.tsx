"use client";

import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";

// Vamos usar estilos inline simples e reaproveitar algumas lógicas para agilizar
type SuplementoEstoque = {
  id_inventario: number;
  item_id: number;
  nome: string;
  quantidade_atual: number;
  valor_npc: number;
  icone: string;
};

type GastoExtra = { id: number; descricao: string; valor: string };

export default function Gastos() {
  const [suplementos, setSuplementos] = useState<SuplementoEstoque[]>([]);
  const [quantidadesNovas, setQuantidadesNovas] = useState<Record<number, string>>({});
  const [gastosExtras, setGastosExtras] = useState<GastoExtra[]>([]);
  const [carregando, setCarregando] = useState(true);

  const carregarEstoque = async () => {
    setCarregando(true);
    const { data } = await supabase.from('inventario').select(`id, quantidade, item_id, itens_globais (nome, valor_npc, categoria, icone)`);
    
    if (data) {
      // Filtra apenas o que não for loot (ou seja, suplementos que você tem na mochila)
      const sups = data
        .filter((linha: any) => linha.itens_globais.categoria !== 'loot')
        .map((linha: any) => ({
          id_inventario: linha.id,
          item_id: linha.item_id,
          nome: linha.itens_globais.nome,
          quantidade_atual: linha.quantidade,
          valor_npc: linha.itens_globais.valor_npc,
          icone: linha.itens_globais.icone
        }));
      
      setSuplementos(sups);
      
      // Preenche os inputs com a quantidade atual
      const inputsIniciais: Record<number, string> = {};
      sups.forEach(s => inputsIniciais[s.item_id] = String(s.quantidade_atual));
      setQuantidadesNovas(inputsIniciais);
    }
    setCarregando(false);
  };

  useEffect(() => {
    carregarEstoque();
  }, []);

  const formatarDinheiro = (valor: number) => {
    if (valor === 0) return "0";
    const abs = Math.abs(valor);
    if (abs >= 1000000) return (abs / 1000000).toFixed(1).replace('.0', '') + 'kk';
    if (abs >= 1000) return (abs / 1000).toFixed(1).replace('.0', '') + 'k';
    return abs.toString();
  };

  const renderizarIcone = (icone: string) => {
    if (!icone) return <span>📦</span>;
    if (icone.includes('.')) return <img src={`/itens/${icone}`} alt="icone" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />;
    return <span>{icone}</span>;
  };

  const adicionarGastoExtra = () => setGastosExtras([...gastosExtras, { id: Date.now(), descricao: "", valor: "" }]);
  const removerGastoExtra = (id: number) => setGastosExtras(gastosExtras.filter(g => g.id !== id));
  const atualizarGastoExtra = (id: number, campo: keyof GastoExtra, valor: string) => {
    setGastosExtras(gastosExtras.map(g => g.id === id ? { ...g, [campo]: valor } : g));
  };

  const confirmarFechamento = async () => {
    let custoSuplementos = 0;
    const atualizacoesInventario = [];

    // 1. Calcula os Suplementos Gastos
    for (const sup of suplementos) {
      const qtdAtual = sup.quantidade_atual;
      const qtdNova = Number(quantidadesNovas[sup.item_id]) || 0;

      if (qtdNova < 0 || qtdNova > qtdAtual) {
        alert(`Erro em ${sup.nome}: A quantidade nova (${qtdNova}) não pode ser maior que o seu estoque atual (${qtdAtual}) e nem negativa!`);
        return;
      }

      if (qtdNova < qtdAtual) {
        const consumido = qtdAtual - qtdNova;
        custoSuplementos += (consumido * sup.valor_npc);
        
        atualizacoesInventario.push({
          id_inventario: sup.id_inventario,
          nova_quantidade: qtdNova
        });
      }
    }

    // 2. Calcula Gastos Extras (Barco, Morte, etc)
    let custoExtras = 0;
    const insertsDespesas = [];

    for (const extra of gastosExtras) {
      const valor = Number(extra.valor) || 0;
      if (valor > 0 && extra.descricao.trim() !== "") {
        custoExtras += valor;
        insertsDespesas.push({ descricao: extra.descricao, valor: valor });
      }
    }

    const custoTotal = custoSuplementos + custoExtras;

    if (custoTotal === 0) {
      alert("Nenhum gasto foi registrado.");
      return;
    }

    // 3. Salva no Banco de Dados
    setCarregando(true);

    // Salva o resumo dos suplementos se houve consumo
    if (custoSuplementos > 0) {
      insertsDespesas.push({ descricao: "Consumo de Suplementos (Fechamento)", valor: custoSuplementos });
    }

    // Insere todas as despesas na tabela global
    if (insertsDespesas.length > 0) {
      await supabase.from('despesas_globais').insert(insertsDespesas);
    }

    // Desconta os itens do inventário real
    for (const atu of atualizacoesInventario) {
      if (atu.nova_quantidade === 0) {
        await supabase.from('inventario').delete().eq('id', atu.id_inventario);
      } else {
        await supabase.from('inventario').update({ quantidade: atu.nova_quantidade }).eq('id', atu.id_inventario);
      }
    }

    alert(`Fechamento concluído! Despesa total de $ ${formatarDinheiro(custoTotal)} registrada com sucesso.`);
    setGastosExtras([]);
    carregarEstoque(); // Recarrega os valores atualizados
  };

  if (carregando) return <main style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}><h2 style={{textAlign: 'center', marginTop: '50px'}}>Calculando Caixa...</h2></main>;

  return (
    <main style={{ padding: '40px', maxWidth: '800px', margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '28px', color: '#2d3748', marginBottom: '30px', borderBottom: '2px solid #e2e8f0', paddingBottom: '10px' }}>
        💸 Fechamento de Gastos
      </h1>

      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '18px', color: '#4a5568', marginBottom: '20px' }}>1. Consumo de Suplementos</h2>
        <p style={{ fontSize: '14px', color: '#718096', marginBottom: '20px' }}>Insira a quantidade com que você terminou o dia. O sistema calculará o que foi gasto.</p>
        
        {suplementos.length === 0 ? (
          <p style={{ color: '#e53e3e', fontSize: '14px' }}>Você não tem nenhum suplemento no seu Inventário no momento.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '15px' }}>
            {suplementos.map(sup => (
              <div key={sup.item_id} style={{ border: '1px solid #e2e8f0', padding: '15px', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ marginBottom: '10px' }}>{renderizarIcone(sup.icone)}</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '5px', textAlign: 'center' }}>{sup.nome}</div>
                <div style={{ fontSize: '12px', color: '#718096', marginBottom: '10px' }}>Estoque Atual: {sup.quantidade_atual}</div>
                
                <input 
                  type="number" 
                  min="0" max={sup.quantidade_atual}
                  style={{ width: '100%', padding: '8px', textAlign: 'center', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                  value={quantidadesNovas[sup.item_id]} 
                  onChange={(e) => setQuantidadesNovas({ ...quantidadesNovas, [sup.item_id]: e.target.value })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ backgroundColor: 'white', padding: '25px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '18px', color: '#4a5568', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          2. Despesas Avulsas (Mortes, Barco, etc)
          <button onClick={adicionarGastoExtra} style={{ padding: '6px 12px', backgroundColor: '#edf2f7', border: 'none', borderRadius: '4px', color: '#2b6cb0', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}>
            + Adicionar
          </button>
        </h2>
        
        {gastosExtras.length === 0 ? (
          <p style={{ fontSize: '14px', color: '#a0aec0' }}>Nenhuma despesa extra adicionada.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {gastosExtras.map((gasto, index) => (
              <div key={gasto.id} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input 
                  type="text" 
                  placeholder="Ex: Morte, Passagem de Barco..." 
                  style={{ flex: 2, padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                  value={gasto.descricao} onChange={(e) => atualizarGastoExtra(gasto.id, 'descricao', e.target.value)}
                />
                <input 
                  type="number" 
                  placeholder="Valor ($)" 
                  style={{ flex: 1, padding: '10px', borderRadius: '4px', border: '1px solid #cbd5e0' }}
                  value={gasto.valor} onChange={(e) => atualizarGastoExtra(gasto.id, 'valor', e.target.value)}
                />
                <button onClick={() => removerGastoExtra(gasto.id)} style={{ padding: '10px', backgroundColor: '#fed7d7', color: '#c53030', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>X</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={confirmarFechamento} style={{ width: '100%', padding: '15px', backgroundColor: '#e53e3e', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(229, 62, 62, 0.2)' }}>
        Registrar Fechamento de Caixa
      </button>

    </main>
  );
}