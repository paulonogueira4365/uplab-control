<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    CalendarClock, Timer, Box, Search, RefreshCw, 
    AlertTriangle, LayoutGrid, List
  } from 'lucide-svelte';
  import { fade, fly } from 'svelte/transition';

  let agendamentos = $state<any[]>([]);
  let carregando = $state(true);
  let busca = $state("");

  async function carregarPendencias() {
    carregando = true;
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const hoje = new Date().toISOString().split('T')[0];
      
      // FILTRO: Apenas PENDENTES e de HOJE para frente
      const { data, error } = await supabase
        .from('requisicoes')
        .select(`*, produtos ( nome, unidade_medida ), setores ( nome )`)
        .eq('user_id', user.id)
        .eq('status', 'PENDENTE') // Regra: Sumir se mudar o status
        .gte('data_retirada', hoje)
        .order('data_retirada', { ascending: true })
        .order('horario_retirada', { ascending: true });

      if (data) agendamentos = data;
    }
    carregando = false;
  }

  // Agrupamento por Data para o Layout
  let grupos = $derived.by(() => {
    const filtrados = agendamentos.filter(a => 
      a.produtos?.nome.toLowerCase().includes(busca.toLowerCase())
    );
    const map = new Map();
    filtrados.forEach(item => {
      if (!map.has(item.data_retirada)) map.set(item.data_retirada, []);
      map.get(item.data_retirada).push(item);
    });
    return Array.from(map.entries());
  });

  onMount(carregarPendencias);
</script>

