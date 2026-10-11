type Header = { key: string; value: string };

export function buildContentSecurityPolicy(isDevelopment: boolean): string {
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  const posthogAssetsHost = posthogHost
    ? new URL(posthogHost).origin.replace('.i.', '-assets.i.')
    : undefined;
  const scriptSrc = [
    isDevelopment ? `'self' 'unsafe-inline' 'unsafe-eval'` : `'self' 'unsafe-inline'`,
    posthogAssetsHost,
  ]
    .filter(Boolean)
    .join(' ');
  const connectSrc = [isDevelopment ? `'self' ws: wss:` : `'self'`, posthogHost]
    .filter(Boolean)
    .join(' ');

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src ${connectSrc}`,
    `worker-src blob:`,
    `frame-src 'self' blob:`,
  ];
  if (!isDevelopment) directives.push('upgrade-insecure-requests');

  return directives.join('; ');
}

export function buildSecurityHeaders(isDevelopment: boolean): Header[] {
  return [
    {
      key: 'Content-Security-Policy',
      value: buildContentSecurityPolicy(isDevelopment),
    },
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=63072000; includeSubDomains',
    },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=()',
    },
  ];
}
