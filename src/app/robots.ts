import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://cadonce.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/', // If you use a dashboard prefix
          '/settings/',
          '/team/',
          '/clients/',
          '/projects/',
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
