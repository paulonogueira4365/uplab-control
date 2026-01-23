<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    Clock, CheckCircle2, XCircle, PackageSearch, 
    Calendar, Search, Filter, RefreshCw, MapPin
  } from 'lucide-svelte';
  import { fade } from 'svelte/transition';

  // --- INTERFACES ---
  interface Requisicao {
    id: number;
    data_criacao: string;
    quantidade: number;
    status: string;
    data_retirada: string;
    horario_retirada: string;
    produtos: { nome: string; unidade_medida: string } | null;
    setores: { nome: string } | null;
  }

  // --- ESTADOS ---
  let requisicoes = $state<Requisicao[]>([]);
  let carregando = $state(true);
  let busca = $state("");
  let filtroStatus = $state("TODOS");
  let periodoSelecionado = $state("7");

  // --- LÓGICA DE FILTRAGEM ---
  let filtrados = $derived.by(() => {
    let lista = [...requisicoes];

    if (busca.trim() !== "") {
      const termo = busca.toLowerCase();
      lista = lista.filter(r => 
        r.produtos?.nome?.toLowerCase().includes(termo) || 
        r.id.toString().includes(termo)
      );
    }

    if (filtroStatus !== "TODOS") {
      lista = lista.filter(r => {
        const s = (r.status || "").toUpperCase();
        if (filtroStatus === "NEGADO") {
          return ["NEGADO", "RECUSADA", "RECUSADO", "CANCELADA"].includes(s);
        }
        return s === filtroStatus.toUpperCase();
      });
    }

    if (periodoSelecionado !== "TUDO") {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const limite = new Date(hoje);
      limite.setDate(hoje.getDate() - parseInt(periodoSelecionado));
      lista = lista.filter(r => new Date(r.data_criacao) >= limite);
    }

    return lista.sort((a, b) => b.id - a.id);
  });

  let stats = $derived({
    total: requisicoes.length,
    pendentes: requisicoes.filter(r => (r.status || "").toUpperCase() === 'PENDENTE').length,
    aprovados: requisicoes.filter(r => ['APROVADO', 'ENTREGUE'].includes((r.status || "").toUpperCase())).length,
    recusados: requisicoes.filter(r => ["NEGADO", "RECUSADA", "RECUSADO"].includes((r.status || "").toUpperCase())).length
  });

  async function carregarDados() {
    carregando = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('requisicoes')
        .select(`
          id, data_criacao, status, quantidade, data_retirada, horario_retirada,
          produtos:produto_id (nome, unidade_medida),
          setores:setor_id (nome)
        `)
        .eq('user_id', user.id)
        .order('id', { ascending: false });

      if (error) throw error;
      requisicoes = (data as any) || [];
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      carregando = false;
    }
  }

  onMount(carregarDados);
</script>

