<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { fade, slide, fly, scale } from 'svelte/transition';

  // --- INTERFACES ---
  interface Produto {
    id: number;
    nome: string;
    unidade_medida: string;
    estoque_atual: number;
    estoque_minimo: number;
    compra_em_andamento?: {
      status: string;
      previsao_entrega: string;
      quantidade: number;
    };
  }

  interface ItemCarrinho extends Produto {
    quantidade_pedida: number;
    observacao_item: string;
  }

  // --- ESTADOS (RUNES SVELTE 5) ---
  let busca = $state("");
  let carregando = $state(true);
  let enviando = $state(false);
  
  let produtosBase = $state<Produto[]>([]);
  let comprasPendentes = $state<any[]>([]);
  let carrinho = $state<ItemCarrinho[]>([]);
  
  let dadosUsuario = $state({ nome: "", setor_id: null, setor_nome: "" });
  
  let agendamento = $state({
    data: new Date().toISOString().split('T')[0],
    hora: "",
    obsGeral: ""
  });
const opcoesHorarios = [
    { label: 'Manhã', icon: '☀️', horas: ['08:30', '10:00', '11:30'] },
    { label: 'Tarde', icon: '⛅', horas: [ '15:00', '17:00'] },
    { label: 'Noite (Entrega Programada)', icon: '🌙', horas: ['19:30',] }
  ];
  // --- LÓGICA DERIVADA ---
  let produtosFiltrados = $derived.by(() => {
    const termo = busca.toLowerCase();
    return produtosBase
      .filter(p => p.nome.toLowerCase().includes(termo))
      .map(p => ({
        ...p,
        compra_em_andamento: comprasPendentes.find(c => c.produto_id === p.id)
      }));
  });

  // --- FUNÇÕES ---
  onMount(async () => {
    await carregarDadosIniciais();
  });

  async function carregarDadosIniciais() {
    carregando = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('usuarios')
        .select('nome, setor_id, setores(nome)')
        .eq('id', user.id).single();
      
      const infoSetor = profile?.setores as any;
      dadosUsuario = {
        nome: profile?.nome || "",
        setor_id: profile?.setor_id,
        setor_nome: infoSetor?.nome || "Não definido"
      };

      const { data: compras } = await supabase
        .from('compras')
        .select('produto_id, status, previsao_entrega, quantidade')
        .in('status', ['PENDENTE', 'APROVADO']);
      comprasPendentes = compras || [];

      const { data: prodData } = await supabase
        .from('produtos')
        .select(`id, nome, unidade_medida, estoque_minimo, estoque_saldos!inner (saldo)`)
        .eq('ativo', true)
        .eq('estoque_saldos.unidade_id', 2)
        .filter('setores_ids', 'cs', `[${dadosUsuario.setor_id}]`)
        .order('nome');

      produtosBase = (prodData || []).map(p => ({
        id: p.id,
        nome: p.nome,
        unidade_medida: p.unidade_medida,
        estoque_minimo: p.estoque_minimo,
        estoque_atual: (p.estoque_saldos as any)[0]?.saldo || 0
      }));
    } catch (e: any) {
      console.error(e);
    } finally {
      carregando = false;
    }
  }

  function adicionarAoCarrinho(p: Produto) {
    const existente = carrinho.find(item => item.id === p.id);
    if (existente) {
      existente.quantidade_pedida += 1;
    } else {
      carrinho.push({ ...p, quantidade_pedida: 1, observacao_item: "" });
    }
    busca = "";
  }

  function formatarDataPrevisao(dataStr: string) {
    if (!dataStr) return "Data não informada";
    const data = new Date(dataStr);
    const hoje = new Date();
    hoje.setHours(0,0,0,0);
    
    const prefixo = data < hoje ? "Atraso no fornecedor. Era esperada em: " : "Previsão estimada de entrega pelo fornecedor: ";
    return prefixo + data.toLocaleDateString('pt-BR');
  }


  async function finalizarRequisicao() {
    if (carrinho.length === 0) return;
    
    enviando = true;
    try {
      // Prepara os dados exatamente como a tabela public.requisicoes espera
      const payload = carrinho.map(item => ({
        produto_id: item.id,
        setor_id: dadosUsuario.setor_id,
        // user_id não precisa enviar, pois o banco tem 'default auth.uid()'
        quantidade: item.quantidade_pedida,
        observacao: item.observacao_item,
        data_retirada: agendamento.data,
        horario_retirada: agendamento.hora, // Formato "HH:mm" que o Postgres aceita como time
        observacao_geral: agendamento.obsGeral,
        status: 'PENDENTE'
      }));

      const { error } = await supabase
        .from('requisicoes')
        .insert(payload);

      if (error) throw error;

      alert("✅ Requisição enviada com sucesso!");
      carrinho = []; // Limpa a lista
      agendamento.hora = ""; // Reseta o horário
      
    } catch (e: any) {
      console.error("Erro no Supabase:", e);
      alert("❌ Erro ao enviar: " + e.message);
    } finally {
      enviando = false;
    }
  }
