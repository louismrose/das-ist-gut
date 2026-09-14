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
  // Prefer an explicitly German voice when the list has loaded; otherwise
  // the lang hint above lets the browser pick one.
  const germanVoice = window.speechSynthesis
    .getVoices()
    .find((voice) => voice.lang.replace("_", "-").toLowerCase().startsWith("de"));
  if (germanVoice) utterance.voice = germanVoice;
  window.speechSynthesis.speak(utterance);
}
