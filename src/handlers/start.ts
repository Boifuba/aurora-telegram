import { Bot, InlineKeyboard } from 'grammy'
import { montarLeitura } from './leitura.js'
import { getRaizes } from '../lib/nodes.js'

export const BOT_USERNAME = 'princesadevassabot'

type Menu = { texto: string; kb: InlineKeyboard }

// Menu principal numa única mensagem: todas as raízes na ordem em que
// `getRaizes` as retorna + o botão "Surpreenda-me" no fim.
export async function construirMenuPrincipal(): Promise<Menu> {
  const raizes = await getRaizes()

  const kb = new InlineKeyboard()
  for (const r of raizes) kb.text(r.title.trim(), `nav:${r.id}`).row()
  kb.text('🎲 Surpreenda-me', 'surpresa')

  return {
    texto: '✨ *Bem-vinda à Princesa Devassa!*\n\nEscolha abaixo o que quer ler 👇',
    kb,
  }
}

// Envia o menu como uma única mensagem no chat atual.
export async function enviarMenuPrincipal(ctx: any) {
  const { texto, kb } = await construirMenuPrincipal()
  await ctx.reply(texto, { parse_mode: 'Markdown', reply_markup: kb })
}

export function registrarStart(bot: Bot) {
  bot.command('start', async (ctx) => {
    const payload = (ctx.match ?? '').trim()

    // Deep link vindo do canal: /start ler_<id> abre a história direto
    const deepLinkLer = payload.match(/^ler_(.+)$/)
    if (deepLinkLer && ctx.chat.type === 'private') {
      const leitura = await montarLeitura(deepLinkLer[1], 0, ctx.from?.id, 'canal')

      if (leitura.ok) {
        try {
          await ctx.reply(leitura.texto, { parse_mode: 'Markdown', reply_markup: leitura.kb })
        } catch {
          await ctx.reply(leitura.texto.replace(/\*/g, ''), { reply_markup: leitura.kb })
        }
        return
      }
      // História não encontrada — cai no menu normal
    }

    const isGrupo = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup'

    if (!isGrupo) {
      // No privado responde normalmente
      await enviarMenuPrincipal(ctx)
      return
    }

    // No grupo tenta mandar DM
    try {
      const { texto, kb } = await construirMenuPrincipal()
      await ctx.api.sendMessage(ctx.from!.id, texto, { parse_mode: 'Markdown', reply_markup: kb })
      // Apaga o comando do grupo se tiver permissão
      await ctx.deleteMessage().catch(() => {})
    } catch {
      // Usuário nunca abriu o bot — manda link no grupo
      const linkKb = new InlineKeyboard()
        .url('💬 Abrir conversa', `https://t.me/${BOT_USERNAME}?start=inicio`)
      await ctx.reply(
        `${ctx.from?.first_name ? `*${ctx.from.first_name}*, ` : ''}clique abaixo para conversar comigo no privado! 💕`,
        { parse_mode: 'Markdown', reply_markup: linkKb }
      )
    }
  })
}