<div class="app-container">
  <aside class="sidebar">
    <div class="brand">
      <div class="logo">UPLAB</div>
      <div class="brand-info">
        <span class="title">REQUISIÇÃO</span>
        <span class="subtitle">BOM DIA</span>
      </div>
    </div>

    <div class="nav-group">
      <span class="nav-title">SITUAÇÃO</span>
      <nav>
        <button class:active={filtroStatus === 'TODOS'} onclick={() => filtroStatus = 'TODOS'}>
          <Filter size={18} /> Todos <span class="badge">{stats.total}</span>
        </button>
        <button class:active={filtroStatus === 'PENDENTE'} onclick={() => filtroStatus = 'PENDENTE'} class="btn-pendente">
          <Clock size={18} /> Pendentes <span class="badge">{stats.pendentes}</span>
        </button>
        <button class:active={filtroStatus === 'APROVADO'} onclick={() => filtroStatus = 'APROVADO'} class="btn-aprovado">
          <CheckCircle2 size={18} /> Finalizados <span class="badge">{stats.aprovados}</span>
        </button>
        <button class:active={filtroStatus === 'NEGADO'} onclick={() => filtroStatus = 'NEGADO'} class="btn-negado">
          <XCircle size={18} /> Recusados <span class="badge">{stats.recusados}</span>
        </button>
      </nav>
    </div>

    <div class="nav-group mt-6">
      <label for="periodo-select" class="nav-title">PERÍODO</label>
      <select id="periodo-select" bind:value={periodoSelecionado} class="select-field">
        <option value="0">Somente Hoje</option>
        <option value="7">Últimos 7 dias</option>
        <option value="30">Últimos 30 dias</option>
        <option value="TUDO">Histórico Completo</option>
      </select>
    </div>
  </aside>

  <main class="main-content">
    <header class="header">
      <div class="search-bar">
        <Search size={20} />
        <input type="text" bind:value={busca} placeholder="Pesquisar material ou ID..." aria-label="Buscar requisições" />
      </div>
      <button class="refresh-btn" onclick={carregarDados} disabled={carregando} aria-label="Atualizar lista">
        <RefreshCw size={20} class={carregando ? 'spin' : ''} />
      </button>
    </header>

    <div class="view-port">
      {#if carregando}
        <div class="loader-state">
          <div class="spinner"></div>
          <p>Carregando...</p>
        </div>
      {:else if filtrados.length === 0}
        <div class="empty-state" in:fade>
          <PackageSearch size={60} strokeWidth={1} />
          <h3>Nenhum registro encontrado</h3>
        </div>
      {:else}
        <div class="table-wrapper">
          <table class="custom-table">
            <thead>
              <tr>
                <th class="w-100">CÓDIGO</th>
                <th class="w-180">DATA</th>
                <th>MATERIAL / DESCRIÇÃO</th>
                <th class="w-100 text-center">QTD</th>
                <th class="w-220">SETOR / RETIRADA</th>
                <th class="w-160 text-right">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {#each filtrados as req (req.id)}
                <tr in:fade={{ duration: 150 }}>
                  <td class="id-col">#{req.id}</td>
                  <td class="date-col">
                    <span class="main-date">{new Date(req.data_criacao).toLocaleDateString()}</span>
                    <span class="sub-date">{new Date(req.data_criacao).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </td>
                  <td>
                    <div class="product-cell">
                      <span class="name">{req.produtos?.nome || 'Não identificado'}</span>
                      <span class="unit">{req.produtos?.unidade_medida || 'un'}</span>
                    </div>
                  </td>
                  <td class="text-center">
                    <span class="qty-label">{req.quantidade}</span>
                  </td>
                  <td>
                    <div class="logistic-cell">
                      <span class="setor"><MapPin size={12}/> {req.setores?.nome || 'Logística'}</span>
                      <span class="schedule"><Calendar size={12}/> {req.data_retirada ? new Date(req.data_retirada).toLocaleDateString() : '--'}</span>
                    </div>
                  </td>
                  <td class="text-right">
                    <span class="status-tag {req.status?.toLowerCase()}">{req.status}</span>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </main>
</div>

<style>
  /* Solução para os erros de 'width': definimos as larguras no CSS */
  .w-100 { width: 100px; }
  .w-160 { width: 160px; }
  .w-180 { width: 180px; }
  .w-220 { width: 220px; }

  :global(body) { margin: 0; font-family: 'Inter', sans-serif; background: #f1f5f9; }
  .app-container { display: flex; height: 100vh; }

  .sidebar { width: 300px; background: white; border-right: 1px solid #e2e8f0; padding: 2rem 1.5rem; }
  .brand { display: flex; align-items: center; gap: 15px; margin-bottom: 3rem; }
  .logo { background: #0284c7; color: white; padding: 12px; border-radius: 12px; font-weight: 900; }
  .title { display: block; font-weight: 800; font-size: 1.1rem; }

  .nav-group nav { display: flex; flex-direction: column; gap: 5px; }
  .nav-title { font-size: 0.7rem; font-weight: 800; color: #94a3b8; display: block; margin-bottom: 1rem; }
  
  .nav-group button {
    width: 100%; background: none; border: none; padding: 12px; display: flex; align-items: center; gap: 12px;
    color: #64748b; font-weight: 600; cursor: pointer; border-radius: 12px;
  }
  .nav-group button.active { background: #f0f9ff; color: #0284c7; }
  .badge { margin-left: auto; font-size: 0.75rem; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; }

  .select-field { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; font-weight: 600; }

  .main-content { flex: 1; display: flex; flex-direction: column; }
  .header { background: white; padding: 1.2rem 2.5rem; border-bottom: 1px solid #e2e8f0; display: flex; gap: 2rem; }
  .search-bar { flex: 1; display: flex; align-items: center; gap: 12px; color: #94a3b8; }
  .search-bar input { border: none; outline: none; width: 100%; font-size: 1rem; }

  .view-port { flex: 1; overflow-y: auto; padding: 2rem 2.5rem; }
  .table-wrapper { background: white; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; }
  
  .custom-table { width: 100%; border-collapse: collapse; }
  .custom-table th { text-align: left; padding: 1.2rem 1.5rem; background: #f8fafc; font-size: 0.75rem; color: #64748b; border-bottom: 1px solid #e2e8f0; }
  .custom-table td { padding: 1.2rem 1.5rem; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }

  .qty-label { background: #1e293b; color: white; padding: 5px 12px; border-radius: 8px; font-weight: 800; }
  .status-tag { padding: 6px 14px; border-radius: 20px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; }
  .status-tag.pendente { background: #fffbeb; color: #92400e; }
  .status-tag.aprovado { background: #f0fdf4; color: #166534; }

  .text-center { text-align: center; }
  .text-right { text-align: right; }
  .mt-6 { margin-top: 1.5rem; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .loader-state, .empty-state { text-align: center; padding: 5rem; color: #94a3b8; }
  .spinner { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #0284c7; border-radius: 50%; margin: 0 auto 1rem; animation: spin 1s linear infinite; }
</style>