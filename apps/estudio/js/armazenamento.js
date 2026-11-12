/* =====================================================================
   ESTÚDIO · ARMAZENAMENTO (E1)
   Única porta de entrada para guardar e ler as consultas.
   Hoje: navegador (localStorage), como o resto do modo demonstração.
   Depois (frente F15): o mesmo carregar/salvar/zerar passa a chamar a
   API do módulo, que grava no Neon — as telas não mudam.
   ===================================================================== */
const Armazenamento = (() => {
  const CHAVE = 'lsw-estudio-consultas-v1';
  const LIMITE_BYTES = 4 * 1024 * 1024; // o navegador costuma aceitar ~5 MB por site

  async function carregar() {
    try { const t = localStorage.getItem(CHAVE); return t ? JSON.parse(t) : null; }
    catch { return null; }
  }
  // Devolve { ok: true } ou { ok: false, erro: 'mensagem em português' }
  async function salvar(estado) {
    try {
      const texto = JSON.stringify(estado);
      if (texto.length > LIMITE_BYTES) return { ok: false, erro: 'As consultas passaram de 4 MB, o limite do navegador. Remova uma consulta grande. Com o banco (Neon) esse limite deixa de existir.' };
      localStorage.setItem(CHAVE, texto);
      return { ok: true };
    } catch {
      return { ok: false, erro: 'O navegador não deixou salvar (janela anônima ou armazenamento cheio). As mudanças valem só enquanto esta aba estiver aberta.' };
    }
  }
  async function zerar() { try { localStorage.removeItem(CHAVE); } catch { /* sem armazenamento: nada a apagar */ } }

  return { carregar, salvar, zerar, onde: 'navegador' };
})();
