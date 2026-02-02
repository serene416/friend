import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY;

interface KakaoMapProps {
  latitude: number;
  longitude: number;
}

export default function KakaoMap({ latitude, longitude }: KakaoMapProps) {
  const html = useMemo(() => {
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0, maximum-scale=1.0"
    />
    <style>
      html, body, #map {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
      }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script>
      (function() {
        var script = document.createElement('script');
        script.src = 'https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_JS_KEY}&autoload=false';
        script.onload = function() {
          kakao.maps.load(function() {
            var container = document.getElementById('map');
            var center = new kakao.maps.LatLng(${latitude}, ${longitude});
            var options = { center: center, level: 3 };
            var map = new kakao.maps.Map(container, options);
            var marker = new kakao.maps.Marker({ position: center });
            marker.setMap(map);
          });
        };
        document.head.appendChild(script);
      })();
    </script>
  </body>
</html>`;
  }, [latitude, longitude]);

  return (
    <View style={styles.container}>
      <WebView
        originWhitelist={["*"]}
        source={{ html }}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        style={styles.webView}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
  },
});
