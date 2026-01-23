<script lang="ts">
  import "../app.css";
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabase';
  import { 
    LayoutDashboard, History, CalendarCheck, 
    LogOut, Menu, User, ShieldCheck 
  } from 'lucide-svelte';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  let isExpanded = $state(false);
  let dadosUsuario = $state({ nome: "Carregando...", setor: "..." });
  let mostrarMenu = $derived.by(() => $page.url.pathname !== '/');

  onMount(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from('usuarios')
        .select('nome, setores(nome)')
        .eq('id', user.id)
        .single();
      
      if (data) {
        dadosUsuario = {
          nome: data.nome,
          setor: (data.setores as any)?.nome || "Geral"
        };
      }
    }
  });

  async function sair() {
    await supabase.auth.signOut();
    goto('/');
  }
</script>

<div class="app-shell">
  {#if mostrarMenu}
    <aside class="sidebar" class:expanded={isExpanded}>
      <div class="sidebar-header">
        <div class="logo-area">
          <div class="logo-box">UP</div>
          <span class="logo-text">UPLAB <strong>USER</strong></span>
        </div>
        <button class="toggle-btn" onclick={() => isExpanded = !isExpanded}>
          <div class="icon-wrapper" class:rotated={isExpanded}>
            <Menu size={20} />
          </div>
        </button>
      </div>

      <div class="user-section">
        <div class="user-card" class:is-expanded={isExpanded}>
          <div class="avatar-circle">
            <User size={22} strokeWidth={2.5} />
          </div>
          <div class="user-text-wrapper">
            <span class="u-name">{dadosUsuario.nome}</span>
            <span class="u-setor">{dadosUsuario.setor}</span>
          </div>
        </div>
      </div>

      <nav class="nav-menu">
        <a href="/requisicao" class:active={$page.url.pathname === '/requisicao'} title="Nova Requisição">
          <div class="icon-box"><LayoutDashboard size={22} /></div>
          <span class="nav-label">Nova Requisição</span>
        </a>
        <a href="/solicitacoes-agendadas" class:active={$page.url.pathname === '/solicitacoes-agendadas'} title="Agendados">
          <div class="icon-box"><CalendarCheck size={22} /></div>
          <span class="nav-label">Agendados</span>
        </a>
        <a href="/historico" class:active={$page.url.pathname === '/historico'} title="Histórico">
          <div class="icon-box"><History size={22} /></div>
          <span class="nav-label">Histórico</span>
        </a>
      </nav>

      <div class="sidebar-footer">
        <a href="/alterar-senha" class="footer-link" title="Segurança">
          <div class="icon-box"><ShieldCheck size={20} /></div>
          <span class="nav-label">Segurança</span>
        </a>
        <button class="logout-btn" onclick={sair} title="Sair">
          <div class="icon-box"><LogOut size={20} /></div>
          <span class="nav-label">Sair do Sistema</span>
        </button>
      </div>
    </aside>
  {/if}

  <main class="main-content" class:shifted={isExpanded && mostrarMenu} class:full={!mostrarMenu}>
    <div class="content-wrapper">
      <slot />
    </div>
  </main>
</div>

<style>
  :global(body) { margin: 0; background-color: #f8fafc; font-family: 'Inter', sans-serif; overflow: hidden; }
  .app-shell { display: flex; height: 100vh; width: 100vw; }

  .sidebar {
    position: fixed; left: 0; top: 0; height: 100vh; width: 76px;
    background: white; border-right: 1px solid #e2e8f0;
    display: flex; flex-direction: column; transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
  }
  .sidebar.expanded { width: 260px; }

  .sidebar-header { height: 70px; display: flex; align-items: center; padding: 0 18px; justify-content: space-between; }
  .logo-area { display: flex; align-items: center; gap: 15px; overflow: hidden; }
  .logo-box { min-width: 40px; height: 40px; background: #0284c7; color: white; border-radius: 10px; display: grid; place-items: center; font-weight: 900; }
  .logo-text { opacity: 0; transition: 0.2s; white-space: nowrap; font-size: 1.1rem; color: #0f172a; }
  .sidebar.expanded .logo-text { opacity: 1; }

  .toggle-btn { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px; cursor: pointer; color: #64748b; }
  .icon-wrapper { transition: transform 0.3s; }
  .rotated { transform: rotate(180deg); }

  .user-section { padding: 0 12px; margin-bottom: 20px; }
  .user-card { background: #f0f7ff; border-radius: 14px; padding: 8px; display: flex; align-items: center; border: 1px solid #e0eefe; height: 50px; overflow: hidden; }
  .avatar-circle { min-width: 34px; height: 34px; background: #0284c7; color: white; border-radius: 8px; display: grid; place-items: center; }
  .user-text-wrapper { margin-left: 12px; display: flex; flex-direction: column; opacity: 0; transition: 0.2s; white-space: nowrap; }
  .sidebar.expanded .user-text-wrapper { opacity: 1; }
  .u-name { font-size: 0.85rem; font-weight: 700; color: #1e293b; }
  .u-setor { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }

  .nav-menu { flex: 1; padding: 0 12px; display: flex; flex-direction: column; gap: 6px; }
  .nav-menu a, .footer-link, .logout-btn { display: flex; align-items: center; height: 48px; text-decoration: none; color: #64748b; border-radius: 12px; transition: 0.2s; overflow: hidden; }
  .icon-box { min-width: 52px; display: grid; place-items: center; }
  .nav-label { opacity: 0; white-space: nowrap; font-weight: 500; }
  .sidebar.expanded .nav-label { opacity: 1; }
  .nav-menu a:hover { background: #f1f5f9; color: #0284c7; }
  .nav-menu a.active { background: #e0f2fe; color: #0284c7; font-weight: 600; }

  .sidebar-footer { padding: 15px 12px; border-top: 1px solid #f1f5f9; }
  .logout-btn { border: none; background: none; width: 100%; cursor: pointer; }
  .logout-btn:hover { background: #fff1f2; color: #e11d48; }

  .main-content { flex: 1; height: 100vh; overflow-y: auto; transition: padding-left 0.3s; padding-left: 76px; }
  .main-content.shifted { padding-left: 260px; }
  .main-content.full { padding-left: 0; }
  .content-wrapper { padding: 20px; height: 100%; box-sizing: border-box; }
</style>