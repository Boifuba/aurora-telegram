import { Bot, InlineKeyboard } from 'grammy'
import { getFolhasPublicadas, getNo, type NodeMeta } from '../lib/nodes.js'
import { BOT_USERNAME } from './start.js'

const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID ?? '0', 10)
const CANAL_ID = process.env.CANAL_ID ?? ''
const INTERVALO_MS = 8 * 60 * 60 * 1000 // 8 horas
const HISTORICO_MAX = 10 // não repete as últimas N histórias sorteadas
const MAX_RESULTADOS = 8 // botões mostrados na busca

// Liberado para o dono (ADMIN_USER_ID) e a @rafaella16s2.
const USERNAMES_LIBERADOS = ['rafaella16s2']

function autorizado(ctx: any): boolean {
  const id = ctx.from?.id
  const username = (ctx.from?.username ?? '').toLowerCase()
  if (ADMIN_USER_ID && id === ADMIN_USER_ID) return true
  return USERNAMES_LIBERADOS.includes(username)
}

// Normaliza para busca: sem acento, minúsculo.
const normalizar = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const truncar = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

const ultimosPostados: string[] = []

// Edita a mensagem em Markdown; se o título/descrição tiverem markup inválido,
// reenvia sem formatação.
async function editarSeguro(ctx: any, texto: string, kb?: InlineKeyboard) {
  try {
    await ctx.editMessageText(texto, { parse_mode: 'Markdown', reply_markup: kb })
  } catch {
    await ctx.editMessageText(texto.replace(/[*_`]/g, ''), { reply_markup: kb })
  }
}

// Publica um conto específico no canal (usado pelo sorteio e pela busca).
async function postarConto(bot: Bot, no: NodeMeta) {
  const teaser = no.description?.trim()
  const texto =
    `📖 *Sugestão de leitura*\n\n*${no.title}*` + (teaser ? `\n\n_${teaser}_` : '')

  const kb = new InlineKeyboard().url(
    '👀 Você já leu essa história?',
    `https://t.me/${BOT_USERNAME}?start=ler_${no.id}`
  )

  try {
    await bot.api.sendMessage(CANAL_ID, texto, { parse_mode: 'Markdown', reply_markup: kb })
  } catch {
    // Markdown inválido no título/descrição — envia sem formatação
    await bot.api.sendMessage(CANAL_ID, texto.replace(/[*_]/g, ''), { reply_markup: kb })
  }
}

export async function postarSugestao(bot: Bot) {
  const folhas = await getFolhasPublicadas()
  if (!folhas.length) return

  const candidatos = folhas.filter((p) => !ultimosPostados.includes(p.id))
  const pool = candidatos.length ? candidatos : folhas
  const sorteado = pool[Math.floor(Math.random() * pool.length)]

  ultimosPostados.push(sorteado.id)
  if (ultimosPostados.length > HISTORICO_MAX) ultimosPostados.shift()

  await postarConto(bot, sorteado)
}

export function registrarDivulgacao(bot: Bot) {
  // /sugerir            → sorteia um conto aleatório e publica (como antes)
  // /sugerir <título>   → busca contos pelo título e deixa escolher qual publicar
  bot.command('sugerir', async (ctx) => {
    if (ctx.chat.type !== 'private') return
    if (!autorizado(ctx)) return

    if (!CANAL_ID) {
      await ctx.reply('⚙️ Defina CANAL_ID no .env para usar a divulgação.')
      return
    }

    const termo = (ctx.match ?? '').trim()

    // Sem termo: sorteio aleatório imediato.
    if (!termo) {
      try {
        await postarSugestao(bot)
        await ctx.reply('✅ Sugestão publicada no canal!')
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'desconhecido'
        await ctx.reply(`❌ Erro ao publicar: ${msg}`)
      }
      return
    }

    // Com termo: busca por título.
    const alvo = normalizar(termo)
    const folhas = await getFolhasPublicadas()
    const matches = folhas.filter((f) => normalizar(f.title).includes(alvo))

    if (!matches.length) {
      await ctx.reply(`🔎 Nenhum conto encontrado com "${termo}".`)
      return
    }

    const mostra = matches.slice(0, MAX_RESULTADOS)
    const kb = new InlineKeyboard()
    for (const m of mostra) kb.text(truncar(m.title, 60), `sug:${m.id}`).row()

    const aviso =
      matches.length > MAX_RESULTADOS
        ? `\n\n_Mostrando ${MAX_RESULTADOS} de ${matches.length}. Refine a busca se não achar._`
        : ''

    await ctx.reply(`🔎 Escolha o conto para sugerir no canal:${aviso}`, {
      parse_mode: 'Markdown',
      reply_markup: kb,
    })
  })

  // Clicou num resultado da busca → pede confirmação.
  bot.callbackQuery(/^sug:(.+)$/, async (ctx) => {
    if (!autorizado(ctx)) {
      await ctx.answerCallbackQuery()
      return
    }
    const id = ctx.match[1]
    const no = await getNo(id)
    await ctx.answerCallbackQuery()
    if (!no) {
      await ctx.editMessageText('❌ Conto não encontrado (pode ter saído do ar).')
      return
    }
    const kb = new InlineKeyboard()
      .text('✅ Publicar', `sugok:${id}`)
      .text('❌ Cancelar', 'sugno')
    await editarSeguro(ctx, `Publicar *${no.title}* no canal?`, kb)
  })

  // Confirmou → publica o conto escolhido.
  bot.callbackQuery(/^sugok:(.+)$/, async (ctx) => {
    if (!autorizado(ctx)) {
      await ctx.answerCallbackQuery()
      return
    }
    const id = ctx.match[1]
    const no = await getNo(id)
    await ctx.answerCallbackQuery()
    if (!no) {
      await ctx.editMessageText('❌ Conto não encontrado (pode ter saído do ar).')
      return
    }
    try {
      await postarConto(bot, no)
      await editarSeguro(ctx, `✅ Publicado no canal: *${no.title}*`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'desconhecido'
      await ctx.editMessageText(`❌ Erro ao publicar: ${msg}`)
    }
  })

  bot.callbackQuery('sugno', async (ctx) => {
    if (!autorizado(ctx)) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    await ctx.editMessageText('❌ Cancelado.')
  })

  // Agendador: uma sugestão a cada 8 horas
  if (!CANAL_ID) {
    console.warn('CANAL_ID não definido — divulgação automática desativada.')
    return
  }

  setInterval(() => {
    postarSugestao(bot).catch((err) => console.error('Erro na divulgação automática:', err))
  }, INTERVALO_MS)
}
