const formatTwoDigits = (value: number) => value.toString().padStart(2, "0");

export const getUltraSrtFcstBaseDateTimeKst = (now: Date) => {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const kstMs = utcMs + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstMs);
  const minutes = kstDate.getUTCMinutes();
  const seconds = kstDate.getUTCSeconds();
  const milliseconds = kstDate.getUTCMilliseconds();

  const subtractMinutes = minutes >= 45 ? minutes - 30 : minutes + 30;
  const baseMs =
    kstMs - subtractMinutes * 60 * 1000 - seconds * 1000 - milliseconds;
  const baseDate = new Date(baseMs);
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth() + 1;
  const day = baseDate.getUTCDate();
  const hour = baseDate.getUTCHours();

  return {
    baseDate: `${year}${formatTwoDigits(month)}${formatTwoDigits(day)}`,
    baseTime: `${formatTwoDigits(hour)}30`,
  };
};
