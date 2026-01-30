export interface Friend {
  id: string;
  name: string;
  avatar: string; // URL or placeholder
  status: 'online' | 'offline';
  location: string;
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
  location: 'Seoul, Gangnam',
};

export const MOCK_FRIENDS: Friend[] = [
  { id: 'f1', name: 'Minji', avatar: 'https://i.pravatar.cc/150?u=f1', status: 'online', location: 'Gangnam Station' },
  { id: 'f2', name: 'Chulsoo', avatar: 'https://i.pravatar.cc/150?u=f2', status: 'offline', location: 'Home' },
  { id: 'f3', name: 'Younghee', avatar: 'https://i.pravatar.cc/150?u=f3', status: 'online', location: 'Hongdae' },
  { id: 'f4', name: 'Joon', avatar: 'https://i.pravatar.cc/150?u=f4', status: 'offline', location: 'Work' },
  { id: 'f5', name: 'Hana', avatar: 'https://i.pravatar.cc/150?u=f5', status: 'online', location: 'Seongsu' },
];

export const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'a1',
    title: 'Gyeong-do Tour',
    image: 'https://picsum.photos/400/300?random=1',
    distance: 2.3,
    headcount: '2-4 People',
    time: '2-3 Hours',
    tags: ['Popular', 'Walking'],
  },
  {
    id: 'a2',
    title: 'Do-Jjon-Ku Baking',
    image: 'https://picsum.photos/400/300?random=2',
    distance: 5.1,
    headcount: '3-6 People',
    time: '3 Hours',
    tags: ['Trend', 'Indoor'],
  },
  {
    id: 'a3',
    title: 'Han River Picnic',
    image: 'https://picsum.photos/400/300?random=3',
    distance: 1.5,
    headcount: 'Any',
    time: 'Flexible',
    tags: ['Outdoor', 'Relax'],
  },
  {
    id: 'a4',
    title: 'Escape Room Challenge',
    image: 'https://picsum.photos/400/300?random=4',
    distance: 0.8,
    headcount: '4 People',
    time: '1.5 Hours',
    tags: ['Exciting', 'Teamwork'],
  },
  {
    id: 'a5',
    title: 'Board Game Cafe',
    image: 'https://picsum.photos/400/300?random=5',
    distance: 0.5,
    headcount: '2-8 People',
    time: '2-5 Hours',
    tags: ['Casual', 'Fun'],
  },
];
