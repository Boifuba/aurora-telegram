import { Bot, InlineKeyboard } from 'grammy'
import { montarLeitura } from './leitura.js'
import { getRaizes } from '../lib/nodes.js'

export const BOT_USERNAME = 'princesadevassabot'

function ehDiario(titulo: string): boolean {
  return titulo.trim().toLowerCase().includes('diário de aventuras')
    || titulo.trim().toLowerCase().includes('diario de aventuras')
}

type Set = { texto: string; kb: InlineKeyboard }

// Menu principal em DOIS sets (duas mensagens separadas):
// Set 1 = "Leia o meu diário" (Diário de Aventuras);
// Set 2 = as demais raízes + surpresa.
export async function construirMenuPrincipal(): Promise<{ set1: Set; set2: Set }> {
  const raizes = await getRaizes()
  const diario = raizes.find((r) => ehDiario(r.title))
  const outras = raizes.filter((r) => r !== diario)

  const kb1 = new InlineKeyboard()
  if (diario) kb1.text('📖 Leia o meu diário', `nav:${diario.id}`)

  const kb2 = new InlineKeyboard()
  for (const r of outras) kb2.text(r.title.trim(), `nav:${r.id}`).row()
  kb2.text('🎲 Surpreenda-me', 'surpresa')

  const set1: Set = {
    texto: '✨ *Bem-vinda à Princesa Devassa!*\n\n📖 Leia o meu *diário de aventuras* 👇',
    kb: kb1,
  }
  const set2: Set = {
    texto: 'Ou, se quiser ler outras coisas, pensamentos etc., escolha abaixo 👇',
    kb: kb2,
  }

  return { set1, set2 }
}

// Envia o menu como duas mensagens (os dois sets) no chat atual.
export async function enviarMenuPrincipal(ctx: any) {
  const { set1, set2 } = await construirMenuPrincipal()
  await ctx.reply(set1.texto, { parse_mode: 'Markdown', reply_markup: set1.kb })
  await ctx.reply(set2.texto, { parse_mode: 'Markdown', reply_markup: set2.kb })
}

export function registrarStart(bot: Bot) {
  bot.command('start', async (ctx) => {
    const payload = (ctx.match ?? '').trim()

    // Deep link vindo do canal: /start ler_<id> abre a história direto
    const deepLinkLer = payload.match(/^ler_(.+)$/)
    if (deepLinkLer && ctx.chat.type === 'private') {
      const leitura = await montarLeitura(deepLinkLer[1], 0)

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
      const { set1, set2 } = await construirMenuPrincipal()
      await ctx.api.sendMessage(ctx.from!.id, set1.texto, { parse_mode: 'Markdown', reply_markup: set1.kb })
      await ctx.api.sendMessage(ctx.from!.id, set2.texto, { parse_mode: 'Markdown', reply_markup: set2.kb })
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
