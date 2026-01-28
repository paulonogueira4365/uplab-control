<script lang="ts">
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabase';
  import { fade, slide, fly, scale } from 'svelte/transition';
  import { 
    Search, ShoppingCart, User, Clock, Calendar, Info, 
    PackageSearch, Trash2, Plus, CheckCircle2, AlertTriangle, Truck, Hourglass 
  } from 'lucide-svelte';

  // --- INTERFACES ---
  interface Produto {
    id: number;
    nome: string;
    unidade_medida: string;
    estoque_atual: number;
    estoque_minimo: number;
    previsao_chegada?: string | null;
    tem_oc_pendente?: boolean;
  }

  interface ItemCarrinho extends Produto {
    quantidade_pedida: number;
    observacao_item: string;
  }

  // --- ESTADOS ---
  let busca = $state("");
  let solicitante = $state(""); 
  let turnoSelecionado = $state(""); 
  let carregando = $state(true);
  let enviando = $state(false);
  let sucesso = $state(false); 
  
  let produtosBase = $state<Produto[]>([]);
  let carrinho = $state<ItemCarrinho[]>([]);
  let dadosUsuario = $state({ nome: "", setor_id: null, setor_nome: "" });
  let listaMembros = $state<string[]>([]); 

  let agendamento = $state({
    data: new Date().toISOString().split('T')[0],
    obsGeral: ""
  });

  const turnos = [
    { id: 'MANHÃ', label: 'Manhã', icon: '☀️' },
    { id: 'TARDE', label: 'Tarde', icon: '⛅' },
    { id: 'NOITE', label: 'Noite', icon: '🌙' }
  ];

  // --- LÓGICA DERIVADA ---
  let produtosFiltrados = $derived(
    busca.length > 1 
      ? produtosBase.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 8)
      : []
  );

  onMount(async () => {
    await carregarDadosIniciais();
  });

  async function carregarDadosIniciais() {
    carregando = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('usuarios')
        .select('nome, setor_id, setores(nome, membros)')
        .eq('id', user?.id).single();
      
      const infoSetor = profile?.setores as any;
      dadosUsuario = {
        nome: profile?.nome || "",
        setor_id: profile?.setor_id,
        setor_nome: infoSetor?.nome || "Não definido"
      };

      listaMembros = infoSetor?.membros || [];

      // BUSCA AVANÇADA: Trazendo saldos + itens de OC com status de compra
      const { data: prodData } = await supabase
        .from('produtos')
        .select(`
          id, nome, unidade_medida, estoque_minimo, 
          estoque_saldos!inner (saldo),
          itens_ordem_compra (
            ordem_id,
            ordens_compra!inner (
              status,
              compras (previsao_entrega, status_entrega)
            )
          )
        `)
        .eq('ativo', true)
        .eq('estoque_saldos.unidade_id', 2)
        .filter('setores_ids', 'cs', `[${dadosUsuario.setor_id}]`)
        .order('nome');

      produtosBase = (prodData || []).map(p => {
        // Extrair previsões de compras que não foram recebidas ainda
        const comprasPendentes = (p.itens_ordem_compra || [])
          .map((item: any) => item.ordens_compra?.compras)
          .flat()
          .filter((c: any) => c && c.status_entrega !== 'RECEBIDA' && c.previsao_entrega)
          .sort((a: any, b: any) => new Date(a.previsao_entrega).getTime() - new Date(b.previsao_entrega).getTime());

        return {
          id: p.id,
          nome: p.nome,
          unidade_medida: p.unidade_medida,
          estoque_minimo: p.estoque_minimo,
          estoque_atual: (p.estoque_saldos as any)[0]?.saldo || 0,
          previsao_chegada: comprasPendentes[0]?.previsao_entrega || null,
          tem_oc_pendente: comprasPendentes.length > 0
        };
      });
    } catch (e) { console.error("Erro ao carregar dados:", e); }
    finally { carregando = false; }
  }

  function adicionarAoCarrinho(p: Produto) {
    if (p.estoque_atual <= 0) return;
    const existente = carrinho.find(item => item.id === p.id);
    if (existente) {
      existente.quantidade_pedida += 1;
    } else {
      carrinho.push({ ...p, quantidade_pedida: 1, observacao_item: "" });
    }
    busca = ""; 
    sucesso = false;
  }

  async function finalizarRequisicao() {
    if (!solicitante || !turnoSelecionado || carrinho.length === 0) return;
    enviando = true;
    try {
      const msgNoite = turnoSelecionado === 'NOITE' ? "ENTREGA NO SETOR." : "";
      const obsFinal = `[TURNO: ${turnoSelecionado}] SOLICITANTE: ${solicitante} | ${msgNoite} | ${agendamento.obsGeral}`;
      
      const payload = carrinho.map(item => ({
        produto_id: item.id,
        setor_id: dadosUsuario.setor_id,
        quantidade: item.quantidade_pedida,
        observacao: item.observacao_item,
        data_retirada: agendamento.data,
        horario_retirada: turnoSelecionado,
        observacao_geral: obsFinal.toUpperCase(),
        status: 'PENDENTE'
      }));

      const { error } = await supabase.from('requisicoes').insert(payload);
      if (error) throw error;

      sucesso = true;
      carrinho = [];
      solicitante = "";
      turnoSelecionado = "";
      agendamento.obsGeral = "";
      setTimeout(() => { sucesso = false; }, 6000);
    } catch (e: any) {
      alert("Erro ao enviar: " + e.message);
    } finally {
      enviando = false;
    }
  }
