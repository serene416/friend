import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY;

interface MarkerItem {
  lat: number;
  lng: number;
  title?: string;
}

interface KakaoMapProps {
  latitude: number;
  longitude: number;
  markers?: MarkerItem[];
}

export default function KakaoMap({ latitude, longitude, markers = [] }: KakaoMapProps) {
  const html = useMemo(() => {
    const markersData = JSON.stringify(markers);

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
            
            var markersData = ${markersData};
            
            if (markersData && markersData.length > 0) {
              var bounds = new kakao.maps.LatLngBounds();
              
              markersData.forEach(function(m) {
                var position = new kakao.maps.LatLng(m.lat, m.lng);
                var marker = new kakao.maps.Marker({ position: position });
                marker.setMap(map);
                
                if (m.title) {
                  var infowindow = new kakao.maps.InfoWindow({
                    content: '<div style="padding:5px;font-size:12px;">' + m.title + '</div>'
                  });
                  // infowindow.open(map, marker); // Optional: Open by default or on click
                   kakao.maps.event.addListener(marker, 'click', function() {
                      infowindow.open(map, marker);
                   });
                }
                
                bounds.extend(position);
              });
              
              // If there are multiple markers, fit bounds
              if (markersData.length > 1) {
                map.setBounds(bounds);
              } else {
                map.setCenter(new kakao.maps.LatLng(markersData[0].lat, markersData[0].lng));
              }
            } else {
              // Default single marker behavior if no markers prop provided (or empty)
              // But if latitude/longitude are provided, we usually want a marker there?
              // Existing behavior was: center + marker at center.
              // Let's keep a marker at center IF markers array is empty.
              var marker = new kakao.maps.Marker({ position: center });
              marker.setMap(map);
            }
          });
        };
        document.head.appendChild(script);
      })();
    </script>
  </body>
</html>`;
  }, [latitude, longitude, markers]);

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
