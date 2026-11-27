import type { Metadata } from 'next';
import PageContainer from '@/components/layout/PageContainer';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: '개인정보처리방침 | SnapPick',
  description: 'SnapPick 개인정보처리방침',
};

// TODO(확정 필요): 시행일, 보유 기간, 보호책임자 정보는 팀에서 확정한 뒤 채운다
const EFFECTIVE_DATE = '0000년 00월 00일';

// 로그인 없이 누구나 볼 수 있는 정적 페이지 (소셜 로그인 심사 제출용 URL: /privacy)
export default function PrivacyPage() {
  return (
    <PageContainer className={styles.page}>
      <article className={styles.article}>
        <header className={styles.header}>
          <h1 className={styles.title}>개인정보처리방침</h1>
          <p className={styles.meta}>시행일: {EFFECTIVE_DATE}</p>
          <p>
            SnapPick(이하 &lsquo;서비스&rsquo;)은 「개인정보 보호법」 등 관련
            법령을 지키며, 이용자의 개인정보를 아래와 같이 처리합니다.
          </p>
        </header>

        <section className={styles.section}>
          <h2>1. 개인정보의 처리 목적</h2>
          <ul>
            <li>회원 가입, 본인 확인, 로그인 유지 등 회원 관리</li>
            <li>사진작가 탐색, 문의·채팅, 견적 및 촬영 예약 진행</li>
            <li>결제와 환불 처리, 결과물 전달 및 구매 확정</li>
            <li>좋아요·저장 등 이용 기록을 바탕으로 한 사진 추천</li>
            <li>알림 발송, 문의 응대, 부정 이용 방지</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>2. 처리하는 개인정보 항목</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">구분</th>
                <th scope="col">항목</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>회원 가입(이메일)</td>
                <td>이메일, 비밀번호(암호화 저장), 닉네임</td>
              </tr>
              <tr>
                <td>회원 가입(소셜 로그인)</td>
                <td>구글·카카오·네이버 계정의 이메일과 회원 식별값, 닉네임</td>
              </tr>
              <tr>
                <td>사진작가 프로필</td>
                <td>
                  프로필 이미지, 경력, 활동 지역, 촬영 분야, 소개, 포트폴리오
                  사진
                </td>
              </tr>
              <tr>
                <td>예약·결제</td>
                <td>
                  촬영 일시와 장소, 견적 내용, 결제 금액과 결제 수단, 결제 내역
                </td>
              </tr>
              <tr>
                <td>서비스 이용 중 생성</td>
                <td>
                  채팅 내용, 리뷰, 좋아요·저장·조회 기록, 접속 기록, 로그인 유지
                  쿠키
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className={styles.section}>
          <h2>3. 보유 및 이용 기간</h2>
          <p>
            회원 탈퇴 시 지체 없이 파기합니다. 다만 관련 법령에 따라 보존해야
            하는 정보는 해당 기간 동안 보관합니다.
          </p>
          {/* TODO(확정 필요): 실제 운영 기준과 맞는지 확인 */}
          <ul>
            <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
            <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
            <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
            <li>접속 기록: 3개월 (통신비밀보호법)</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>4. 개인정보의 제3자 제공</h2>
          <p>
            이용자가 촬영을 예약하면, 예약 진행을 위해 해당 사진작가에게 닉네임,
            촬영 일시와 장소, 견적·예약 내용을 제공합니다. 그 밖에는 법령에
            근거가 있는 경우를 제외하고 제3자에게 제공하지 않습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>5. 개인정보 처리의 위탁</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">수탁자</th>
                <th scope="col">위탁 업무</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>토스페이먼츠</td>
                <td>결제 처리</td>
              </tr>
              <tr>
                <td>Amazon Web Services</td>
                <td>서버 운영과 데이터·사진 저장</td>
              </tr>
              <tr>
                <td>Google, Kakao, NAVER</td>
                <td>소셜 로그인 인증</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className={styles.section}>
          <h2>6. 개인정보의 파기 절차 및 방법</h2>
          <p>
            보유 기간이 지나거나 처리 목적을 이룬 개인정보는 지체 없이
            파기합니다. 전자 파일은 복구할 수 없는 방법으로 삭제하고, 법령에
            따라 보존하는 정보는 다른 정보와 분리해 보관합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>7. 이용자의 권리와 행사 방법</h2>
          <p>
            이용자는 언제든지 자신의 개인정보 열람, 정정, 삭제, 처리 정지를
            요청할 수 있습니다. 닉네임과 비밀번호는 마이페이지에서 직접 변경할
            수 있고, 그 밖의 요청은 아래 개인정보 보호책임자에게 연락하면 지체
            없이 처리합니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>8. 개인정보의 안전성 확보 조치</h2>
          <ul>
            <li>비밀번호는 복호화할 수 없는 방식으로 암호화해 저장</li>
            <li>모든 통신은 HTTPS로 암호화</li>
            <li>개인정보에 접근할 수 있는 인원 최소화와 접근 권한 관리</li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2>9. 쿠키의 설치·운영 및 거부</h2>
          <p>
            서비스는 로그인 상태를 유지하기 위해 쿠키를 사용합니다. 이용자는
            브라우저 설정에서 쿠키 저장을 거부할 수 있으며, 이 경우 로그인
            유지가 되지 않을 수 있습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>10. 개인정보 보호책임자</h2>
          {/* TODO(확정 필요): 실제 책임자 정보로 교체 */}
          <ul>
            <li>성명(또는 부서): 미정</li>
            <li>연락처: 미정</li>
          </ul>
          <p>
            개인정보 침해에 대한 신고나 상담은 개인정보침해신고센터(국번 없이
            118), 개인정보분쟁조정위원회(1833-6972)에도 문의할 수 있습니다.
          </p>
        </section>

        <section className={styles.section}>
          <h2>11. 개인정보처리방침의 변경</h2>
          <p>
            이 개인정보처리방침은 {EFFECTIVE_DATE}부터 적용됩니다. 내용이 바뀌면
            시행 7일 전부터 서비스에 공지합니다.
          </p>
        </section>
      </article>
    </PageContainer>
  );
}
