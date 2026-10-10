import { useEffect, useState } from "react";
import { View, Pressable, Image, StyleSheet } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import { Icon } from "./Icon";
import { useT } from "../lib/i18n";

// Loaded only when the binary has expo-video (see lib/video-support.ts).
// Plays muted and looped while `active` (on screen), unless Reduce Motion is on:
// then it waits for a tap. Tap toggles play/pause; the corner button toggles sound.
export default function PolareVideoPlayer({
  uri,
  posterUri,
  alt,
  active,
  reducedMotion,
}: {
  uri: string;
  posterUri: string | null;
  alt: string | null;
  active: boolean;
  reducedMotion: boolean;
}) {
  const t = useT();
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  const [wantsPlay, setWantsPlay] = useState(!reducedMotion);
  const [muted, setMuted] = useState(true);
  const [shown, setShown] = useState(false); // first frame rendered

  useEffect(() => setWantsPlay(!reducedMotion), [reducedMotion]);
  useEffect(() => {
    if (active && wantsPlay) player.play();
    else player.pause();
  }, [active, wantsPlay, player]);
  useEffect(() => {
    player.muted = muted;
  }, [muted, player]);

  const playing = active && wantsPlay;
  return (
    <View style={StyleSheet.absoluteFill} className="bg-black">
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        nativeControls={false}
        allowsPictureInPicture={false}
        onFirstFrameRender={() => setShown(true)}
        accessibilityIgnoresInvertColors
      />
      {posterUri && !shown ? (
        <Image source={{ uri: posterUri }} resizeMode="cover" style={StyleSheet.absoluteFill} accessibilityIgnoresInvertColors />
      ) : null}
      <Pressable
        onPress={() => setWantsPlay((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${playing ? t("polare.pause") : t("polare.play")}${alt ? `, ${alt}` : ""}`}
        style={StyleSheet.absoluteFill}
        className="items-center justify-center"
      >
        {!playing ? (
          <View className="h-16 w-16 items-center justify-center rounded-full bg-black/50">
            <Icon name="play" size={32} color="#FFFFFF" />
          </View>
        ) : null}
      </Pressable>
      <Pressable
        onPress={() => setMuted((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={muted ? t("polare.unmute") : t("polare.mute")}
        className="absolute bottom-3 right-3 h-9 w-9 items-center justify-center rounded-full bg-black/60"
      >
        <Icon name={muted ? "volume-mute" : "volume-high"} size={18} color="#FFFFFF" />
      </Pressable>
    </View>
  );
}
