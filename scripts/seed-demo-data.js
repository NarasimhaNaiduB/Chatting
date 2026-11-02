import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { applicationDefault, deleteApp, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getDatabase } from 'firebase-admin/database'
import { FieldValue, getFirestore, Timestamp } from 'firebase-admin/firestore'

const demoUsers = [
  { displayName: 'Maya Chen', email: 'chatter.demo.maya@example.com' },
  { displayName: 'Jordan Lee', email: 'chatter.demo.jordan@example.com' },
  { displayName: 'Avery Patel', email: 'chatter.demo.avery@example.com' },
]

function getDisplayNameTokens(displayName) {
  const words = displayName.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []
  return [...new Set(words.flatMap((word) => (
    Array.from({ length: word.length }, (_, index) => word.slice(0, index + 1))
  )))].slice(0, 80)
}

function getTimestamp(value, fallback) {
  const milliseconds = Date.parse(value || '')
  return Number.isFinite(milliseconds) ? milliseconds : fallback
}

function getEmailPrefix(email) {
  return email.split('@')[0] || 'Chatter user'
}

async function getOrCreateDemoUser(auth, demoUser, password) {
  try {
    const existing = await auth.getUserByEmail(demoUser.email)
    if (existing.displayName !== demoUser.displayName) {
      throw new Error(
        `A Firebase Auth account already uses ${demoUser.email} with a different display name. Refusing to modify it.`,
      )
    }

    return existing
  } catch (error) {
    if (error.code !== 'auth/user-not-found') throw error
  }

  return auth.createUser({
    email: demoUser.email,
    password,
    displayName: demoUser.displayName,
    emailVerified: true,
  })
}

async function writeUserProfiles(user, firestore, realtimeDatabase) {
  const displayName = (user.displayName || getEmailPrefix(user.email)).trim().slice(0, 80)
  const photoURL = user.photoURL || ''
  const now = Date.now()
  const profile = {
    uid: user.uid,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    displayNameTokens: getDisplayNameTokens(displayName),
    email: user.email || '',
    emailLower: user.email?.toLowerCase() || '',
    photoURL,
    updatedAt: FieldValue.serverTimestamp(),
  }
  const publicProfile = {
    uid: user.uid,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    displayNameTokens: getDisplayNameTokens(displayName),
    photoURL,
    updatedAt: FieldValue.serverTimestamp(),
  }

  const batch = firestore.batch()
  batch.set(firestore.collection('users').doc(user.uid), profile, { merge: true })
  batch.set(firestore.collection('publicProfiles').doc(user.uid), publicProfile, { merge: true })

  await Promise.all([
    batch.commit(),
    realtimeDatabase.ref(`users/${user.uid}`).update({
      uid: user.uid,
      email: user.email || '',
      displayName,
      photoURL,
      accountCreatedAt: getTimestamp(user.metadata.creationTime, now),
      lastLoginAt: getTimestamp(user.metadata.lastSignInTime, now),
      profileUpdatedAt: now,
    }),
  ])
}

async function seedConversation(firestore, owner, demoUser) {
  const participants = [owner.uid, demoUser.uid].sort()
  const conversationId = participants.join('_')
  const conversationRef = firestore.collection('conversations').doc(conversationId)
  const existing = await conversationRef.get()

  if (existing.exists) {
    console.log(`Kept existing conversation with ${demoUser.displayName}.`)
    return
  }

  const now = Date.now()
  const firstTime = Timestamp.fromMillis(now - 4 * 60 * 1000)
  const secondTime = Timestamp.fromMillis(now - 3 * 60 * 1000)
  const firstMessage = {
    senderId: demoUser.uid,
    text: 'Hey! Welcome to Chatter. How is your day going?',
    createdAt: firstTime,
  }
  const secondMessage = {
    senderId: owner.uid,
    text: 'Thanks! I am just trying out the chat.',
    createdAt: secondTime,
  }
  const batch = firestore.batch()

  batch.set(conversationRef, {
    participants,
    createdAt: firstTime,
    updatedAt: secondTime,
    lastMessage: secondMessage.text,
    lastMessageId: 'demo-welcome-reply',
    lastMessageAt: secondTime,
    lastSenderId: owner.uid,
  })
  batch.set(conversationRef.collection('messages').doc('demo-welcome-message'), firstMessage)
  batch.set(conversationRef.collection('messages').doc('demo-welcome-reply'), secondMessage)
  await batch.commit()

  console.log(`Created a sample conversation with ${demoUser.displayName}.`)
}

async function main() {
  const expectedProjectId = JSON.parse(
    readFileSync(new URL('../.firebaserc', import.meta.url), 'utf8'),
  ).projects?.default
  const projectId = process.env.SEED_FIREBASE_PROJECT_ID
  const ownerEmail = process.env.SEED_OWNER_EMAIL?.trim().toLowerCase()
  const demoPassword = process.env.DEMO_USER_PASSWORD
  const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  const confirmation = process.env.CONFIRM_DEMO_SEED

  if (!expectedProjectId || projectId !== expectedProjectId) {
    throw new Error(
      `Set SEED_FIREBASE_PROJECT_ID to the configured project (${expectedProjectId || 'unknown'}).`,
    )
  }
  if (confirmation !== 'YES') {
    throw new Error('Set CONFIRM_DEMO_SEED=YES to confirm writes to the configured Firebase project.')
  }
  if (!ownerEmail || !ownerEmail.includes('@')) {
    throw new Error('Set SEED_OWNER_EMAIL to the email address of your existing Firebase Auth account.')
  }
  if (!demoPassword || demoPassword.length < 12) {
    throw new Error('Set DEMO_USER_PASSWORD to a temporary password of at least 12 characters.')
  }
  if (!credentialPath || !existsSync(resolve(credentialPath))) {
    throw new Error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file path.')
  }

  const serviceAccount = JSON.parse(readFileSync(resolve(credentialPath), 'utf8'))
  if (serviceAccount.project_id !== projectId) {
    throw new Error('The service-account file belongs to a different Firebase project.')
  }

  const app = initializeApp({
    credential: applicationDefault(),
    projectId,
    databaseURL: `https://${projectId}-default-rtdb.firebaseio.com`,
  }, 'chatter-demo-seed')

  try {
    const auth = getAuth(app)
    const firestore = getFirestore(app)
    const realtimeDatabase = getDatabase(app)
    const owner = await auth.getUserByEmail(ownerEmail)

    const users = []
    for (const demoUser of demoUsers) {
      users.push(await getOrCreateDemoUser(auth, demoUser, demoPassword))
    }

    await Promise.all([
      writeUserProfiles(owner, firestore, realtimeDatabase),
      ...users.map((demoUser) => writeUserProfiles(demoUser, firestore, realtimeDatabase)),
    ])
    await seedConversation(firestore, owner, users[0])

    console.log(`Seeded ${users.length} demo accounts and searchable profiles in ${projectId}.`)
    console.log('Demo emails: chatter.demo.maya@example.com, chatter.demo.jordan@example.com, chatter.demo.avery@example.com')
    console.log('Use the temporary DEMO_USER_PASSWORD value to sign in as any demo account.')
  } finally {
    await deleteApp(app)
  }
}

main().catch((error) => {
  console.error(error.message || 'Demo data seeding failed.')
  process.exitCode = 1
})
