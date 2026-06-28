import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import Anthropic from '@anthropic-ai/sdk'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isPro, requireProResponse } from '@/lib/plan'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Non connecté' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { plan: true },
  })
  if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  if (!isPro(user.plan)) return requireProResponse()

  const { channel, editorEmail } = await req.json()

  const contactInfos = `
Email trouvé : ${channel.email || 'Non trouvé'}
Instagram : ${channel.instagram || 'Non trouvé'}
TikTok : ${channel.tiktok || 'Non trouvé'}
Twitch : ${channel.twitch || 'Non trouvé'}
Site web : ${channel.website || 'Non trouvé'}
Chaîne YouTube : ${channel.channelUrl || 'Non trouvé'}
Score prospect : ${channel.score || 0}/100
Label score : ${channel.scoreLabel || 'Non trouvé'}
Raison score : ${channel.scoreReason || 'Non trouvé'}
Vues totales : ${channel.totalViews ?? 'Non trouvé'}
Nombre de vidéos : ${channel.videoCount ?? 'Non trouvé'}
Date création : ${channel.createdAt || 'Non trouvé'}
`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 700,
    messages: [
      {
        role: 'user',
        content: `Tu es un monteur vidéo freelance qui prospecte des YouTubeurs.

Génère un message de prospection court, naturel et personnalisé pour cette chaîne :

Nom : ${channel.name}
Niche : ${channel.niche}
Abonnés : ${channel.subs}
Fréquence : ${channel.freq}
Description : ${channel.desc}
Langue : ${channel.lang}

Infos disponibles :
${contactInfos}

Règles :
- Message court : maximum 120 mots
- Ton professionnel mais humain
- Montre que tu as compris leur contenu
- Propose clairement ton aide pour améliorer le montage vidéo
- Ne dis pas "je suis une IA"
- Ne force pas trop la vente
- Termine avec cet email de contact : ${editorEmail}
- Écris dans cette langue : ${channel.lang}
- Format exact :
Objet: [sujet]

[corps du message]`,
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const lines = text.split('\n')

  const subject =
    lines[0]
      ?.replace('Objet:', '')
      .replace('Subject:', '')
      .trim() || `Collaboration avec ${channel.name}`

  const body = lines.slice(1).join('\n').trim()

  return NextResponse.json({ subject, body })
}
