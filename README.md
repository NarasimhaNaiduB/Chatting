# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

## Firebase Hosting deployment

The `Deploy to Firebase Hosting` GitHub Actions workflow deploys the production site when changes are pushed to `main`. It can also be started manually from the Actions tab.

Add a repository Actions secret named `FIREBASE_SERVICE_ACCOUNT_FIR_5826C` containing a Firebase service account JSON key with permission to deploy to Firebase Hosting. The workflow builds the app and deploys the `dist` directory configured in `firebase.json`.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
