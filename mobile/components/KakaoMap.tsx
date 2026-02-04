import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

const KAKAO_MAP_JS_KEY = process.env.EXPO_PUBLIC_KAKAO_MAP_JS_KEY;

interface MarkerItem {
  id: string;
  lat: number;
  lng: number;
  title?: string;
}

interface KakaoMapProps {
  latitude: number;
  longitude: number;
  markers?: MarkerItem[];
  onMarkerClick?: (id: string) => void;
  onMapClick?: () => void;
}

export default function KakaoMap({ latitude, longitude, markers = [], onMarkerClick, onMapClick }: KakaoMapProps) {
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
            
            // Custom marker image with smaller size
            var imageSrc = "https://t1.daumcdn.net/mapjsapi/images/marker.png";
            var imageSize = new kakao.maps.Size(22, 30); // Reduced size
            var markerImage = new kakao.maps.MarkerImage(imageSrc, imageSize);

            if (markersData && markersData.length > 0) {
              var bounds = new kakao.maps.LatLngBounds();
              
              markersData.forEach(function(m) {
                var position = new kakao.maps.LatLng(m.lat, m.lng);
                var marker = new kakao.maps.Marker({ 
                    position: position,
                    image: markerImage 
                });
                marker.setMap(map);
                
                kakao.maps.event.addListener(marker, 'click', function() {
                  if (window.ReactNativeWebView) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'markerClick', id: m.id }));
                  }
                });
                
                bounds.extend(position);
              });
              
              // If there are multiple markers, fit bounds
              if (markersData.length > 1) {
                map.setBounds(bounds);
              } else {
                map.setCenter(new kakao.maps.LatLng(markersData[0].lat, markersData[0].lng));
              }
            } else {
              var marker = new kakao.maps.Marker({ 
                  position: center,
                  image: markerImage 
              });
              marker.setMap(map);
            }
            
            kakao.maps.event.addListener(map, 'click', function() {
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapClick' }));
              }
            });
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
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'markerClick' && onMarkerClick) {
              onMarkerClick(data.id);
            } else if (data.type === 'mapClick' && onMapClick) {
              onMapClick();
            }
          } catch (e) {
            // ignore JSON parse error
          }
        }}
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