</script>

<div class="app-shell">
  <header>
    <div class="header-content">
      <PackageSearch size={22} />
      <span>SISTEMA DE REQUISIÇÃO | <strong>{dadosUsuario.setor_nome}</strong></span>
    </div>
  </header>

  <main class="container">
    <div class="grid">
      
      <section class="search-section">
        <div class="search-container">
          <Search class="s-icon" size={24} />
          <input type="text" placeholder="O que você precisa?" bind:value={busca} />
          
          {#if produtosFiltrados.length > 0}
            <div class="search-results" in:fly={{y: 10}}>
              {#each produtosFiltrados as p}
                <button class="result-item" onclick={() => adicionarAoCarrinho(p)} disabled={p.estoque_atual <= 0}>
                  <div class="r-info">
                    <div class="name-row">
                      <span class="r-name" class:off={p.estoque_atual <= 0}>{p.nome}</span>
                      {#if p.estoque_atual > 0 && p.estoque_atual <= p.estoque_minimo}
                        <span class="badge-warn"><AlertTriangle size={10}/> Baixo</span>
                      {/if}
                    </div>
                    
                    <span class="r-meta">Disponível: <b>{p.estoque_atual} {p.unidade_medida}</b></span>
                    
                    {#if p.tem_oc_pendente}
                      <div class="arrival-info" in:slide>
                        <Truck size={12} /> 
                        <span>Chegada: <b>{new Date(p.previsao_chegada!).toLocaleDateString()}</b></span>
                      </div>
                    {:else if p.estoque_atual <= p.estoque_minimo}
                       <div class="no-arrival">
                          <Hourglass size={12} /> <span>Sem OC pendente</span>
                       </div>
                    {/if}
                  </div>
                  {#if p.estoque_atual > 0} <Plus size={18} /> {:else} <span class="esgotado">Esgotado</span> {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </section>

      <section class="checkout-section">
        <div class="card">
          {#if sucesso}
            <div class="success-overlay" in:scale>
              <div class="check-anim"><CheckCircle2 size={80} color="#16a34a" /></div>
              <h3>Solicitação Enviada!</h3>
              <p>Sua requisição foi processada com sucesso.</p>
              <button class="btn-novo" onclick={() => sucesso = false}>Nova Requisição</button>
            </div>
          {:else}
            <div class="card-head">
              <ShoppingCart size={18} />
              <h2>Itens Selecionados ({carrinho.length})</h2>
            </div>

            <div class="cart-body">
              {#each carrinho as item, i (item.id)}
                <div class="cart-item" in:slide>
                  <div class="item-info">
                    <span class="name">{item.nome}</span>
                    <input type="text" placeholder="Observação p/ este item..." bind:value={item.observacao_item} />
                  </div>
                  <div class="item-ctrl">
                    <div class="stepper">
                      <button onclick={() => item.quantidade_pedida > 1 && item.quantidade_pedida--}>-</button>
                      <input type="number" bind:value={item.quantidade_pedida} min="1" />
                      <button onclick={() => item.quantidade_pedida++}>+</button>
                    </div>
                    <button class="del-btn" onclick={() => carrinho.splice(i, 1)}><Trash2 size={16}/></button>
                  </div>
                </div>
              {:else}
                <div class="empty-msg">
                  <PackageSearch size={60} strokeWidth={1} />
                  <p>Busque os materiais para adicionar ao pedido.</p>
                </div>
              {/each}
            </div>

            <div class="card-footer" class:dim={carrinho.length === 0}>
              <div class="form-grid">
                <div class="input-box">
                  <label><User size={14}/> Solicitante</label>
                  <select bind:value={solicitante}>
                    <option value="">Selecione...</option>
                    {#each listaMembros as m} <option value={m}>{m}</option> {/each}
                    <option value="OUTRO">OUTRO / VISITANTE</option>
                  </select>
                </div>
                <div class="input-box">
                  <label><Calendar size={14}/> Data da Retirada</label>
                  <input type="date" bind:value={agendamento.data} />
                </div>
              </div>

              <div class="input-box">
                <label><Clock size={14}/> Turno de Entrega / Retirada</label>
                <div class="turno-grid">
                  {#each turnos as t}
                    <button 
                      class="t-btn" 
                      class:active={turnoSelecionado === t.id}
                      onclick={() => turnoSelecionado = t.id}
                    >
                      {t.icon} {t.label}
                    </button>
                  {/each}
                </div>
              </div>

              {#if turnoSelecionado === 'NOITE'}
                <div class="noite-info">
                  <Info size={14} /> Entregaremos diretamente no seu setor.
                </div>
              {/if}

              <button 
                class="confirm-btn" 
                disabled={carrinho.length === 0 || !solicitante || !turnoSelecionado || enviando}
                onclick={finalizarRequisicao}
              >
                {enviando ? 'ENVIANDO...' : 'CONFIRMAR PEDIDO'}
              </button>
            </div>
          {/if}
        </div>
      </section>
    </div>
  </main>
</div>

<style>
  :global(body) { margin: 0; background: #f1f5f9; font-family: 'Inter', sans-serif; overflow: hidden; }
  .app-shell { height: 100vh; display: flex; flex-direction: column; }
  
  header { background: #0f172a; color: white; padding: 1rem 2.5rem; border-bottom: 4px solid #3b82f6; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .header-content { display: flex; align-items: center; gap: 12px; font-weight: 500; text-transform: uppercase; font-size: 0.85rem; }

  .container { flex: 1; padding: 1.5rem 3rem; max-width: 1400px; margin: 0 auto; width: 100%; box-sizing: border-box; }
  .grid { display: grid; grid-template-columns: 1fr 480px; gap: 4rem; height: 100%; }

  /* Busca e Alertas */
  .search-section { padding-top: 5rem; }
  .search-container { position: relative; width: 100%; }
  .s-icon { position: absolute; left: 20px; top: 20px; color: #94a3b8; }
  .search-container input { 
    width: 100%; padding: 22px 22px 22px 60px; border-radius: 24px; border: 2px solid #e2e8f0;
    font-size: 1.25rem; outline: none; transition: 0.3s; background: white; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05);
  }
  .search-container input:focus { border-color: #3b82f6; box-shadow: 0 0 0 5px rgba(59, 130, 246, 0.15); }

  .search-results { 
    position: absolute; top: 115%; left: 0; right: 0; background: white; 
    border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15); border: 1px solid #e2e8f0;
    z-index: 100; overflow: hidden; padding: 8px;
  }
  .result-item { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border: none; background: none; cursor: pointer; border-radius: 12px; margin-bottom: 4px; }
  .result-item:hover:not(:disabled) { background: #f0f7ff; }
  .name-row { display: flex; align-items: center; gap: 8px; margin-bottom: 2px; }
  .r-name { font-weight: 700; color: #1e293b; font-size: 1.05rem; }
  .r-name.off { color: #cbd5e1; text-decoration: line-through; }
  
  .badge-warn { background: #fffbeb; color: #b45309; font-size: 0.65rem; padding: 3px 8px; border-radius: 6px; font-weight: 800; border: 1px solid #fde68a; display: flex; align-items: center; gap: 4px; }
  .arrival-info { font-size: 0.75rem; color: #2563eb; margin-top: 6px; display: flex; align-items: center; gap: 5px; background: #eff6ff; padding: 4px 10px; border-radius: 6px; width: fit-content; }
  .no-arrival { font-size: 0.75rem; color: #94a3b8; margin-top: 6px; display: flex; align-items: center; gap: 5px; }
  .esgotado { color: #ef4444; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; }

  /* Carrinho Lateral */
  .card { background: white; border-radius: 28px; border: 1px solid #e2e8f0; display: flex; flex-direction: column; height: 82vh; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.05); overflow: hidden; }
  .card-head { padding: 1.5rem; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 12px; background: #fafafa; }
  .card-head h2 { font-size: 1rem; margin: 0; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; }

  .cart-body { flex: 1; overflow-y: auto; padding: 1.5rem; }
  .cart-item { padding: 1.25rem; background: #ffffff; border-radius: 18px; margin-bottom: 1rem; border: 1px solid #eef2f6; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02); }
  .name { font-weight: 700; color: #1e293b; display: block; margin-bottom: 10px; }
  .item-info input { width: 100%; padding: 10px; border: 1px solid #e2e8f0; border-radius: 10px; font-size: 0.85rem; background: #f8fafc; }
  
  .item-ctrl { display: flex; justify-content: space-between; align-items: center; margin-top: 14px; }
  .stepper { display: flex; background: #f1f5f9; border-radius: 12px; padding: 4px; align-items: center; }
  .stepper button { border: none; background: white; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; font-weight: bold; color: #2563eb; }
  .stepper input { width: 45px; text-align: center; border: none; background: transparent; font-weight: 800; font-size: 1rem; }
  .del-btn { background: #fee2e2; color: #ef4444; border: none; padding: 8px; border-radius: 10px; cursor: pointer; transition: 0.2s; }
  .del-btn:hover { background: #ef4444; color: white; }

  /* Finalização */
  .card-footer { padding: 1.5rem; background: #fafafa; border-top: 1px solid #eef2f6; }
  .card-footer.dim { opacity: 0.4; filter: grayscale(1); pointer-events: none; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.2rem; margin-bottom: 1.2rem; }
  .input-box { display: flex; flex-direction: column; gap: 8px; }
  label { font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; }
  select, input[type="date"] { padding: 12px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; font-weight: 600; color: #1e293b; }

  .turno-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .t-btn { padding: 14px 5px; border-radius: 12px; border: 1px solid #e2e8f0; background: white; cursor: pointer; font-size: 0.8rem; font-weight: 700; color: #64748b; transition: 0.2s; }
  .t-btn.active { background: #2563eb; color: white; border-color: #2563eb; box-shadow: 0 8px 15px -3px rgba(37, 99, 235, 0.3); }

  .noite-info { background: #eff6ff; color: #1e40af; padding: 12px; border-radius: 12px; font-size: 0.8rem; margin-top: 1.2rem; display: flex; gap: 10px; align-items: center; border: 1px solid #bfdbfe; }

  .confirm-btn { width: 100%; margin-top: 1.5rem; padding: 22px; border-radius: 18px; border: none; background: #2563eb; color: white; font-weight: 900; font-size: 1.1rem; cursor: pointer; transition: 0.3s; letter-spacing: 1px; }
  .confirm-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 30px -5px rgba(37, 99, 235, 0.4); }
  .confirm-btn:disabled { background: #cbd5e1; cursor: not-allowed; }

  /* Overlay Sucesso */
  .success-overlay { position: absolute; inset: 0; background: white; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 3rem; text-align: center; z-index: 200; }
  .check-anim { animation: bounce 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
  .success-overlay h3 { color: #16a34a; font-size: 1.8rem; margin-bottom: 0.5rem; }
  .btn-novo { margin-top: 2.5rem; padding: 14px 30px; border-radius: 14px; border: 2px solid #16a34a; background: white; color: #16a34a; font-weight: 800; cursor: pointer; }

  @keyframes bounce { 0% { transform: scale(0.3); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
  .empty-msg { text-align: center; color: #cbd5e1; padding: 6rem 2rem; display: flex; flex-direction: column; align-items: center; gap: 1.5rem; }
</style>