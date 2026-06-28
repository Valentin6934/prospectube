import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import Anthropic from '@anthropic-ai/sdk'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function getCurrentUser() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null

  return prisma.user.findUnique({ where: { email: session.user.email } })
}

function canGenerateCampaignEmails(plan: string) {
  return plan === 'Pro' || plan === 'Agence'
}

async function generateMessage(prospect: {
  name: string
  email: string | null
  instagram: string | null
  tiktok: string | null
  twitch: string | null
  website: string | null
  channelUrl: string | null
  score: number | null
  scoreLabel: string | null
  scoreReason: string | null
}) {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 700,
    messages: [
      {
        role: 'user',
        content: `Tu es un monteur vidéo freelance qui prospecte des créateurs YouTube.

Génère un message de prospection court, naturel et personnalisé pour ce prospect :

Nom : ${prospect.name}
Email : ${prospect.email || 'Non trouvé'}
Instagram : ${prospect.instagram || 'Non trouvé'}
TikTok : ${prospect.tiktok || 'Non trouvé'}
Twitch : ${prospect.twitch || 'Non trouvé'}
Site web : ${prospect.website || 'Non trouvé'}
Chaîne YouTube : ${prospect.channelUrl || 'Non trouvé'}
Score prospect : ${prospect.score || 0}/100
Label score : ${prospect.scoreLabel || 'Non trouvé'}
Raison score : ${prospect.scoreReason || 'Non trouvé'}

Règles :
- Message court : maximum 120 mots
- Ton professionnel mais humain
- Propose clairement ton aide pour améliorer le montage vidéo
- Ne dis pas "je suis une IA"
- Ne force pas trop la vente
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
      .trim() || `Collaboration avec ${prospect.name}`
  const body = lines.slice(1).join('\n').trim()

  return { subject, body }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Non connecté' }, { status: 401 })

  if (!canGenerateCampaignEmails(user.plan)) {
    return NextResponse.json({ error: 'Plan Pro requis', upgrade: true }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const prospectIds = Array.isArray(body.prospectIds)
    ? body.prospectIds.filter((id: unknown): id is string => typeof id === 'string' && id.trim().length > 0)
    : []

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: params.id,
      userId: user.id,
    },
    include: {
      prospects: {
        where: {
          generatedBody: null,
          ...(prospectIds.length > 0 ? { id: { in: prospectIds } } : {}),
        },
        orderBy: { createdAt: 'asc' },
        take: 20,
      },
    },
  })

  if (!campaign) {
    return NextResponse.json({ error: 'Campagne introuvable' }, { status: 404 })
  }

  const generated = []

  for (const prospect of campaign.prospects) {
    const result = await generateMessage(prospect)
    const updated = await prisma.campaignProspect.update({
      where: { id: prospect.id },
      data: {
        generatedSubject: result.subject,
        generatedBody: result.body,
        status: 'Message généré',
      },
    })
    generated.push(updated)
  }

  return NextResponse.json({ generated })
}
