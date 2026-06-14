This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Google Sheets OAuth

Para habilitar la exportación automática mensual a Google Sheets, definí estas variables en `.env.local`:

```bash
AUTH_SECRET=tu-secreto-largo
GOOGLE_OAUTH_CLIENT_ID=tu-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=tu-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google/callback
```

En Google Cloud Console:

1. Creá o elegí un proyecto.
2. Habilitá `Google Sheets API`.
3. Configurá la pantalla de consentimiento OAuth como `External`.
4. Agregá tu usuario como `Test user`.
5. Creá un `OAuth client ID` de tipo `Web application`.
6. Agregá `http://localhost:3000/api/google/callback` en `Authorized redirect URIs`.

Después, desde `Configuración`, conectá Google y pegá la URL del spreadsheet destino.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
