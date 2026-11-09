import Image from 'next/image';
import StartChatButton from '@/features/chats/components/StartChatButton';
import styles from './PhotographerProfileInfo.module.css';

// 작가 기본 정보 컴포넌트에서 사용할 데이터 타입 정의
type PhotographerProfileInfoProps = {
  photographerId: string;
  nickname: string;
  profileImageUrl: string | null;
  categories: string[];
  careerLabel: string | null;
  regions: string[];
  introduction: string | null;
  reviewCount: number;
  ratingAvg: number | null;
  savedCount?: number | null;
  completedCount?: number | null;
};

// 숫자 데이터를 천 단위 구분 기호로 변환
// 데이터가 없으면 '—' 반환
function formatCount(value: number | null | undefined) {
  return value == null ? '—' : value.toLocaleString('ko-KR');
}

export default function PhotographerProfileInfo({
  photographerId,
  nickname,
  profileImageUrl,
  categories,
  careerLabel,
  regions,
  introduction,
  reviewCount,
  ratingAvg,
  savedCount,
  completedCount,
}: PhotographerProfileInfoProps) {
  // 경력과 활동 지역을 하나의 문자열로 결합
  // 값이 없는 항목은 제외하고 ' · '로 구분
  const profileDetails = [careerLabel, ...regions].filter(Boolean).join(' · ');

  // 통계 데이터를 배열로 구성해 반복 렌더링에 사용
  const statistics = [
    { label: '저장', value: formatCount(savedCount) },

    // 진행 건수가 있으면 '건' 단위를 붙이고, 없으면 '—' 표시
    {
      label: '진행',
      value: completedCount == null ? '—' : `${formatCount(completedCount)}건`,
    },

    { label: '리뷰', value: formatCount(reviewCount) },
    {
      label: '평점',
      value: ratingAvg === null ? '—' : ratingAvg.toFixed(1),
    },
  ];

  return (
    <section className={styles.container} aria-label="작가 기본 정보">
      {/* 프로필 이미지 및 작가 정보 영역 */}
      <div className={styles.profile}>
        <div className={styles.profileImage}>
          {profileImageUrl ? (
            // 프로필 이미지가 있으면 해당 이미지 표시
            <Image
              src={profileImageUrl}
              alt={`${nickname} 프로필 사진`}
              fill
              sizes="(max-width: 767px) 96px, 160px"
              unoptimized
            />
          ) : (
            // 프로필 이미지가 없으면 기본 영역 표시
            <span
              className={styles.imagePlaceholder}
              role="img"
              aria-label="기본 프로필 이미지"
            />
          )}
        </div>

        {/* 작가 닉네임, 촬영 분야, 경력 및 활동 지역 */}
        <div className={styles.profileDetails}>
          {/* 촬영 분야가 있을 때만 태그 표시 */}
          {categories.length > 0 && (
            <div className={styles.categories}>
              {categories.map((category) => (
                <span key={category} className={styles.category}>
                  {category}
                </span>
              ))}
            </div>
          )}

          <h1 className={styles.nickname}>{nickname}</h1>

          {/* 경력 또는 활동 지역이 있을 때만 표시 */}
          {profileDetails && <p className={styles.details}>{profileDetails}</p>}
        </div>

        {/* 작가 문의, 저장, 공유 버튼 영역 */}
        <div className={styles.profileActions}>
          <StartChatButton
            key={photographerId}
            photographerId={photographerId}
          />

          {/* 저장 및 공유 아이콘 버튼을 가로로 배치 */}
          <div className={styles.iconActions}>
            {/*  원본 이미지 영역인 48px 크기로 저장 아이콘 표시 */}
            <button
              type="button"
              className={styles.iconButton}
              aria-label="작가 저장"
            >
              <Image src="/save.png" alt="" width={48} height={48} />
            </button>

            <button
              type="button"
              className={styles.iconButton}
              aria-label="작가 프로필 공유"
            >
              <Image src="/share.png" alt="" width={48} height={48} />
            </button>
          </div>
        </div>

        {/* 저장 수, 진행 건수, 리뷰 수, 평점 표시 */}
        <dl className={styles.statistics}>
          {statistics.map(({ label, value }) => (
            <div key={label} className={styles.statistic}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* 작가 상세 소개 영역 */}
      <div className={styles.introduction}>
        <h2>상세 소개</h2>
        <p>{introduction || '등록된 소개가 없습니다.'}</p>
      </div>
    </section>
  );
}
