import { useEffect, useRef, useState } from 'react'
import { signOut, updateProfile } from 'firebase/auth'
import { auth } from './firebase'
import {
  getOrCreateConversation,
  searchUsers,
  sendChatMessage,
  syncUserProfile,
  watchConversations,
  watchMessages,
  watchUserProfile,
} from './chat'
import './ChatApp.css'

const EMPTY_MESSAGES = []

function Icon({ name, size = 20 }) {
  const paths = {
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    close: <><path d="m18 6-12 12M6 6l12 12" /></>,
    back: <><path d="m15 18-6-6 6-6" /><path d="M9 12h11" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    chat: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 4a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8Z" /></>,
    check: <><path d="m5 12 4 4L19 6" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
  }

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  )
}

function getInitials(name = '') {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?'
}

function Avatar({ user, size = 'normal' }) {
  return (
    <span className={`chat-avatar chat-avatar--${size}`}>
      {user?.photoURL
        ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
        : getInitials(user?.displayName || user?.email)}
    </span>
  )
}

function toDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  return value instanceof Date ? value : null
}

function formatConversationTime(value) {
  const date = toDate(value)
  if (!date) return ''

  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  if (date.getFullYear() === today.getFullYear()) {
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }
  return date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatMessageTime(value) {
  const date = toDate(value)
  return date
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Sending'
}

function getSearchErrorMessage(error) {
  switch (error.code) {
    case 'permission-denied':
      return 'Firestore denied people search. Deploy the Firestore rules with `firebase deploy --only firestore:rules`.'
    case 'failed-precondition':
      return 'Firestore needs an index for people search. Open the error details in the browser console and create the suggested index.'
    case 'unavailable':
      return 'Firestore is unavailable. Check your connection and Firebase project setup.'
    default:
      return error.code
        ? `People search failed (${error.code}). Check the browser console for details.`
        : 'People search failed. Check the browser console for details.'
  }
}

function ChatApp({ user }) {
  const [conversations, setConversations] = useState([])
  const [contactProfiles, setContactProfiles] = useState({})
  const [searchText, setSearchText] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchState, setSearchState] = useState({
    term: null,
    loading: false,
    results: [],
    error: '',
  })
  const [messageState, setMessageState] = useState({ conversationId: '', messages: [] })
  const [selectedId, setSelectedId] = useState('')
  const [peerId, setPeerId] = useState('')
  const [peer, setPeer] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [busyPeerId, setBusyPeerId] = useState('')
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [appError, setAppError] = useState('')
  const [profileReady, setProfileReady] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [profile, setProfile] = useState(() => ({
    displayName: user.displayName || user.email?.split('@')[0] || '',
    photoURL: user.photoURL || '',
  }))
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const [profileName, setProfileName] = useState('')
  const [profilePhotoURL, setProfilePhotoURL] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState('')
  const messageListRef = useRef(null)
  const searchTerm = searchText.trim()
  const isSearching = searchFocused || searchTerm.length > 0
  const messages = messageState.conversationId === selectedId
    ? messageState.messages
    : EMPTY_MESSAGES
  const currentSearch = searchState.term === searchTerm ? searchState : null
  const searching = isSearching && (currentSearch?.loading ?? true)
  const searchResults = currentSearch?.results || []
  const searchError = currentSearch?.error || ''
  const peerProfileIds = [...new Set(conversations
    .map((chat) => chat.participants?.find((participant) => participant !== user.uid))
    .filter(Boolean))].sort().join(',')
  const activePeer = (peer?.uid === peerId ? peer : null) || contactProfiles[peerId] || null

  useEffect(() => {
    let active = true
    syncUserProfile(user)
      .then((syncedProfile) => {
        if (active) {
          setProfile(syncedProfile)
          setProfileReady(true)
        }
      })
      .catch(() => {
        if (active) {
          setAppError('Could not sync your profile. Check that Firestore and Realtime Database are enabled and their rules are deployed.')
        }
      })

    return () => { active = false }
  }, [user])

  useEffect(() => watchConversations(user.uid, setConversations, () => {
    setAppError('Could not load conversations. Check that Firestore is enabled and its indexes and rules are deployed.')
  }), [user.uid])

  useEffect(() => {
    const ids = peerProfileIds ? peerProfileIds.split(',') : []
    if (!ids.length) return undefined

    const unsubscribes = ids.map((uid) => watchUserProfile(uid, (profile) => {
      setContactProfiles((current) => ({ ...current, [uid]: profile }))
    }, () => {
      setAppError('Could not load a conversation participant’s profile.')
    }))

    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [peerProfileIds])

  useEffect(() => {
    if (!selectedId) return undefined
    return watchMessages(selectedId, (nextMessages) => {
      setMessageState({ conversationId: selectedId, messages: nextMessages })
    }, () => {
      setAppError('Could not load messages for this conversation.')
    })
  }, [selectedId])

  useEffect(() => {
    if (!searchFocused && searchTerm.length === 0) return undefined

    let active = true
    const timer = setTimeout(() => {
      setSearchState({ term: searchTerm, loading: true, results: [], error: '' })
      searchUsers(searchTerm, user.uid)
        .then((results) => {
          if (active) setSearchState({ term: searchTerm, loading: false, results, error: '' })
        })
        .catch((error) => {
          if (active) {
            setSearchState({
              term: searchTerm,
              loading: false,
              results: [],
              error: getSearchErrorMessage(error),
            })
          }
        })
    }, searchTerm ? 250 : 0)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [searchFocused, searchTerm, user.uid])

  useEffect(() => {
    if (messages.length && messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (!profileEditorOpen) return undefined

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !profileSaving) {
        setProfileEditorOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [profileEditorOpen, profileSaving])

  function openConversation(conversation) {
    const otherId = conversation.participants?.find((participant) => participant !== user.uid)
    if (!otherId) return

    setAppError('')
    setSelectedId(conversation.id)
    setPeerId(otherId)
    setSearchText('')
    setMobileChatOpen(true)
  }

  async function startConversation(targetUser) {
    setBusyPeerId(targetUser.uid)
    setAppError('')
    try {
      const conversationId = await getOrCreateConversation(user, targetUser)
      setPeer(targetUser)
      setPeerId(targetUser.uid)
      setSelectedId(conversationId)
      setSearchText('')
      setMobileChatOpen(true)
    } catch {
      setAppError('Could not start this conversation. Please check your Firestore setup and try again.')
    } finally {
      setBusyPeerId('')
    }
  }

  async function handleSend(event) {
    event.preventDefault()
    const content = draft.trim()
    if (!content || !selectedId || sending) return

    setSending(true)
    setAppError('')
    try {
      await sendChatMessage(selectedId, user.uid, content)
      setDraft('')
    } catch {
      setAppError('Your message could not be sent. Check your connection and try again.')
    } finally {
      setSending(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    try {
      await signOut(auth)
    } catch {
      setAppError('Could not sign out. Please try again.')
    } finally {
      setLoggingOut(false)
    }
  }

  function openProfileEditor() {
    setProfileName(profile.displayName)
    setProfilePhotoURL(profile.photoURL)
    setProfileError('')
    setProfileEditorOpen(true)
  }

  async function handleProfileSave(event) {
    event.preventDefault()
    const displayName = profileName.trim()
    const photoURL = profilePhotoURL.trim()

    if (!displayName) {
      setProfileError('Enter a display name.')
      return
    }

    setProfileSaving(true)
    setProfileError('')
    try {
      if (!auth.currentUser) throw new Error('You are no longer signed in.')

      await updateProfile(auth.currentUser, {
        displayName,
        photoURL: photoURL || null,
      })
      setProfile({ displayName, photoURL })
      await syncUserProfile(auth.currentUser)
      setProfileEditorOpen(false)
    } catch (error) {
      setProfileError(error.code === 'permission-denied'
        ? 'Your account profile was updated, but a database rejected the profile sync. Deploy the latest Firestore and Realtime Database rules and try again.'
        : 'Could not save your profile. Check your connection and try again.')
    } finally {
      setProfileSaving(false)
    }
  }

  return (
    <main className="chat-shell">
      <aside className={`chat-sidebar${mobileChatOpen ? ' chat-sidebar--hidden-mobile' : ''}`}>
        <header className="sidebar-header">
          <a className="chat-brand" href="/" aria-label="Chatter home">
            <span className="chat-brand-mark"><Icon name="chat" size={21} /></span>
            <span>chatter</span>
          </a>
          <div className="sidebar-actions">
            <button
              className="icon-button"
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-label={loggingOut ? 'Signing out' : 'Sign out'}
              title="Sign out"
            >
              <Icon name="logout" />
            </button>
            <Avatar user={profile} size="small" />
          </div>
        </header>

        <div className="inbox-heading">
          <div>
            <span className="inbox-kicker">YOUR SPACE</span>
            <h1>Messages</h1>
          </div>
          <span className="inbox-count">{conversations.length}</span>
        </div>

        <label className="user-search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => {
              window.setTimeout(() => setSearchFocused(false), 150)
            }}
            placeholder="Search people by name"
            aria-label="Search people by name"
          />
          {searchText && (
            <button
              type="button"
              className="search-clear"
              onClick={() => setSearchText('')}
              aria-label="Clear search"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </label>

        <div className="conversation-list">
          {isSearching ? (
            <>
              <p className="list-section-label">PEOPLE</p>
              {searching ? (
                <p className="list-hint">Looking for people…</p>
              ) : searchError ? (
                <p className="list-hint list-hint--error">{searchError}</p>
              ) : searchResults.length ? (
                searchResults.map((result) => (
                  <button
                    className="person-result"
                    type="button"
                    key={result.uid}
                    onClick={() => startConversation(result)}
                    disabled={busyPeerId === result.uid}
                  >
                    <Avatar user={result} />
                    <span className="person-result-info">
                      <strong>{result.displayName || 'Chatter user'}</strong>
                      <span>{busyPeerId === result.uid ? 'Opening conversation…' : 'Start a private conversation'}</span>
                    </span>
                    <span className="person-result-arrow" aria-hidden="true">↗</span>
                  </button>
                ))
              ) : (
                <p className="list-hint">
                  {searchTerm
                    ? 'No matching names yet. Search any part of their name; new users appear after they sign in once.'
                    : 'No other people found yet. New users appear after they sign in once.'}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="list-section-label">RECENT</p>
              {!profileReady && !appError ? (
                <p className="list-hint">Setting up your account…</p>
              ) : conversations.length ? (
                conversations.map((conversation) => {
                  const otherId = conversation.participants?.find((id) => id !== user.uid)
                  const isSelected = conversation.id === selectedId
                  const preview = conversation.lastMessage || 'Start a conversation'

                  return (
                    <button
                      className={`conversation-row${isSelected ? ' conversation-row--selected' : ''}`}
                      type="button"
                      key={conversation.id}
                      onClick={() => openConversation(conversation)}
                    >
                      <Avatar user={contactProfiles[otherId]} />
                      <span className="conversation-row-content">
                        <span className="conversation-row-top">
                          <strong>{contactProfiles[otherId]?.displayName || 'Chatter user'}</strong>
                          <time>{formatConversationTime(conversation.lastMessageAt)}</time>
                        </span>
                        <span className="conversation-preview">
                          {conversation.lastSenderId === user.uid && <span>You: </span>}
                          {preview}
                        </span>
                      </span>
                    </button>
                  )
                })
              ) : (
                <div className="inbox-empty">
                  <span className="empty-icon"><Icon name="chat" size={22} /></span>
                  <strong>No conversations yet</strong>
                  <span>Search for someone above to say hello.</span>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="sidebar-footer">
          <button
            className="profile-edit-button"
            type="button"
            onClick={openProfileEditor}
            aria-label="Edit profile"
          >
            <Avatar user={profile} size="small" />
            <span className="sidebar-account">
              <strong>{profile.displayName || 'Your account'}</strong>
              <span>{user.email}</span>
            </span>
            <span className="profile-edit-icon"><Icon name="edit" size={16} /></span>
          </button>
        </footer>
      </aside>

      {profileEditorOpen && (
        <div
          className="profile-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !profileSaving) {
              setProfileEditorOpen(false)
            }
          }}
        >
          <section
            className="profile-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-modal-title"
          >
            <header className="profile-modal-header">
              <div>
                <span className="inbox-kicker">YOUR ACCOUNT</span>
                <h2 id="profile-modal-title">Edit profile</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setProfileEditorOpen(false)}
                disabled={profileSaving}
                aria-label="Close profile editor"
              >
                <Icon name="close" />
              </button>
            </header>

            <div className="profile-preview">
              <Avatar
                user={{ displayName: profileName || profile.displayName, photoURL: profilePhotoURL }}
              />
              <span>
                <strong>{profileName.trim() || profile.displayName}</strong>
                <span>{user.email}</span>
              </span>
            </div>

            <form className="profile-form" onSubmit={handleProfileSave}>
              <label className="profile-field">
                <span>Display name</span>
                <input
                  type="text"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  required
                  autoFocus
                />
              </label>

              <label className="profile-field">
                <span>Profile photo URL <span className="optional-label">Optional</span></span>
                <input
                  type="url"
                  value={profilePhotoURL}
                  onChange={(event) => setProfilePhotoURL(event.target.value)}
                  placeholder="https://example.com/photo.jpg"
                  pattern="https://.*"
                  title="Enter a direct HTTPS image URL."
                  maxLength={2048}
                />
                <span className="profile-field-hint">
                  Use a direct HTTPS image link, or leave blank for initials.
                </span>
              </label>

              {profileError && (
                <p className="profile-error" role="alert">{profileError}</p>
              )}

              <div className="profile-modal-actions">
                <button
                  className="profile-cancel"
                  type="button"
                  onClick={() => setProfileEditorOpen(false)}
                  disabled={profileSaving}
                >
                  Cancel
                </button>
                <button className="profile-save" type="submit" disabled={profileSaving}>
                  {profileSaving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className={`chat-main${mobileChatOpen ? ' chat-main--visible-mobile' : ''}`}>
        {appError && (
          <div className="chat-alert" role="alert">
            <span>{appError}</span>
            <button type="button" onClick={() => setAppError('')} aria-label="Dismiss message">
              <Icon name="close" size={16} />
            </button>
          </div>
        )}

        {selectedId && peerId ? (
          <>
            <header className="chat-header">
              <button
                type="button"
                className="icon-button mobile-back"
                onClick={() => setMobileChatOpen(false)}
                aria-label="Back to messages"
              >
                <Icon name="back" />
              </button>
              <Avatar user={activePeer} />
              <div className="chat-header-info">
                <strong>{activePeer?.displayName || 'Chatter user'}</strong>
                <span>Chatter member · messages are private to this chat</span>
              </div>
            </header>

            <div className="chat-wallpaper">
              <div className="chat-date-chip">YOUR CONVERSATION</div>
              {messages.length === 0 ? (
                <div className="message-empty">
                  <span className="message-empty-icon"><Icon name="chat" size={22} /></span>
                  <strong>Say hello to {activePeer?.displayName || 'your new connection'}</strong>
                  <span>This is the start of your conversation.</span>
                </div>
              ) : (
                <div className="message-list" ref={messageListRef} aria-live="polite">
                  {messages.map((message, index) => {
                    const ownMessage = message.senderId === user.uid
                    const previousMessage = messages[index - 1]
                    const showDate = !previousMessage
                      || toDate(previousMessage.createdAt)?.toDateString()
                        !== toDate(message.createdAt)?.toDateString()

                    return (
                      <div key={message.id}>
                        {showDate && toDate(message.createdAt) && (
                          <div className="message-date">
                            {toDate(message.createdAt).toLocaleDateString([], {
                              weekday: 'long',
                              month: 'long',
                              day: 'numeric',
                            })}
                          </div>
                        )}
                        <div className={`message-line${ownMessage ? ' message-line--own' : ''}`}>
                          <article className={`message-bubble-chat${ownMessage ? ' message-bubble-chat--own' : ''}`}>
                            <p>{message.text}</p>
                            <span className="message-meta">
                              <time>{formatMessageTime(message.createdAt)}</time>
                              {ownMessage && <Icon name="check" size={14} />}
                            </span>
                          </article>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <form className="composer" onSubmit={handleSend}>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form.requestSubmit()
                  }
                }}
                placeholder={`Message ${activePeer?.displayName || 'your friend'}…`}
                aria-label="Write a message"
                maxLength={4000}
                rows={1}
                disabled={sending}
              />
              <span className="composer-hint">Enter to send · Shift + Enter for a new line</span>
              <button
                className="send-button"
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label={sending ? 'Sending message' : 'Send message'}
              >
                <Icon name="send" size={18} />
              </button>
            </form>
          </>
        ) : (
          <div className="chat-welcome">
            <div className="welcome-illustration">
              <span className="welcome-illustration-orbit" />
              <span className="welcome-illustration-bubble"><Icon name="chat" size={43} /></span>
              <span className="welcome-spark welcome-spark--one">✦</span>
              <span className="welcome-spark welcome-spark--two">✦</span>
            </div>
            <span className="inbox-kicker">A LITTLE MORE CONNECTED</span>
            <h2>Your conversations<br />start with hello.</h2>
            <p>Pick up a chat or search for someone new to start talking.</p>
            <span className="welcome-encryption"><Icon name="check" size={14} /> Your chats are private to you and the people in them.</span>
          </div>
        )}
      </section>
    </main>
  )
}

export default ChatApp