<div class="fullscreen-app">
  <aside class="control-sidebar">
    <div class="brand">
      <div class="logo">UP</div>
      <div class="brand-info">
        <span class="title">PAINEL DE COLETA</span>
        <span class="subtitle">Aguardando Aprovação</span>
      </div>
    </div>

    <div class="search-bar">
      <Search size={18} />
      <input type="text" bind:value={busca} placeholder="Buscar material..." />
    </div>

    <div class="stats-panel">
      <div class="stat-card">
        <span class="stat-label">Pendentes</span>
        <span class="stat-value">{agendamentos.length}</span>
      </div>
    </div>

    <button class="refresh-btn" onclick={carregarPendencias} disabled={carregando}>
      <RefreshCw size={18} class={carregando ? 'spin' : ''} />
      Atualizar Painel
    </button>

    <div class="info-footer">
      <AlertTriangle size={16} />
      <p>Itens aprovados são movidos automaticamente para o Histórico.</p>
    </div>
  </aside>

  <main class="main-viewport">
    {#if carregando}
      <div class="loading-overlay">
        <div class="loader"></div>
        <p>Sincronizando agendamentos...</p>
      </div>
    {:else if grupos.length === 0}
      <div class="empty-state" in:fade>
        <div class="empty-icon"><Box size={60} strokeWidth={1} /></div>
        <h2>Tudo em dia!</h2>
        <p>Não há retiradas pendentes para os próximos dias.</p>
      </div>
    {:else}
      <div class="content-grid">
        {#each grupos as [data, itens]}
          <section class="date-group">
            <header class="group-header">
              <div class="date-badge">
                <span class="m">{new Date(data + 'T00:00:00').toLocaleString('pt-BR', {month: 'short'})}</span>
                <span class="d">{data.split('-')[2]}</span>
              </div>
              <h3>{new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', {weekday: 'long'})}</h3>
              <span class="count-tag">{itens.length} itens</span>
            </header>

            <div class="items-container">
              {#each itens as item}
                <div class="item-card" in:fly={{ y: 20, duration: 300 }}>
                  <div class="card-left">
                    <div class="time">
                      <Timer size={14} />
                      {item.horario_retirada?.slice(0, 5)}
                    </div>
                    <div class="status-tag">PENDENTE</div>
                  </div>

                  <div class="card-main">
                    <div class="prod-name">{item.produtos?.nome}</div>
                    <div class="prod-meta">
                      <span class="qty">{item.quantidade} {item.produtos?.unidade_medida}</span>
                      <span class="dot">•</span>
                      <span class="sector">{item.setores?.nome}</span>
                    </div>
                    {#if item.observacao_geral}
                      <div class="obs-box">{item.observacao_geral}</div>
                    {/if}
                  </div>
                </div>
              {/each}
            </div>
          </section>
        {/each}
      </div>
    {/if}
  </main>
</div>

<style>
  :global(body, html) {
    margin: 0; padding: 0;
    height: 100vh; width: 100vw;
    font-family: 'Inter', sans-serif;
    overflow: hidden;
  }

  .fullscreen-app {
    display: flex;
    height: 100vh;
    width: 100vw;
    background: #f1f5f9;
  }

  /* SIDEBAR */
  .control-sidebar {
    width: 300px;
    background: #ffffff;
    border-right: 1px solid #e2e8f0;
    padding: 2rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 2rem;
    box-shadow: 4px 0 10px rgba(0,0,0,0.02);
    z-index: 10;
  }

  .brand { display: flex; align-items: center; gap: 1rem; }
  .logo { background: #0284c7; color: white; font-weight: 900; padding: 10px; border-radius: 12px; }
  .title { display: block; font-weight: 800; color: #0f172a; font-size: 1.1rem; }
  .subtitle { font-size: 0.75rem; color: #64748b; }

  .search-bar {
    position: relative;
    display: flex;
    align-items: center;
  }
  .search-bar input {
    width: 100%;
    padding: 12px 12px 12px 40px;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    outline: none;
    font-size: 0.9rem;
  }
  .search-bar :global(svg) { position: absolute; left: 14px; color: #94a3b8; }

  .stat-card {
    background: #f0f9ff;
    padding: 1.5rem;
    border-radius: 16px;
    border: 1px solid #bae6fd;
    text-align: center;
  }
  .stat-label { display: block; color: #0369a1; font-weight: 700; font-size: 0.8rem; margin-bottom: 0.5rem; }
  .stat-value { font-size: 2.5rem; font-weight: 900; color: #0284c7; }

  .refresh-btn {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    background: #0f172a; color: white; border: none; padding: 14px;
    border-radius: 12px; font-weight: 600; cursor: pointer; transition: 0.2s;
  }
  .refresh-btn:hover { background: #1e293b; }

  .info-footer {
    margin-top: auto;
    background: #fffbeb;
    padding: 1rem;
    border-radius: 12px;
    display: flex; gap: 10px;
    color: #92400e; font-size: 0.75rem;
  }

  /* MAIN VIEWPORT */
  .main-viewport {
    flex: 1;
    overflow-y: auto;
    padding: 2.5rem;
    scroll-behavior: smooth;
  }

  .content-grid {
    display: flex;
    flex-direction: column;
    gap: 3rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
  }

  .date-badge {
    background: #0284c7;
    color: white;
    width: 60px;
    height: 60px;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .date-badge .m { font-size: 0.7rem; text-transform: uppercase; font-weight: 800; }
  .date-badge .d { font-size: 1.5rem; font-weight: 900; }

  .group-header h3 { font-size: 1.4rem; color: #1e293b; text-transform: capitalize; margin: 0; }
  .count-tag { background: #e2e8f0; color: #475569; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; }

  .items-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
    gap: 1.5rem;
  }

  /* CARD DE PENDÊNCIA OPERACIONAL */
  .item-card {
    background: white;
    border-radius: 16px;
    border: 1px solid #e2e8f0;
    padding: 1.5rem;
    display: flex;
    gap: 1.5rem;
    transition: 0.2s;
    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
  }
  .item-card:hover { border-color: #0284c7; transform: translateY(-3px); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }

  .card-left { display: flex; flex-direction: column; align-items: center; border-right: 1px solid #f1f5f9; padding-right: 1.5rem; min-width: 80px; }
  .time { font-size: 1rem; font-weight: 800; color: #0284c7; display: flex; align-items: center; gap: 6px; }
  .status-tag { margin-top: 10px; font-size: 0.6rem; font-weight: 800; background: #fffbeb; color: #92400e; padding: 4px 8px; border-radius: 6px; }

  .card-main { flex: 1; }
  .prod-name { font-size: 1.1rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem; }
  .prod-meta { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; color: #64748b; font-weight: 500; }
  .qty { color: #0f172a; font-weight: 700; }
  
  .obs-box { 
    margin-top: 1rem; padding: 10px; background: #f8fafc; 
    border-radius: 8px; font-size: 0.8rem; color: #475569; border: 1px dashed #e2e8f0;
  }

  .loading-overlay { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #64748b; }
  .loader { width: 40px; height: 40px; border: 4px solid #e2e8f0; border-top-color: #0284c7; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .empty-state { text-align: center; margin-top: 10vh; color: #94a3b8; }
  .empty-icon { margin-bottom: 1.5rem; color: #e2e8f0; }

  @media (max-width: 1000px) {
    .fullscreen-app { flex-direction: column; }
    .control-sidebar { width: 100%; border-right: none; border-bottom: 1px solid #e2e8f0; }
    .items-container { grid-template-columns: 1fr; }
  }
</style>