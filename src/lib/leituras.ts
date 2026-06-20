import { supabase } from './supabase.js'

export type OrigemLeitura = 'canal' | 'bot'

// Registra a ABERTURA de um conto (página 0) na tabela `leituras`.
// Fire-and-forget: qualquer erro é apenas logado, nunca interrompe a leitura.
export function registrarAbertura(
  userId: number | undefined,
  postId: string,
  origem: OrigemLeitura,
): void {
  if (!userId) return
  supabase
    .from('leituras')
    .insert({ user_id: userId, post_id: postId, pagina: 0, origem })
    .then(({ error }) => {
      if (error) console.error('[leituras] erro ao registrar abertura:', error.message)
    })
}
