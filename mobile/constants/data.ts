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
}

export const MOCK_USER = {
  id: 'u1',
  name: 'Me',
  avatar: 'https://i.pravatar.cc/150?u=u1',
  statusMessage: '오늘도 즐겁게!',
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
  },
  {
    id: 'a2',
    title: '도전 쿠킹 베이킹 클래스',
    image: 'https://picsum.photos/400/300?random=2',
    distance: 5.1,
    headcount: '3-6명',
    time: '3시간',
    tags: ['트렌드', '실내'],
  },
  {
    id: 'a3',
    title: '한강 피크닉',
    image: 'https://picsum.photos/400/300?random=3',
    distance: 1.5,
    headcount: '누구나',
    time: '자유롭게',
    tags: ['야외', '힐링'],
  },
  {
    id: 'a4',
    title: '방탈출 도전',
    image: 'https://picsum.photos/400/300?random=4',
    distance: 0.8,
    headcount: '4명',
    time: '1.5시간',
    tags: ['익사이팅', '팀워크'],
  },
  {
    id: 'a5',
    title: '보드게임 카페',
    image: 'https://picsum.photos/400/300?random=5',
    distance: 0.5,
    headcount: '2-8명',
    time: '2-5시간',
    tags: ['캐주얼', '꿀잼'],
  },
];
