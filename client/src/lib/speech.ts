/**
 * German pronunciation via the browser's built-in Web Speech API.
 * No network or server involvement; voice quality depends on the device.
 */

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function speakGerman(text: string): void {
  if (!speechSupported()) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  utterance.rate = 0.9;
  // Prefer Anna (iOS/macOS's good German voice), then any German voice.
  // With no match, the lang hint above lets the browser pick one.
  const voices = window.speechSynthesis.getVoices();
  const isGerman = (voice: SpeechSynthesisVoice) =>
    voice.lang.replace("_", "-").toLowerCase().startsWith("de");
  const germanVoice =
    voices.find((voice) => isGerman(voice) && voice.name.includes("Anna")) ?? voices.find(isGerman);
  if (germanVoice) utterance.voice = germanVoice;
  window.speechSynthesis.speak(utterance);
}
