import { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

// Loaded only when the binary has expo-video (see lib/video-support.ts).
// A tutorial, so it keeps its sound and the system controls, and plays only
// while its page is the one on screen.
export default function RedeemVideo({ uri, active }: { uri: string; active: boolean }) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = false;
  });
  useEffect(() => {
    if (active) player.play();
    else player.pause();
  }, [active, player]);
  return (
    <View style={StyleSheet.absoluteFill} className="bg-black">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls
        allowsPictureInPicture={false}
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
