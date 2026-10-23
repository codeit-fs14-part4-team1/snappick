import Providers from './providers';
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SnapPick',
  description:
    '원하는 사진 스타일을 탐색하고 사진작가와 연결되는 이미지 기반 스냅 촬영 매칭 서비스',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <main id="main-content">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
