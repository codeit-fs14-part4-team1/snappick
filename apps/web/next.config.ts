import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@snappick/shared'],
  images: {
    //Vercel 이미지 최적화 한도 초과(402)를 피하려고 원본(CDN webp)을 그대로 사용함
    unoptimized: true,
    remotePatterns: [
      new URL('http://localhost:3000/mock/**'),
      new URL('http://localhost:3000/photos/**'),
      //staging 이미지 CDN (mock · photos · profiles)
      new URL('https://d33h37hxjt8j2m.cloudfront.net/**'),
    ],
    //로컬 개발에서만 localhost 이미지를 허용함 (운영에서는 기본값대로 차단)
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
