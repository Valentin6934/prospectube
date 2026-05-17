import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import Anthropic from '@anthropic-ai/sdk'
export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await getServerSession()
  if (!session?.user?.email) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  const { channel, editorEmail } = await req.json()

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 500,
    messages: [{
      role: 'user',
      content: `Tu es un monteur vidéo freelance qui prospecte des YouTubeurs. Génère un email de prospection court, naturel et personnalisé pour cette chaîne :

Nom : ${channel.name}
Niche : ${channel.niche}
Abonnés : ${channel.subs}
Fréquence : ${channel.freq}
Description : ${channel.desc}
Langue : ${channel.lang}

Règles :
- Email court (max 120 mots)
- Ton professionnel mais humain
- Montre que tu connais leur contenu
- Propose clairement ton aide pour le montage
- Termine avec l'email : ${editorEmail}
- Écris en ${channel.lang}
- Format : Objet: [sujet]\n\n[corps]`
    }]
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const lines = text.split('\n')
  const subject = lines[0].replace('Objet:', '').replace('Subject:', '').trim()
  const body = lines.slice(2).join('\n').trim()

  return NextResponse.json({ subject, body })
}
