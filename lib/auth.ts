import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from '@/lib/prisma'
import { getPlanName } from '@/lib/plan'
import { normalizeAccountEmail } from '@/lib/registration'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Mot de passe', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null
        try {
          const user = await prisma.user.findUnique({
            where: { email: normalizeAccountEmail(credentials.email) },
          })
          if (!user) {
            console.warn({ event: 'AUTH_USER_NOT_FOUND', environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown' })
            return null
          }
          const valid = await bcrypt.compare(credentials.password, user.password)
          if (!valid) {
            console.warn({ event: 'AUTH_INVALID_PASSWORD', userId: user.id, environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown' })
            return null
          }
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            plan: getPlanName(user.plan),
            searchesRemaining: user.searchesRemaining,
          }
        } catch (error) {
          const details = error && typeof error === 'object'
            ? error as { name?: unknown; code?: unknown; errorCode?: unknown }
            : {}
          console.error({
            event: 'AUTH_DATABASE_ERROR',
            errorName: typeof details.name === 'string' ? details.name : 'Error',
            prismaCode: typeof details.code === 'string'
              ? details.code
              : typeof details.errorCode === 'string' ? details.errorCode : undefined,
            environment: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
          })
          throw error
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.plan = getPlanName((user as any).plan)
        token.searchesRemaining = (user as any).searchesRemaining
      } else if (token.email) {
        const databaseUser = await prisma.user.findUnique({
          where: { email: token.email },
          select: { id: true, plan: true, searchesRemaining: true },
        })

        if (databaseUser) {
          token.id = databaseUser.id
          token.plan = getPlanName(databaseUser.plan)
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
