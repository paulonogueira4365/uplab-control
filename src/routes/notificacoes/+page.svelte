<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { 
    Bell, BellOff, Package, CalendarCheck, 
    Info, Check, Loader2, CheckCheck, Trash2, X 
  } from 'lucide-svelte';
  import { fade, fly, slide, scale } from 'svelte/transition';

  // --- ESTADOS ---
  let notificacoes = $state<any[]>([]);
  let carregando = $state(true);
  let apenasNaoLidas = $state(false);
  let processandoLote = $state(false);
  let confirmandoLimpeza = $state(false); // Substitui o confirm() nativo

  // --- DERIVADOS ---
  const notificacoesFiltradas = $derived(
    apenasNaoLidas ? notificacoes.filter(n => !n.lida) : notificacoes
  );
  const totalNaoLidas = $derived(notificacoes.filter(n => !n.lida).length);
  const possuiLidas = $derived(notificacoes.some(n => n.lida));

  // --- FUNÇÕES ---
  async function carregarNotificacoes() {
    carregando = true;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data, error } = await supabase
        .from('notificacoes')
        .select('*')
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order('created_at', { ascending: false });

      if (data) notificacoes = data;
    }
    carregando = false;
  }

  async function marcarComoLida(id: number) {
    const { error } = await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    if (!error) {
      notificacoes = notificacoes.map(n => n.id === id ? { ...n, lida: true } : n);
    }
  }

  async function excluirNotificacao(id: number) {
    const { error } = await supabase.from('notificacoes').delete().eq('id', id);
    if (!error) {
      notificacoes = notificacoes.filter(n => n.id !== id);
    } else {
      console.error("Erro ao deletar. Verifique as políticas RLS no Supabase:", error.message);
    }
  }

  async function limparLidas() {
    processandoLote = true;
    const { data: { user } } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('notificacoes')
      .delete()
      .eq('lida', true)
      .or(`user_id.eq.${user?.id},user_id.is.null`);

    if (!error) {
      notificacoes = notificacoes.filter(n => !n.lida);
      confirmandoLimpeza = false;
    } else {
      console.error("Erro RLS:", error.message);
    }
    processandoLote = false;
  }

  async function marcarTodasComoLidas() {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('notificacoes')
      .update({ lida: true })
      .eq('lida', false)
      .or(`user_id.eq.${user?.id},user_id.is.null`);

    if (!error) notificacoes = notificacoes.map(n => ({ ...n, lida: true }));
  }

  function getIcon(tipo: string) {
    switch (tipo) {
      case 'estoque': return { component: Package, color: '#0284c7' };
      case 'agendamento': return { component: CalendarCheck, color: '#f59e0b' };
      default: return { component: Info, color: '#64748b' };
    }
  }

  onMount(carregarNotificacoes);
</script>

