# Chatter

A WhatsApp-inspired, real-time one-to-one messaging app built with React, Vite, Firebase Authentication, and Cloud Firestore.

## Features

- Email/password and Google sign-in, account creation, and password reset.
- Edit your display name and profile photo URL.
- Search for people by display name and start a private conversation.
- Live conversation list and message updates across signed-in clients.
- Firestore rules restrict conversation and message access to the conversation participants.
- Responsive layout for desktop and mobile.

This starter supports text messages. It does not currently include file attachments, group chats, online presence, read receipts, or end-to-end encryption.

## Firebase setup

1. In the Firebase Console for project `fir-5826c`, enable **Email/Password** and **Google** under **Authentication → Sign-in method**.
2. Create a **Cloud Firestore** database.
3. Install and sign in to the Firebase CLI if needed:

   ```sh
   npm install -g firebase-tools
   firebase login
   ```

4. From the repository root, deploy the Realtime Database rules, Firestore security rules, and required conversation index:

   ```sh
   firebase deploy --only database,firestore:rules,firestore:indexes
   ```

   The Firebase project is selected by `.firebaserc`.

The app writes each signed-in user's UID, email, display name, photo URL, account creation time, last sign-in time, and profile update time to Realtime Database at `users/{uid}`. It never writes passwords or authentication tokens. Realtime Database rules let each user read or update only their own record; inspect the full `users` collection from the Firebase Console with your project access.

The app also creates a private Firestore `users/{uid}` profile and a searchable `publicProfiles/{uid}` containing only the display name and avatar. Search matches the start of any name part. Existing accounts are added to the directory when they next sign in, so each person needs to open the app once before others can find them. Conversations live in `conversations/{conversationId}`; messages are stored in that conversation's `messages` subcollection. Only authenticated users can search public profiles, and Firestore rules restrict chats and messages to their two participants. A participant can read the other participant's public display name and avatar; email addresses are not included in the public directory.

## Run locally

```sh
npm ci
npm run dev
```

Run checks and create a production build with:

```sh
npm run lint
npm run build
```

## Seed Firebase with demo chat data

The seed script creates three demo Firebase Auth users, their Firestore and Realtime Database profiles, and a sample conversation with your existing account. It skips replacing an existing conversation and refuses to modify a demo email that has a different display name.

Create a Firebase service-account key for the configured project and keep it outside the repository. In PowerShell, set the following for the current terminal session, then run `npm run seed:demo`:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = 'C:\secure\path\service-account.json'
$env:SEED_FIREBASE_PROJECT_ID = 'fir-5826c'
$env:SEED_OWNER_EMAIL = 'your-auth-account@example.com'
$env:DEMO_USER_PASSWORD = 'a-temporary-password-of-at-least-12-characters'
$env:CONFIRM_DEMO_SEED = 'YES'
npm run seed:demo
```

The confirmation and project checks prevent accidental writes to a different project. All demo accounts share the temporary password you set; change it after seeding if the accounts will remain enabled. Do not commit the service-account key or share its contents.

## Hosting deployment

The `Deploy to Firebase Hosting` GitHub Actions workflow deploys the built app when changes are pushed to `main` or when manually started from the Actions tab. Add the Firebase service-account JSON as the repository Actions secret `FIREBASE_SERVICE_ACCOUNT_FIR_5826C`.

Deploy Firestore rules and indexes separately with the Firebase CLI command above; the Hosting workflow does not deploy database configuration.
