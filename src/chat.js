import {
  collection,
  doc,
  endAt,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  startAt,
  where,
  writeBatch,
} from 'firebase/firestore'
import { ref, serverTimestamp as realtimeServerTimestamp, update } from 'firebase/database'
import { db } from './firestore'
import { realtimeDatabase } from './firebase'

function getDisplayNameTokens(displayName) {
  const words = displayName.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []
  return [...new Set(words.flatMap((word) => (
    Array.from({ length: word.length }, (_, index) => word.slice(0, index + 1))
  )))].slice(0, 80)
}

export async function syncUserProfile(user) {
  const displayName = (
    user.displayName?.trim() || user.email?.split('@')[0] || 'Chatter user'
  ).slice(0, 80)
  const profile = {
    uid: user.uid,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    displayNameTokens: getDisplayNameTokens(displayName),
    email: user.email || '',
    emailLower: user.email?.toLocaleLowerCase() || '',
    photoURL: user.photoURL || '',
    updatedAt: serverTimestamp(),
  }

  const batch = writeBatch(db)
  batch.set(doc(db, 'users', user.uid), profile, { merge: true })
  batch.set(doc(db, 'publicProfiles', user.uid), {
    uid: user.uid,
    displayName,
    displayNameLower: displayName.toLowerCase(),
    displayNameTokens: getDisplayNameTokens(displayName),
    photoURL: user.photoURL || '',
    updatedAt: serverTimestamp(),
  }, { merge: true })

  const accountCreatedAt = Date.parse(user.metadata?.creationTime || '')
  const lastLoginAt = Date.parse(user.metadata?.lastSignInTime || '')
  const realtimeProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName,
    photoURL: user.photoURL || '',
    accountCreatedAt: Number.isFinite(accountCreatedAt)
      ? accountCreatedAt
      : realtimeServerTimestamp(),
    lastLoginAt: Number.isFinite(lastLoginAt)
      ? lastLoginAt
      : realtimeServerTimestamp(),
    profileUpdatedAt: realtimeServerTimestamp(),
  }

  await Promise.all([
    batch.commit(),
    update(ref(realtimeDatabase, `users/${user.uid}`), realtimeProfile),
  ])
  return profile
}

export function watchConversations(uid, onUpdate, onError) {
  const conversations = query(
    collection(db, 'conversations'),
    where('participants', 'array-contains', uid),
    orderBy('updatedAt', 'desc'),
  )

  return onSnapshot(conversations, (snapshot) => {
    onUpdate(snapshot.docs.map((conversation) => ({
      id: conversation.id,
      ...conversation.data(),
    })))
  }, onError)
}

export function watchMessages(conversationId, onUpdate, onError) {
  const messages = query(
    collection(db, 'conversations', conversationId, 'messages'),
    orderBy('createdAt', 'asc'),
    limitToLast(100),
  )

  return onSnapshot(messages, (snapshot) => {
    onUpdate(snapshot.docs.map((message) => ({
      id: message.id,
      ...message.data(),
    })))
  }, onError)
}

export function watchUserProfile(uid, onUpdate, onError) {
  return onSnapshot(doc(db, 'publicProfiles', uid), (snapshot) => {
    if (snapshot.exists()) {
      onUpdate({ uid: snapshot.id, ...snapshot.data() })
    }
  }, onError)
}

export async function searchUsers(searchText, currentUid) {
  const term = (searchText.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).join(' ')
  const profiles = collection(db, 'publicProfiles')
  if (!term) {
    const users = await getDocs(query(
      profiles,
      orderBy('displayNameLower'),
      limit(50),
    ))

    return users.docs
      .filter((profile) => profile.id !== currentUid)
      .map((profile) => ({ uid: profile.id, ...profile.data() }))
  }

  const lastWord = term.split(/\s+/).at(-1)
  const [nameMatches, wordMatches] = await Promise.all([
    getDocs(query(
      profiles,
      orderBy('displayNameLower'),
      startAt(term),
      endAt(`${term}\uf8ff`),
      limit(15),
    )),
    getDocs(query(
      profiles,
      where('displayNameTokens', 'array-contains', lastWord),
      limit(15),
    )),
  ])
  const matchingProfiles = new Map()

  for (const profile of [...nameMatches.docs, ...wordMatches.docs]) {
    const nameParts = (profile.data().displayNameLower || '').split(/\s+/)
    const matchesAllWords = term
      .split(/\s+/)
      .every((part) => nameParts.some((namePart) => namePart.startsWith(part)))

    if (profile.id !== currentUid && matchesAllWords) {
      matchingProfiles.set(profile.id, { uid: profile.id, ...profile.data() })
    }
  }

  return [...matchingProfiles.values()]
    .sort((left, right) => left.displayName.localeCompare(right.displayName))
}

export async function getOrCreateConversation(currentUser, otherUser) {
  const participants = [currentUser.uid, otherUser.uid].sort()
  const conversationId = participants.join('_')
  const conversationRef = doc(db, 'conversations', conversationId)

  await runTransaction(db, async (transaction) => {
    const conversation = await transaction.get(conversationRef)
    if (!conversation.exists()) {
      transaction.set(conversationRef, {
        participants,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessage: '',
        lastMessageId: '',
        lastMessageAt: serverTimestamp(),
        lastSenderId: '',
      })
    }
  })

  return conversationId
}

export async function sendChatMessage(conversationId, senderId, text) {
  const content = text.trim()
  if (!content || content.length > 4000) {
    throw new Error('Messages must be between 1 and 4,000 characters.')
  }

  const conversationRef = doc(db, 'conversations', conversationId)
  const messageRef = doc(collection(conversationRef, 'messages'))
  const batch = writeBatch(db)

  batch.set(messageRef, {
    senderId,
    text: content,
    createdAt: serverTimestamp(),
  })
  batch.update(conversationRef, {
    lastMessage: content,
    lastMessageId: messageRef.id,
    lastMessageAt: serverTimestamp(),
    lastSenderId: senderId,
    updatedAt: serverTimestamp(),
  })

  await batch.commit()
}
