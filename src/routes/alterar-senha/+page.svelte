<script lang="ts">
  import { supabase } from '$lib/supabase';
  import { KeyRound, ShieldCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-svelte';
  import { fade, slide } from 'svelte/transition';

  let novaSenha = $state('');
  let confirmarSenha = $state('');
  let carregando = $state(false);
  let mensagem = $state({ texto: '', tipo: '' });

  async function atualizarSenha() {
    // Validações básicas
    if (novaSenha !== confirmarSenha) {
      mensagem = { texto: "As senhas não coincidem!", tipo: "erro" };
      return;
    }
    if (novaSenha.length < 6) {
      mensagem = { texto: "A senha deve ter no mínimo 6 caracteres.", tipo: "erro" };
      return;
    }

    carregando = true;
    mensagem = { texto: '', tipo: '' };

    const { error } = await supabase.auth.updateUser({ 
      password: novaSenha 
    });

    if (error) {
      mensagem = { texto: "Erro: " + error.message, tipo: "erro" };
    } else {
      mensagem = { texto: "Senha atualizada com sucesso!", tipo: "sucesso" };
      novaSenha = ''; 
      confirmarSenha = '';
    }
    carregando = false;
  }
</script>

<div class="password-page">
  <div class="card shadow-lg" in:fade>
    <header>
      <div class="icon-box"><ShieldCheck size={24} color="white" /></div>
      <div class="title-text">
        <h2>Segurança da Conta</h2>
        <p>Escolha uma senha forte para seu acesso</p>
      </div>
    </header>

    <form onsubmit={(e) => { e.preventDefault(); atualizarSenha(); }}>
      <div class="field">
        <label for="new-password">Nova Senha</label>
        <div class="input-container">
          <KeyRound size={18} class="input-icon" />
          <input 
            id="new-password"
            type="password" 
            bind:value={novaSenha} 
            placeholder="Mínimo 6 caracteres" 
            required 
          />
        </div>
      </div>

      <div class="field">
        <label for="confirm-password">Confirmar Nova Senha</label>
        <div class="input-container">
          <KeyRound size={18} class="input-icon" />
          <input 
            id="confirm-password"
            type="password" 
            bind:value={confirmarSenha} 
            placeholder="Repita a nova senha" 
            required 
          />
        </div>
      </div>

      {#if mensagem.texto}
        <div class="msg-box {mensagem.tipo}" transition:slide>
          {#if mensagem.tipo === 'erro'}
            <AlertCircle size={18} />
          {:else}
            <CheckCircle2 size={18} />
          {/if}
          <span>{mensagem.texto}</span>
        </div>
      {/if}

      <button type="submit" class="btn-primary" disabled={carregando}>
        {#if carregando}
          <Loader2 class="spin" size={20} />
          <span>Atualizando...</span>
        {:else}
          Atualizar Senha
        {/if}
      </button>
    </form>
  </div>
</div>

<style>
  .password-page {
    display: flex;
    justify-content: center;
    padding-top: 3rem;
  }

  .card {
    background: white;
    padding: 2.5rem;
    border-radius: 20px;
    width: 100%;
    max-width: 420px;
    border: 1px solid #e2e8f0;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05);
  }

  header {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 2rem;
  }

  .icon-box {
    background: #0284c7;
    padding: 12px;
    border-radius: 14px;
    display: flex;
    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.2);
  }

  .title-text h2 {
    font-size: 1.25rem;
    margin: 0;
    color: #0f172a;
  }

  .title-text p {
    font-size: 0.85rem;
    color: #64748b;
    margin: 2px 0 0;
  }

  .field {
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  label {
    font-size: 0.75rem;
    font-weight: 700;
    color: #475569;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .input-container {
    display: flex;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 0 1rem;
    transition: 0.2s;
  }

  .input-container:focus-within {
    border-color: #0284c7;
    background: white;
    box-shadow: 0 0 0 4px rgba(2, 132, 199, 0.1);
  }

  .input-icon {
    color: #94a3b8;
  }

  input {
    border: none;
    background: transparent;
    padding: 12px;
    width: 100%;
    outline: none;
    font-size: 0.95rem;
    color: #1e293b;
  }

  .btn-primary {
    width: 100%;
    background: #0284c7;
    color: white;
    border: none;
    padding: 14px;
    border-radius: 12px;
    font-weight: 700;
    font-size: 1rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    transition: 0.2s;
    margin-top: 1rem;
  }

  .btn-primary:hover:not(:disabled) {
    background: #0369a1;
    transform: translateY(-1px);
  }

  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .msg-box {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 10px;
    font-size: 0.85rem;
    font-weight: 600;
    margin-bottom: 1.5rem;
  }

  .erro { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
  .sucesso { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }

  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>