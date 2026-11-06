import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@snappick/shared'],
  images: {
    remotePatterns: [
      new URL('http://localhost:3000/mock/**'),
      new URL('https://snappick-alpha.vercel.app/mock/**'),
    ],
    //로컬 개발에서만 localhost 이미지를 허용함 (운영에서는 기본값대로 차단)
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
  },
};

export default nextConfig;
