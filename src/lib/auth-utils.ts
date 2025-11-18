import { auth } from './auth'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export async function getServerSession() {
  return await auth()
}

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/signin')
  }
  return session
}

export async function getCurrentUser() {
  const session = await auth()
  if (!session?.user?.id) {
    return null
  }

  return prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      emailAccounts: true,
    },
  })
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createUser(email: string, password: string, name?: string) {
  const hashedPassword = await hashPassword(password)

  return prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
    },
  })
}
