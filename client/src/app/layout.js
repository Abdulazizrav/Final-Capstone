import './globals.css';
import QueryProvider from '@/components/QueryProvider';

export const metadata = {
  title: 'CoSphere - Collaborative Real-Time Workspace',
  description: 'Manage tasks collaboratively in real-time, view analytics, and coordinate with team chat.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌌</text></svg>" />
      </head>
      <body>
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