<div class="notif-container">
  <header class="header">
    <div class="header-top">
      <div class="title-group">
        <div class="bell-icon">
          <Bell size={22} color="white" />
          {#if totalNaoLidas > 0}
            <span class="badge-count" transition:scale>{totalNaoLidas}</span>
          {/if}
        </div>
        <h1>Notificações</h1>
      </div>

      <div class="global-actions">
        {#if totalNaoLidas > 0}
          <button class="btn-text blue" onclick={marcarTodasComoLidas} in:fade>
            <CheckCheck size={16} /> Lidas
          </button>
        {/if}
        
        {#if possuiLidas}
          {#if !confirmandoLimpeza}
            <button class="btn-text red" onclick={() => confirmandoLimpeza = true} in:fade>
              <Trash2 size={16} /> Limpar lidas
            </button>
          {:else}
            <div class="confirm-box" transition:fly={{ x: 20 }}>
              <button class="btn-confirm-action" onclick={limparLidas} disabled={processandoLote}>
                {processandoLote ? '...' : 'Confirmar?'}
              </button>
              <button class="btn-cancel-action" onclick={() => confirmandoLimpeza = false}>
                <X size={14} />
              </button>
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <div class="header-filters">
      <p>Atualizações do sistema e histórico</p>
      <label class="filter-toggle">
        <input type="checkbox" bind:checked={apenasNaoLidas} />
        <span class="toggle-track"></span>
        <span class="toggle-text">Ocultar lidas</span>
      </label>
    </div>
  </header>

  {#if carregando}
    <div class="loading-state">
      <div class="spin-wrapper"><Loader2 size={32} /></div>
    </div>
  {:else if notificacoesFiltradas.length === 0}
    <div class="empty-state" in:fade>
      <BellOff size={40} />
      <p>Nenhuma notificação por aqui.</p>
    </div>
  {:else}
    <div class="notif-list">
      {#each notificacoesFiltradas as n (n.id)}
        {@const info = getIcon(n.tipo)}
        {@const IconComp = info.component}
        
        <div class="notif-card" class:unread={!n.lida} in:fly={{ y: 10 }}>
          <div class="icon-bg" style="background: {info.color}15">
            <IconComp size={20} color={info.color} />
          </div>

          <div class="content-section">
            <div class="card-meta">
              <span class="type-label" style="color: {info.color}">{n.tipo}</span>
              <span class="time-stamp">{new Date(n.created_at).toLocaleDateString('pt-BR', {hour:'2-digit', minute:'2-digit'})}</span>
            </div>
            <h3>{n.titulo}</h3>
            <p>{n.mensagem}</p>
          </div>

          <div class="action-section">
            {#if !n.lida}
              <button class="action-btn check" onclick={() => marcarComoLida(n.id)}><Check size={18} /></button>
            {:else}
              <button class="action-btn delete" onclick={() => excluirNotificacao(n.id)}><X size={18} /></button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .notif-container { max-width: 700px; margin: 1.5rem auto; padding: 0 1rem; }
  .header { margin-bottom: 2rem; }
  .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
  .title-group { display: flex; align-items: center; gap: 0.8rem; }
  .bell-icon { background: #0284c7; padding: 10px; border-radius: 12px; position: relative; display: flex; }
  .badge-count { position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; font-size: 0.6rem; padding: 2px 5px; border-radius: 10px; border: 2px solid white; }
  h1 { font-size: 1.5rem; color: #0f172a; margin: 0; }
  
  .global-actions { display: flex; gap: 8px; align-items: center; }
  .btn-text { display: flex; align-items: center; gap: 5px; border: 1px solid transparent; padding: 6px 12px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; }
  .blue { background: #f0f9ff; color: #0284c7; border-color: #bae6fd; }
  .red { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

  /* Estilo do mini-modal de confirmação */
  .confirm-box { display: flex; align-items: center; background: #1e293b; border-radius: 8px; overflow: hidden; }
  .btn-confirm-action { background: #dc2626; color: white; border: none; padding: 6px 12px; font-size: 0.75rem; font-weight: bold; cursor: pointer; }
  .btn-cancel-action { background: #334155; color: white; border: none; padding: 6px 8px; cursor: pointer; }

  .header-filters { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 0.8rem; }
  .header-filters p { font-size: 0.85rem; color: #64748b; margin: 0; }

  .filter-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .filter-toggle input { display: none; }
  .toggle-track { width: 32px; height: 18px; background: #cbd5e1; border-radius: 10px; position: relative; transition: 0.2s; }
  .toggle-track::before { content: ""; position: absolute; width: 14px; height: 14px; background: white; border-radius: 50%; top: 2px; left: 2px; transition: 0.2s; }
  input:checked + .toggle-track { background: #0284c7; }
  input:checked + .toggle-track::before { transform: translateX(14px); }
  .toggle-text { font-size: 0.8rem; color: #475569; font-weight: 600; }

  .notif-list { display: flex; flex-direction: column; gap: 0.8rem; }
  .notif-card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 1rem; display: flex; gap: 1rem; transition: 0.2s; }
  .unread { border-left: 4px solid #0284c7; background: #f8fafc; }
  .icon-bg { width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .content-section { flex: 1; }
  .card-meta { display: flex; justify-content: space-between; margin-bottom: 4px; }
  .type-label { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; }
  .time-stamp { font-size: 0.7rem; color: #94a3b8; }
  h3 { margin: 0; font-size: 0.95rem; color: #1e293b; }
  p { margin: 4px 0 0; font-size: 0.85rem; color: #64748b; line-height: 1.4; }

  .action-btn { border: none; padding: 6px; border-radius: 8px; cursor: pointer; color: #cbd5e1; background: transparent; transition: 0.2s; }
  .action-btn.check:hover { color: #16a34a; background: #dcfce7; }
  .action-btn.delete:hover { color: #dc2626; background: #fee2e2; }

  .loading-state { text-align: center; padding: 3rem; color: #0284c7; }
  .empty-state { text-align: center; padding: 4rem; color: #94a3b8; }
  .spin-wrapper { display: inline-block; animation: rotate 1s linear infinite; }
  @keyframes rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>