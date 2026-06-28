import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      authorization: {
        params: {
          access_type: 'offline',
          prompt: 'consent',
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.compose',
          ].join(' '),
        },
      },
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password, user.password)
        if (!valid) return null
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          plan: user.plan,
          searchesRemaining: user.searchesRemaining,
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider !== 'google') return true
      if (!user.email || !account.access_token) return false

      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      })
      if (!existingUser) return false

      const existingAccount = await prisma.googleAccount.findUnique({
        where: { userId: existingUser.id },
        select: { refreshToken: true, expiryDate: true },
      })
      if (!existingAccount && !account.refresh_token) return false

      await prisma.googleAccount.upsert({
        where: { userId: existingUser.id },
        update: {
          providerAccountId: account.providerAccountId,
          accessToken: account.access_token,
          refreshToken: account.refresh_token || existingAccount?.refreshToken || null,
          expiryDate: account.expires_at
            ? new Date(account.expires_at * 1000)
            : existingAccount?.expiryDate || null,
          scope: account.scope || null,
        },
        create: {
          userId: existingUser.id,
          providerAccountId: account.providerAccountId,
          accessToken: account.access_token,
          refreshToken: account.refresh_token || null,
          expiryDate: account.expires_at ? new Date(account.expires_at * 1000) : null,
          scope: account.scope || null,
        },
      })

      return true
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const databaseUser = await prisma.user.findUnique({
          where: { email: user.email },
          select: { id: true, plan: true, searchesRemaining: true },
        })

        if (databaseUser) {
          token.id = databaseUser.id
          token.plan = databaseUser.plan
          token.searchesRemaining = databaseUser.searchesRemaining
        }
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).plan = token.plan
        ;(session.user as any).searchesRemaining = token.searchesRemaining
      }
      return session
    },
  },
}
