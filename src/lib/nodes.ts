import { supabase } from './supabase.js'

// Modelo de conteúdo do Aurora: uma árvore única (`nodes`) auto-referenciada.
// - Campos i18n são JSONB { pt, en }.
// - Um nó é CONTAINER (pasta) quando tem filhos; é FOLHA (leitura) quando não tem.
// - O texto completo (`content`) só é buscado sob demanda ao abrir uma folha.

const LOCALE = 'pt'
const CACHE_TTL = 5 * 60 * 1000 // 5 min

export interface NodeMeta {
  id: string
  parentId: string | null
  title: string
  description: string
  imageUrl: string | null
  position: number
  publishedDate: string | null
  cronological: number | null
}

interface NodeIndex {
  byId: Map<string, NodeMeta>
  childrenByParent: Map<string | null, NodeMeta[]>
  leaves: NodeMeta[] // nós sem filhos (leituras)
}

// Extrai a string localizada de um campo JSONB { pt, en }.
function loc(json: any, locale = LOCALE): string {
  if (!json) return ''
  if (typeof json === 'string') return json
  return json[locale] || json.pt || json.en || ''
}

let cache: { idx: NodeIndex; at: number } | null = null

async function carregarIndice(): Promise<NodeIndex> {
  // A RLS da tabela `nodes` já filtra is_draft=false AND is_hidden=false para anon.
  const { data, error } = await supabase
    .from('nodes')
    .select('id, parent_id, title, description, image_url, position, published_date, cronological')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  const byId = new Map<string, NodeMeta>()
  const childrenByParent = new Map<string | null, NodeMeta[]>()

  if (error) {
    console.error('[nodes] erro ao carregar índice:', error.message)
    return { byId, childrenByParent, leaves: [] }
  }

  for (const row of data ?? []) {
    const n: NodeMeta = {
      id: row.id,
      parentId: row.parent_id,
      title: loc(row.title),
      description: loc(row.description),
      imageUrl: row.image_url,
      position: row.position ?? 0,
      publishedDate: row.published_date,
      cronological: row.cronological,
    }
    byId.set(n.id, n)
  }

  for (const n of byId.values()) {
    const arr = childrenByParent.get(n.parentId) ?? []
    arr.push(n)
    childrenByParent.set(n.parentId, arr)
  }
  for (const arr of childrenByParent.values()) {
    arr.sort((a, b) => a.position - b.position)
  }

  const leaves = [...byId.values()].filter((n) => !childrenByParent.has(n.id))

  return { byId, childrenByParent, leaves }
}

async function getIndice(): Promise<NodeIndex> {
  if (cache && Date.now() - cache.at < CACHE_TTL) return cache.idx
  const idx = await carregarIndice()
  cache = { idx, at: Date.now() }
  return idx
}

// Um nó é container quando tem filhos.
function ehContainer(idx: NodeIndex, id: string): boolean {
  return idx.childrenByParent.has(id)
}

export async function getRaizes(): Promise<NodeMeta[]> {
  const idx = await getIndice()
  return (idx.childrenByParent.get(null) ?? []).filter((n) => n.title)
}

export async function getNo(id: string): Promise<NodeMeta | undefined> {
  const idx = await getIndice()
  return idx.byId.get(id)
}

export async function getFilhos(id: string): Promise<NodeMeta[]> {
  const idx = await getIndice()
  return (idx.childrenByParent.get(id) ?? []).filter((n) => n.title)
}

export async function isContainer(id: string): Promise<boolean> {
  const idx = await getIndice()
  return ehContainer(idx, id)
}

// Próxima folha-irmã (mesmo pai, position seguinte) — usado para "continuar".
export async function getProximaFolhaIrma(id: string): Promise<NodeMeta | null> {
  const idx = await getIndice()
  const no = idx.byId.get(id)
  if (!no) return null
  const irmaos = idx.childrenByParent.get(no.parentId) ?? []
  const i = irmaos.findIndex((n) => n.id === id)
  for (let j = i + 1; j < irmaos.length; j++) {
    if (!ehContainer(idx, irmaos[j].id)) return irmaos[j]
  }
  return null
}

export async function getFolhaAleatoria(): Promise<NodeMeta | null> {
  const idx = await getIndice()
  if (!idx.leaves.length) return null
  return idx.leaves[Math.floor(Math.random() * idx.leaves.length)]
}

export async function getFolhasPublicadas(): Promise<NodeMeta[]> {
  const idx = await getIndice()
  return idx.leaves.filter((n) => n.title)
}

// Busca o texto completo de uma folha (campo `content` JSONB) sob demanda.
export async function getConteudo(id: string): Promise<string> {
  const { data, error } = await supabase
    .from('nodes')
    .select('content')
    .eq('id', id)
    .single()
  if (error) {
    console.error('[nodes] erro ao buscar conteúdo:', error.message)
    return ''
  }
  return loc(data?.content)
}