</script>



<div class="page-container" in:fade>
  <header class="action-header">
    <div class="title-group">
      <h1>Nova Requisição</h1>
      <p>Selecione os materiais e agende a retirada</p>
    </div>
    <div class="header-status">
      <span class="status-badge">Setor: {dadosUsuario.setor_nome}</span>
    </div>
  </header>

  <div class="dashboard-grid">
    <section class="left-col">
      <div class="card search-section">
        <div class="search-input-wrapper">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            bind:value={busca} 
            placeholder="Pesquisar material (Ex: Caneta, Papel...)" 
          />
        </div>

        {#if busca.length > 0}
          <div class="results-container" transition:slide>
            {#each produtosFiltrados as p (p.id)}
              <div class="product-card" in:scale={{start: 0.95}}>
                <div class="p-info">
                  <span class="p-name">{p.nome}</span>
                  <div class="p-meta">
                    <span class="p-unit">{p.unidade_medida}</span>
                    <span class="stock-label" class:low={p.estoque_atual <= p.estoque_minimo}>
                      Estoque: {p.estoque_atual}
                    </span>
                  </div>
                </div>

                {#if p.compra_em_andamento}
                  <div class="purchase-alert">
                    <span class="dot"></span> ORDEM DE COMPRA GERADA : {formatarDataPrevisao(p.compra_em_andamento.previsao_entrega)}
                  </div>
                {/if}

                <button class="btn-add-quick" onclick={() => adicionarAoCarrinho(p)} disabled={p.estoque_atual <= 0}>
                  {p.estoque_atual <= 0 ? 'Esgotado' : 'Adicionar'}
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>

      <div class="card schedule-section">
        <div class="section-title">
          <span class="icon">📅</span>
          <h3>Agendamento</h3>
        </div>

        <div class="schedule-form">
          <div class="field">
            <label for="data">Data</label>
            <input type="date" id="data" bind:value={agendamento.data} />
          </div>

          <div class="field">
            <label>Horário</label>
            <div class="time-tabs">
              {#each opcoesHorarios as turno}
                <div class="turno-row">
                  <span class="turno-icon">{turno.icon}</span>
                  <div class="chips-container">
                    {#each turno.horas as hora}
                      <button 
                        class="time-chip" 
                        class:selected={agendamento.hora === hora}
                        onclick={() => agendamento.hora = hora}>{hora}</button>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
          
          <div class="field">
            <textarea bind:value={agendamento.obsGeral} placeholder="Observações para separação..."></textarea>
          </div>
        </div>
      </div>
    </section>

    <section class="right-col">
      <div class="card cart-card">
        <div class="cart-header">
          <h2>Itens da Requisição</h2>
          <span class="count-badge">{carrinho.length} itens</span>
        </div>

        <div class="cart-items">
          {#each carrinho as item, i (item.id)}
            <div class="cart-row" in:fly={{ x: 30 }}>
              <div class="item-main">
                <span class="item-name">{item.nome}</span>
                {#if item.estoque_atual <= 0}
                  <span class="stock-warning">Aguardando Reposição</span>
                {/if}
              </div>

              <div class="item-controls">
                <div class="stepper">
                  <button onclick={() => item.quantidade_pedida > 1 && item.quantidade_pedida--}>-</button>
                  <input type="number" bind:value={item.quantidade_pedida} />
                  <button onclick={() => item.quantidade_pedida++}>+</button>
                </div>
                <input type="text" class="item-note" placeholder="Nota..." bind:value={item.observacao_item} />
                <button class="btn-remove" onclick={() => carrinho.splice(i, 1)}>✕</button>
              </div>
            </div>
          {:else}
            <div class="empty-state">
              <span class="icon">🛒</span>
              <p>Sua lista está vazia</p>
              <small>Pesquise ao lado para adicionar materiais</small>
            </div>
          {/each}
        </div>

        <div class="cart-footer">
          {#if agendamento.hora && (agendamento.hora >= '19:00' || agendamento.hora <= '07:00')}
             <div class="night-note">🌙 Turno Noite: Entrega programada no setor.</div>
          {/if}
          
          <button 
            class="btn-submit" 
            disabled={!agendamento.hora || carrinho.length === 0 || enviando}
            onclick={finalizarRequisicao}
          >
            {enviando ? 'PROCESSANDO...' : 'FINALIZAR PEDIDO'}
          </button>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  /* CONFIGURAÇÃO DE TELA CHEIA E CLEAN */
  .page-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 15px;
    padding: 10px;
    box-sizing: border-box;
  }

  /* HEADER MINIMALISTA */
  .action-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 5px;
  }
  .action-header h1 { margin: 0; font-size: 1.4rem; color: #0f172a; font-weight: 800; }
  .action-header p { margin: 0; font-size: 0.85rem; color: #64748b; }
  .status-badge { 
    background: #e0f2fe; color: #0369a1; padding: 6px 12px; 
    border-radius: 8px; font-weight: 700; font-size: 0.75rem;
  }

  /* GRID PRINCIPAL */
  .dashboard-grid {
    display: grid;
    grid-template-columns: 380px 1fr;
    gap: 15px;
    flex: 1;
    overflow: hidden;
  }

  .card {
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 15px;
    display: flex;
    flex-direction: column;
    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
  }

  /* COLUNA ESQUERDA */
  .left-col { display: flex; flex-direction: column; gap: 15px; overflow-y: auto; }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-icon { position: absolute; left: 12px; color: #94a3b8; }
  .search-input-wrapper input {
    width: 100%; padding: 12px 12px 12px 40px;
    border: 1.5px solid #e2e8f0; border-radius: 12px;
    font-size: 0.9rem; outline: none; transition: 0.2s;
  }
  .search-input-wrapper input:focus { border-color: #0284c7; box-shadow: 0 0 0 3px rgba(2,132,199,0.1); }

  .results-container {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 300px;
    overflow-y: auto;
  }

  .product-card {
    background: #f8fafc; border: 1px solid #f1f5f9;
    padding: 10px; border-radius: 10px;
    display: grid; grid-template-columns: 1fr auto; gap: 8px;
  }
  .p-name { font-weight: 700; font-size: 0.85rem; display: block; }
  .p-meta { display: flex; gap: 10px; align-items: center; margin-top: 4px; }
  .p-unit { font-size: 0.65rem; background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
  .stock-label { font-size: 0.7rem; font-weight: 700; color: #16a34a; }
  .stock-label.low { color: #dc2626; }

  .btn-add-quick {
    background: #0284c7; color: white; border: none; padding: 0 15px;
    border-radius: 8px; font-size: 0.75rem; font-weight: 700; cursor: pointer;
  }
  .btn-add-quick:disabled { background: #cbd5e1; cursor: not-allowed; }

  .purchase-alert {
    grid-column: span 2; font-size: 0.65rem; color: #1e40af;
    background: #eff6ff; padding: 4px 8px; border-radius: 4px;
  }

  /* AGENDAMENTO COMPACTO */
  .section-title { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .section-title h3 { margin: 0; font-size: 0.9rem; }
  .schedule-form { display: flex; flex-direction: column; gap: 12px; }
  .field label { display: block; font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 4px; }
  
  .time-tabs { display: flex; flex-direction: column; gap: 8px; }
  .turno-row { display: flex; align-items: center; gap: 10px; }
  .chips-container { display: flex; flex-wrap: wrap; gap: 5px; }
  
  .time-chip {
    padding: 5px 10px; border-radius: 6px; border: 1px solid #e2e8f0;
    background: white; font-size: 0.75rem; font-weight: 600; cursor: pointer;
  }
  .time-chip.selected { background: #0284c7; color: white; border-color: #0284c7; }

  /* COLUNA DIREITA (CARRINHO) */
  .cart-card { height: 100%; }
  .cart-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
  .cart-header h2 { font-size: 1.1rem; margin: 0; }
  .count-badge { background: #0f172a; color: white; padding: 2px 10px; border-radius: 12px; font-size: 0.75rem; font-weight: 700; }

  .cart-items { flex: 1; overflow-y: auto; padding-right: 5px; }
  .cart-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 0; border-bottom: 1px solid #f1f5f9;
  }
  .item-main { display: flex; flex-direction: column; }
  .item-name { font-weight: 600; font-size: 0.9rem; }
  .stock-warning { font-size: 0.65rem; color: #ef4444; font-weight: 700; }

  .item-controls { display: flex; align-items: center; gap: 12px; }
  .stepper { display: flex; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; height: 32px; }
  .stepper button { border: none; background: #f8fafc; width: 30px; cursor: pointer; }
  .stepper input { width: 35px; border: none; text-align: center; font-weight: 700; font-size: 0.85rem; }
  
  .item-note { border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; width: 150px; }
  .btn-remove { background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 1.1rem; }
  .btn-remove:hover { color: #ef4444; }

  .empty-state {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    height: 100%; color: #94a3b8;
  }
  .empty-state .icon { font-size: 3rem; margin-bottom: 10px; opacity: 0.3; }

  .cart-footer { padding-top: 15px; border-top: 1px solid #f1f5f9; }
  .btn-submit {
    width: 100%; padding: 15px; border-radius: 12px; border: none;
    background: #0284c7; color: white; font-weight: 800; font-size: 1rem;
    cursor: pointer; transition: 0.2s;
  }
  .btn-submit:disabled { background: #cbd5e1; cursor: not-allowed; }
  .btn-submit:hover:not(:disabled) { background: #0369a1; transform: translateY(-2px); }

  .night-note { font-size: 0.7rem; color: #9a3412; background: #fff7ed; padding: 8px; border-radius: 6px; margin-bottom: 10px; text-align: center; }

  textarea { width: 100%; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; font-family: inherit; font-size: 0.8rem; height: 60px; resize: none; }
</style>