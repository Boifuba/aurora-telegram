import { Bot } from 'grammy'
import { supabase } from '../lib/supabase.js'

const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID ?? '0', 10)
const CANAL_ID = process.env.CANAL_ID ?? ''

// Liberado para o dono (ADMIN_USER_ID) e a @rafaella16s2.
const USERNAMES_LIBERADOS = ['rafaella16s2']

function autorizado(ctx: any): boolean {
  const id = ctx.from?.id
  const username = (ctx.from?.username ?? '').toLowerCase()
  if (ADMIN_USER_ID && id === ADMIN_USER_ID) return true
  return USERNAMES_LIBERADOS.includes(username)
}

export function registrarPainel(bot: Bot) {
  // /painel — panorama geral de números (só no privado)
  bot.command('painel', async (ctx) => {
    if (ctx.chat.type !== 'private') return
    if (!autorizado(ctx)) return

    // Membros do canal (vem direto do Telegram)
    let membrosCanal: number | null = null
    if (CANAL_ID) {
      try {
        membrosCanal = await ctx.api.getChatMemberCount(CANAL_ID)
      } catch {
        membrosCanal = null
      }
    }

    // Usuários do bot (tabela usuarios)
    const { count: totalUsuarios } = await supabase
      .from('usuarios')
      .select('user_id', { count: 'exact', head: true })
    const { count: bloqueados } = await supabase
      .from('usuarios')
      .select('user_id', { count: 'exact', head: true })
      .eq('ativo', false)

    // Total de leituras
    const { count: totalLeituras } = await supabase
      .from('leituras')
      .select('*', { count: 'exact', head: true })

    // Leitores únicos (dedup pelo user_id)
    const { data: linhasLeitores } = await supabase
      .from('leituras')
      .select('user_id')
      .range(0, 99999)
    const leitoresUnicos = new Set((linhasLeitores ?? []).map((l) => l.user_id)).size

    const ativos = (totalUsuarios ?? 0) - (bloqueados ?? 0)

    const linhas = [
      '📊 *Painel*',
      '',
      `📣 Membros do canal: *${membrosCanal ?? '—'}*`,
      '',
      `👥 Usuários do bot: *${totalUsuarios ?? 0}*`,
      `   • Ativos: *${ativos}*  ·  🚫 Bloquearam: *${bloqueados ?? 0}*`,
      '',
      `📖 Leitores únicos: *${leitoresUnicos}*`,
      `📚 Total de leituras: *${totalLeituras ?? 0}*`,
    ]

    try {
      await ctx.reply(linhas.join('\n'), { parse_mode: 'Markdown' })
    } catch {
      await ctx.reply(linhas.join('\n').replace(/[*_]/g, ''))
    }
  })
}
