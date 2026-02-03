export interface Friend {
  id: string;
  name: string;
  avatar: string; // URL or placeholder
  statusMessage?: string;
}

export interface Activity {
  id: string;
  title: string;
  image: string;
  distance: number; // km
  headcount: string; // "2-4 People"
  time: string; // "2-3 Hours"
  tags: string[];
  description: string;
  highlights: { icon: string; text: string }[];
}

export const MOCK_USER = {
  id: 'u1',
  name: '나',
  avatar: 'https://i.pravatar.cc/150?u=u1',
  location: '서울, 강남',
};

export const MOCK_FRIENDS: Friend[] = [
  { id: 'f1', name: '민지', avatar: 'https://i.pravatar.cc/150?u=f1', statusMessage: '공부 중...' },
  { id: 'f2', name: '철수', avatar: 'https://i.pravatar.cc/150?u=f2', statusMessage: '운동 하러 가실 분?' },
  { id: 'f3', name: '영희', avatar: 'https://i.pravatar.cc/150?u=f3', statusMessage: '커피 마시고 싶다' },
  { id: 'f4', name: '준', avatar: 'https://i.pravatar.cc/150?u=f4', statusMessage: '자고 싶다' },
  { id: 'f5', name: '하나', avatar: 'https://i.pravatar.cc/150?u=f5', statusMessage: '한강 갈래?' },
];

export const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'a1',
    title: '경복궁 투어',
    image: 'https://picsum.photos/400/300?random=1',
    distance: 2.3,
    headcount: '2-4명',
    time: '2-3시간',
    tags: ['인기', '걷기'],
    description: '친구들과 함께 고즈넉한 경복궁을 걸으며 역사의 숨결을 느껴보세요. 한복을 입고 인생샷을 남기기에도 완벽한 장소입니다.',
    highlights: [
      { icon: 'camera', text: '인생샷 명소' },
      { icon: 'walk', text: '여유로운 산책로' },
      { icon: 'history', text: '역사 체험' },
    ]
  },
  {
    id: 'a2',
    title: '도전 쿠킹 베이킹 클래스',
    image: 'https://picsum.photos/400/300?random=2',
    distance: 5.1,
    headcount: '3-6명',
    time: '3시간',
    tags: ['트렌드', '실내'],
    description: '달콤한 디저트를 직접 만들어보는 시간! 초보자도 쉽게 따라 할 수 있는 베이킹 클래스에서 특별한 추억을 쌓아보세요.',
    highlights: [
      { icon: 'chef-hat', text: '초보자 환영' },
      { icon: 'cookie', text: '직접 만든 디저트' },
      { icon: 'account-group', text: '소그룹 클래스' },
    ]
  },
  {
    id: 'a3',
    title: '한강 피크닉',
    image: 'https://picsum.photos/400/300?random=3',
    distance: 1.5,
    headcount: '누구나',
    time: '자유롭게',
    tags: ['야외', '힐링'],
    description: '선선한 강바람을 맞으며 즐기는 힐링 피크닉. 맛있는 배달 음식과 함께 좋아하는 음악을 들으며 여유를 즐겨보세요.',
    highlights: [
      { icon: 'food', text: '배달 음식 천국' },
      { icon: 'weather-sunset', text: '아름다운 노을' },
      { icon: 'bicycle', text: '자전거 대여 가능' },
    ]
  },
  {
    id: 'a4',
    title: '방탈출 도전',
    image: 'https://picsum.photos/400/300?random=4',
    distance: 0.8,
    headcount: '4명',
    time: '1.5시간',
    tags: ['익사이팅', '팀워크'],
    description: '제한 시간 내에 탈출해야 한다! 친구들과 힘을 합쳐 미스터리를 풀고 방을 탈출하는 짜릿한 경험을 해보세요.',
    highlights: [
      { icon: 'lock-open', text: '몰입감 넘치는 테마' },
      { icon: 'brain', text: '두뇌 풀가동' },
      { icon: 'account-group', text: '팀워크 강화' },
    ]
  },
  {
    id: 'a5',
    title: '보드게임 카페',
    image: 'https://picsum.photos/400/300?random=5',
    distance: 0.5,
    headcount: '2-8명',
    time: '2-5시간',
    tags: ['캐주얼', '꿀잼'],
    description: '다양한 보드게임을 즐기며 승부욕을 불태워보세요. 맛있는 음료와 간식은 덤! 시간 가는 줄 모르는 즐거움이 기다립니다.',
    highlights: [
      { icon: 'dice-5', text: '다양한 게임 보유' },
      { icon: 'coffee', text: '음료 & 스낵' },
      { icon: 'emoticon-excited', text: '폭소 만발' },
    ]
  },
];
