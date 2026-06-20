import { Bot } from 'grammy'
import { supabase } from '../lib/supabase.js'
import { getNo } from '../lib/nodes.js'

const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID ?? '0', 10)

// Quem pode pedir /analytics: o dono (ADMIN_USER_ID) e a @rafaella16s2.
const USERNAMES_LIBERADOS = ['rafaella16s2']

function autorizado(ctx: any): boolean {
  const id = ctx.from?.id
  const username = (ctx.from?.username ?? '').toLowerCase()
  if (ADMIN_USER_ID && id === ADMIN_USER_ID) return true
  return USERNAMES_LIBERADOS.includes(username)
}

export function registrarAnalytics(bot: Bot) {
  bot.command('analytics', async (ctx) => {
    // Só no privado e só para quem está liberado — caso contrário, ignora em silêncio.
    if (ctx.chat?.type !== 'private') return
    if (!autorizado(ctx)) return

    // Total de leituras (aberturas registradas).
    const { count: total, error: errTotal } = await supabase
      .from('leituras')
      .select('*', { count: 'exact', head: true })

    if (errTotal) {
      await ctx.reply(`Erro ao consultar as leituras: ${errTotal.message}`)
      return
    }

    // Aberturas por conto. Range alto para não cair no limite padrão de 1000 linhas.
    const { data, error } = await supabase
      .from('leituras')
      .select('post_id')
      .range(0, 49999)

    if (error) {
      await ctx.reply(`Erro ao consultar as leituras: ${error.message}`)
      return
    }

    const contagem = new Map<string, number>()
    for (const row of data ?? []) {
      contagem.set(row.post_id, (contagem.get(row.post_id) ?? 0) + 1)
    }

    if (contagem.size === 0) {
      await ctx.reply(`📊 *Analytics*\n\nTotal de leituras: *0*\n\nNenhuma leitura registrada ainda.`, {
        parse_mode: 'Markdown',
      })
      return
    }

    // Resolve o título de cada conto e ordena do mais lido para o menos lido.
    const linhas: { titulo: string; n: number }[] = []
    for (const [postId, n] of contagem) {
      const no = await getNo(postId)
      linhas.push({ titulo: no?.title?.trim() || postId, n })
    }
    linhas.sort((a, b) => b.n - a.n)

    const cabecalho =
      `📊 *Leituras*\n` +
      `Total: *${total ?? 0}*\n\n`

    const plural = (n: number) => (n === 1 ? 'leitura' : 'leituras')
    const corpo = linhas.map((l) => `${l.titulo}: ${l.n} ${plural(l.n)}`).join('\n')

    // Telegram limita a mensagem a ~4096 chars; quebra em pedaços se precisar.
    const texto = cabecalho + corpo
    if (texto.length <= 4000) {
      await ctx.reply(texto, { parse_mode: 'Markdown' })
      return
    }

    await ctx.reply(cabecalho, { parse_mode: 'Markdown' })
    let buffer = ''
    for (const linha of corpo.split('\n')) {
      if (buffer.length + linha.length + 1 > 4000) {
        await ctx.reply(buffer, { parse_mode: 'Markdown' })
        buffer = ''
      }
      buffer += (buffer ? '\n' : '') + linha
    }
    if (buffer) await ctx.reply(buffer, { parse_mode: 'Markdown' })
  })
}
