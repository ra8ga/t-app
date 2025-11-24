import type { Auth } from '@my-better-t-app/auth';
import { createAuthClient } from 'better-auth/react';
import {
  emailOTPClient,
  inferAdditionalFields,
} from 'better-auth/client/plugins';

// Automatically detect the server URL based on environment
const getServerUrl = () => {
  // If VITE_SERVER_URL is explicitly set, use it
  if (import.meta.env.VITE_SERVER_URL) {
    return import.meta.env.VITE_SERVER_URL;
  }

  // In development (localhost), use local server
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    return 'http://localhost:3000';
  }

  // In production, use the deployed server worker
  return 'https://my-better-t-app-server.spottedx.workers.dev';
};

export const authClient = createAuthClient({
  baseURL: getServerUrl(),
  plugins: [inferAdditionalFields<Auth>(), emailOTPClient()],
});
