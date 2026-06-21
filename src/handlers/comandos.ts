import { Bot } from 'grammy'

const ADMIN_USER_ID = parseInt(process.env.ADMIN_USER_ID ?? '0', 10)

// Liberado para o dono (ADMIN_USER_ID) e a @rafaella16s2.
const USERNAMES_LIBERADOS = ['rafaella16s2']

function autorizado(ctx: any): boolean {
  const id = ctx.from?.id
  const username = (ctx.from?.username ?? '').toLowerCase()
  if (ADMIN_USER_ID && id === ADMIN_USER_ID) return true
  return USERNAMES_LIBERADOS.includes(username)
}

export function registrarComandos(bot: Bot) {
  // /comandos — lista os comandos do bot com explicação (só no privado)
  bot.command('comandos', async (ctx) => {
    if (ctx.chat.type !== 'private') return
    if (!autorizado(ctx)) return

    const msg = [
      '🛠 *Comandos disponíveis*',
      '',
      '📖 */start* — abre o menu de leitura (é o que as leitoras usam).',
      '🗂 */comandos* — mostra esta lista.',
      '',
      '*Painel e dados*',
      '📊 */painel* — números gerais: membros do canal, usuários do bot, leitores e total de leituras.',
      '',
      '*Publicar no canal*',
      '🗣 */falar <texto>* — publica a mensagem no canal em nome do bot (Markdown suportado).',
      '🎲 */sugerir* — publica agora uma sugestão de conto aleatório no canal.',
      '',
      '*Mensagem no privado de todos*',
      '📣 */avisar* — responda a uma mensagem com este comando para enviá-la no privado de todos os usuários (com confirmação antes de disparar). _Só o admin._',
    ].join('\n')

    await ctx.reply(msg, { parse_mode: 'Markdown' })
  })
}
