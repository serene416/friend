import { useCallback, useEffect, useRef, useState } from "react";
import * as Location from "expo-location";

type WeatherData = {
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  precipitationType: string;
  precipitation1h: string;
  windDirection: string | null;
  baseDate: string;
  baseTime: string;
  nx: number;
  ny: number;
};

type WeatherState = {
  loading: boolean;
  error: string | null;
  data: WeatherData | null;
  permissionDenied: boolean;
  refresh: () => Promise<void>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedWeather: {
  data: WeatherData;
  timestamp: number;
  nx: number;
  ny: number;
} | null = null;

const PTY_LABELS: Record<string, string> = {
  "0": "없음",
  "1": "비",
  "2": "비/눈",
  "3": "눈",
  "5": "빗방울",
  "6": "빗방울눈날림",
  "7": "눈날림",
};

const WIND_DIRECTIONS = [
  "북",
  "북북동",
  "북동",
  "동북동",
  "동",
  "동남동",
  "동남",
  "남남동",
  "남",
  "남남서",
  "남서",
  "서남서",
  "서",
  "서북서",
  "북서",
  "북북서",
];

const toNumber = (value: string | null | undefined) => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const formatTwoDigits = (value: number) => value.toString().padStart(2, "0");

const withTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timeout (${timeoutMs}ms)`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
};

const getBaseDateTimeKst = (now: Date) => {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const kstMs = utcMs + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstMs);
  const minutes = kstDate.getUTCMinutes();
  const seconds = kstDate.getUTCSeconds();
  const milliseconds = kstDate.getUTCMilliseconds();
  const subtractMinutes = minutes >= 10 ? minutes : minutes + 60;
  const baseMs =
    kstMs - subtractMinutes * 60 * 1000 - seconds * 1000 - milliseconds;
  const baseDate = new Date(baseMs);
  const year = baseDate.getUTCFullYear();
  const month = baseDate.getUTCMonth() + 1;
  const day = baseDate.getUTCDate();
  const hour = baseDate.getUTCHours();

  return {
    baseDate: `${year}${formatTwoDigits(month)}${formatTwoDigits(day)}`,
    baseTime: `${formatTwoDigits(hour)}00`,
  };
};

const getServiceKeyParam = (rawKey: string) => {
  if (!rawKey) return "";
  const hasEncodedToken = /%[0-9A-Fa-f]{2}/.test(rawKey);
  if (hasEncodedToken) return rawKey;
  return encodeURIComponent(rawKey);
};

const clampLongitude = (value: number) => {
  if (value > 180) return value - 360;
  if (value < -180) return value + 360;
  return value;
};

const latLonToGrid = (lat: number, lon: number) => {
  const RE = 6371.00877;
  const GRID = 5.0;
  const SLAT1 = 30.0;
  const SLAT2 = 60.0;
  const OLON = 126.0;
  const OLAT = 38.0;
  const XO = 43;
  const YO = 136;

  const DEGRAD = Math.PI / 180.0;
  const re = RE / GRID;
  const slat1 = SLAT1 * DEGRAD;
  const slat2 = SLAT2 * DEGRAD;
  const olon = OLON * DEGRAD;
  const olat = OLAT * DEGRAD;

  let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) /
    Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
  let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
  sf = (Math.pow(sf, sn) * Math.cos(slat1)) / sn;
  let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
  ro = (re * sf) / Math.pow(ro, sn);

  const adjustedLon = clampLongitude(lon);
  let ra = Math.tan(Math.PI * 0.25 + lat * DEGRAD * 0.5);
  ra = (re * sf) / Math.pow(ra, sn);
  let theta = adjustedLon * DEGRAD - olon;
  if (theta > Math.PI) theta -= 2.0 * Math.PI;
  if (theta < -Math.PI) theta += 2.0 * Math.PI;
  theta *= sn;

  const x = ra * Math.sin(theta) + XO;
  const y = ro - ra * Math.cos(theta) + YO;

  return { nx: Math.round(x), ny: Math.round(y) };
};

const degreesToDirection = (degrees: number) => {
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % 16;
  return WIND_DIRECTIONS[index];
};

export const useCurrentWeather = (): WeatherState => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<WeatherData | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const isMounted = useRef(true);

  const fetchWeather = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      console.log("[weather] start");
      const permission = await withTimeout(
        Location.requestForegroundPermissionsAsync(),
        8000,
        "permission",
      );
      if (permission.status !== "granted") {
        setPermissionDenied(true);
        setLoading(false);
        return;
      }

      setPermissionDenied(false);

      console.log("[weather] permission granted");
      const position = await withTimeout(
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        10000,
        "location",
      );

      const { latitude, longitude } = position.coords;
      const { nx, ny } = latLonToGrid(latitude, longitude);
      const now = Date.now();

      if (
        cachedWeather &&
        now - cachedWeather.timestamp < CACHE_TTL_MS &&
        cachedWeather.nx === nx &&
        cachedWeather.ny === ny
      ) {
        setData(cachedWeather.data);
        setLoading(false);
        return;
      }

      const baseUrl = (process.env.EXPO_PUBLIC_KMA_BASE_URL || "")
        .trim()
        .replace(/\/+$/, "")
        .replace(/^http:/, "https:");
      const rawKey = process.env.EXPO_PUBLIC_KMA_SERVICE_KEY_ENCODED || "";
      const serviceKey = getServiceKeyParam(rawKey);

      if (!baseUrl || !serviceKey) {
        throw new Error("API 설정이 누락되었습니다.");
      }

      const { baseDate, baseTime } = getBaseDateTimeKst(new Date());
      const requestUrl =
        `${baseUrl}/getUltraSrtNcst` +
        `?serviceKey=${serviceKey}` +
        "&dataType=JSON" +
        "&numOfRows=100" +
        "&pageNo=1" +
        `&base_date=${baseDate}` +
        `&base_time=${baseTime}` +
        `&nx=${nx}` +
        `&ny=${ny}`;

      console.log("[weather] requestUrl", requestUrl);
      const response = await withTimeout(fetch(requestUrl), 10000, "fetch");
      const responseText = await response.text();
      let json: any;
      try {
        json = JSON.parse(responseText);
      } catch (parseError) {
        console.log("[weather] response status", response.status);
        console.log("[weather] response headers", response.headers);
        console.log("[weather] response text (first 300)", responseText.slice(0, 300));
        throw new Error("JSON 파싱 실패: 응답이 JSON이 아닙니다.");
      }
      const header = json?.response?.header;

      if (!header || header.resultCode !== "00") {
        console.log("[weather] response header", header);
        console.log("[weather] response body", json?.response?.body);
        throw new Error(header?.resultMsg || "날씨 응답이 올바르지 않습니다.");
      }

      const items = json?.response?.body?.items?.item as
        | Array<{ category: string; obsrValue: string }>
        | undefined;

      if (!items || items.length === 0) {
        throw new Error("날씨 데이터가 비어 있습니다.");
      }

      const findValue = (category: string) =>
        items.find((item) => item.category === category)?.obsrValue;

      const temperature = toNumber(findValue("T1H"));
      const humidity = toNumber(findValue("REH"));
      const windSpeed = toNumber(findValue("WSD"));
      const pty = findValue("PTY");
      const rn1Value = findValue("RN1");
      const vec = toNumber(findValue("VEC"));

      const precipitationType = PTY_LABELS[pty ?? ""] || "알수없음";
      const rn1Number = toNumber(rn1Value);
      const precipitation1h =
        rn1Number === null || rn1Number === 0
          ? "강수없음"
          : `${rn1Number}mm`;
      const windDirection = vec === null ? null : degreesToDirection(vec);

      const weatherData: WeatherData = {
        temperature,
        humidity,
        windSpeed,
        precipitationType,
        precipitation1h,
        windDirection,
        baseDate,
        baseTime,
        nx,
        ny,
      };

      cachedWeather = {
        data: weatherData,
        timestamp: now,
        nx,
        ny,
      };

      if (isMounted.current) {
        setData(weatherData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "날씨 오류가 발생했습니다.";
      if (isMounted.current) {
        setError(message);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    return () => {
      isMounted.current = false;
    };
  }, [fetchWeather]);

  return {
    loading,
    error,
    data,
    permissionDenied,
    refresh: fetchWeather,
  };
};
