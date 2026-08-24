type Header = { key: string; value: string };

export function buildContentSecurityPolicy(isDevelopment: boolean): string {
  const scriptSrc = isDevelopment
    ? `'self' 'unsafe-inline' 'unsafe-eval'`
    : `'self' 'unsafe-inline'`;
  const connectSrc = isDevelopment ? `'self' ws: wss:` : `'self'`;

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'none'`,
    `form-action 'self'`,
    `script-src ${scriptSrc}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src ${connectSrc}`,
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
