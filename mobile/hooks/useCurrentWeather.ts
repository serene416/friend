import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
import { getUltraSrtFcstBaseDateTimeKst } from "./getUltraSrtFcstBaseDateTimeKst";

type WeatherData = {
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
  precipitationType: string;
  skyLabel: string | null;
  weatherLabel: string;
  precipitation1h: string;
  windDirection: string | null;
  baseDate: string;
  baseTime: string;
  nx: number;
  ny: number;
  latitude: number;
  longitude: number;
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

const SKY_LABELS: Record<string, string> = {
  "1": "맑음",
  "3": "구름많음",
  "4": "흐림",
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

const maskSecret = (value: string) => {
  if (!value) return "";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
};

const maskServiceKeyInUrl = (url: string, serviceKey: string) => {
  if (!serviceKey) return url;
  const masked = maskSecret(serviceKey);
  const encodedServiceKey = encodeURIComponent(serviceKey);
  return url
    .replaceAll(serviceKey, masked)
    .replaceAll(encodedServiceKey, masked);
};

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
  const trimmed = rawKey.trim();
  if (!trimmed) return "";
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
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

const getKstDateTime = (now: Date) => {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const kstMs = utcMs + 9 * 60 * 60 * 1000;
  const kstDate = new Date(kstMs);
  const year = kstDate.getUTCFullYear();
  const month = kstDate.getUTCMonth() + 1;
  const day = kstDate.getUTCDate();
  const hour = kstDate.getUTCHours();
  const minute = kstDate.getUTCMinutes();

  return {
    date: `${year}${formatTwoDigits(month)}${formatTwoDigits(day)}`,
    time: `${formatTwoDigits(hour)}${formatTwoDigits(minute)}`,
  };
};

const selectSkyValueForNow = (
  items: Array<{ category: string; fcstDate: string; fcstTime: string; fcstValue: string }>,
  nowDate: string,
  nowTime: string,
) => {
  const todayItems = items.filter((item) => item.fcstDate === nowDate);
  if (todayItems.length === 0) return null;

  const sortedTimes = Array.from(
    new Set(todayItems.map((item) => item.fcstTime)),
  ).sort((a, b) => Number(a) - Number(b));

  if (sortedTimes.length === 0) return null;

  const targetTime =
    sortedTimes.find((time) => Number(time) >= Number(nowTime)) ??
    sortedTimes[sortedTimes.length - 1];

  return (
    todayItems.find(
      (item) => item.fcstTime === targetTime && item.category === "SKY",
    )?.fcstValue ?? null
  );
};

const buildKmaRequestUrl = (
  baseUrl: string,
  endpoint: "getUltraSrtNcst" | "getUltraSrtFcst",
  params: {
    serviceKey: string;
    numOfRows: number;
    pageNo: number;
    baseDate: string;
    baseTime: string;
    nx: number;
    ny: number;
  },
) => {
  const url = new URL(`${baseUrl}/${endpoint}`);
  url.searchParams.set("serviceKey", params.serviceKey);
  url.searchParams.set("dataType", "JSON");
  url.searchParams.set("_type", "json");
  url.searchParams.set("numOfRows", String(params.numOfRows));
  url.searchParams.set("pageNo", String(params.pageNo));
  url.searchParams.set("base_date", params.baseDate);
  url.searchParams.set("base_time", params.baseTime);
  url.searchParams.set("nx", String(params.nx));
  url.searchParams.set("ny", String(params.ny));
  return url.toString();
};

const extractXmlMessage = (text: string) => {
  const authMsg = text.match(/<returnAuthMsg>([^<]+)<\/returnAuthMsg>/)?.[1];
  if (authMsg) return authMsg;
  const resultMsg = text.match(/<resultMsg>([^<]+)<\/resultMsg>/)?.[1];
  if (resultMsg) return resultMsg;
  return null;
};

const parseKmaJson = (
  responseText: string,
  parseErrorMessage: string,
) => {
  const normalizedText = responseText.trim().replace(/^\uFEFF/, "");

  const tryParse = (value: string) => {
    try {
      return { ok: true as const, value: JSON.parse(value) };
    } catch {
      return { ok: false as const, value: null };
    }
  };

  const directParse = tryParse(responseText);
  if (directParse.ok) return directParse.value;

  if (normalizedText !== responseText) {
    const normalizedParse = tryParse(normalizedText);
    if (normalizedParse.ok) return normalizedParse.value;
  }

  const firstJsonStart = normalizedText.search(/[{\[]/);
  if (firstJsonStart > 0) {
    const slicedParse = tryParse(normalizedText.slice(firstJsonStart));
    if (slicedParse.ok) return slicedParse.value;
  }

  if (!normalizedText) {
    throw new Error("기상청 API 응답이 비어 있습니다.");
  }

  if (normalizedText.startsWith("<")) {
    const xmlMessage = extractXmlMessage(normalizedText);
    if (xmlMessage) {
      throw new Error(`기상청 API 오류: ${xmlMessage}`);
    }
    throw new Error("기상청 API가 JSON 대신 XML 응답을 반환했습니다.");
  }

  const compactSnippet = normalizedText.slice(0, 120).replace(/\s+/g, " ");
  const suffix = normalizedText.length > 120 ? "..." : "";
  throw new Error(`${parseErrorMessage} (응답 일부: ${compactSnippet}${suffix})`);
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

      const nowDate = new Date();
      const { baseDate, baseTime } = getBaseDateTimeKst(nowDate);
      const ncstRequestUrl = buildKmaRequestUrl(baseUrl, "getUltraSrtNcst", {
        serviceKey,
        numOfRows: 100,
        pageNo: 1,
        baseDate,
        baseTime,
        nx,
        ny,
      });

      console.log(
        "[weather] ncst requestUrl",
        maskServiceKeyInUrl(ncstRequestUrl, serviceKey),
      );
      const response = await withTimeout(fetch(ncstRequestUrl), 10000, "fetch");
      const responseText = await response.text();
      let json: any;
      try {
        json = parseKmaJson(responseText, "JSON 파싱 실패: 응답이 JSON이 아닙니다.");
      } catch (parseError) {
        console.log("[weather] response status", response.status);
        console.log("[weather] response headers", response.headers);
        console.log("[weather] response text (first 300)", responseText.slice(0, 300));
        throw parseError;
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
      let skyLabel: string | null = null;

      try {
        const { baseDate: fcstBaseDate, baseTime: fcstBaseTime } =
          getUltraSrtFcstBaseDateTimeKst(nowDate);
        const fcstRequestUrl = buildKmaRequestUrl(baseUrl, "getUltraSrtFcst", {
          serviceKey,
          numOfRows: 1000,
          pageNo: 1,
          baseDate: fcstBaseDate,
          baseTime: fcstBaseTime,
          nx,
          ny,
        });

        console.log(
          "[weather] fcst requestUrl",
          maskServiceKeyInUrl(fcstRequestUrl, serviceKey),
        );

        const fcstResponse = await withTimeout(
          fetch(fcstRequestUrl),
          10000,
          "fetch-fcst",
        );
        const fcstResponseText = await fcstResponse.text();
        let fcstJson: any;

        try {
          fcstJson = parseKmaJson(
            fcstResponseText,
            "예보 JSON 파싱 실패: 응답이 JSON이 아닙니다.",
          );
        } catch (parseError) {
          console.log("[weather] fcst response status", fcstResponse.status);
          console.log("[weather] fcst response headers", fcstResponse.headers);
          console.log(
            "[weather] fcst response text (first 300)",
            fcstResponseText.slice(0, 300),
          );
          throw parseError;
        }

        const fcstHeader = fcstJson?.response?.header;
        if (!fcstHeader || fcstHeader.resultCode !== "00") {
          console.log("[weather] fcst response header", fcstHeader);
          console.log("[weather] fcst response body", fcstJson?.response?.body);
          throw new Error(fcstHeader?.resultMsg || "예보 응답이 올바르지 않습니다.");
        }

        const fcstItems = fcstJson?.response?.body?.items?.item as
          | Array<{
            category: string;
            fcstDate: string;
            fcstTime: string;
            fcstValue: string;
          }>
          | undefined;

        if (!fcstItems || fcstItems.length === 0) {
          throw new Error("예보 데이터가 비어 있습니다.");
        }

        const { date: nowKstDate, time: nowKstTime } = getKstDateTime(nowDate);
        const skyValue = selectSkyValueForNow(fcstItems, nowKstDate, nowKstTime);
        skyLabel = skyValue ? SKY_LABELS[skyValue] || "알수없음" : null;
      } catch (forecastError) {
        console.log(
          "[weather] fcst warning",
          forecastError instanceof Error
            ? forecastError.message
            : "예보 조회 중 오류가 발생했습니다.",
        );
      }

      const rn1Number = toNumber(rn1Value);
      const precipitation1h =
        rn1Number === null || rn1Number === 0
          ? "강수없음"
          : `${rn1Number}mm`;
      const windDirection = vec === null ? null : degreesToDirection(vec);
      const weatherLabel = pty === "0" ? skyLabel || "알수없음" : precipitationType;

      const weatherData: WeatherData = {
        temperature,
        humidity,
        windSpeed,
        precipitationType,
        skyLabel,
        weatherLabel,
        precipitation1h,
        windDirection,
        baseDate,
        baseTime,
        nx,
        ny,
        latitude,
        longitude,
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
