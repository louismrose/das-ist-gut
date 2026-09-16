/**
 * German pronunciation via the browser's built-in Web Speech API.
 * No network or server involvement; voice quality depends on the device.
 */

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

// iOS Safari wedges permanently (speaking stuck true, all later speak() calls
// silent) when cancel() interrupts a live utterance and speak() follows in the
// same task. So cancel only when something is actually speaking or queued, and
// after a real cancel give WebKit a moment before queueing the next utterance.
const CANCEL_SETTLE_MS = 200;

/** The utterance being spoken, held so it can't be garbage-collected mid-speech
 * (which also silences audio on WebKit and Chrome). */
let currentUtterance: SpeechSynthesisUtterance | null = null;
let pendingSpeak: ReturnType<typeof setTimeout> | null = null;

export function speakGerman(text: string): void {
  if (!speechSupported()) return;
  const synth = window.speechSynthesis;
  if (pendingSpeak !== null) {
    clearTimeout(pendingSpeak);
    pendingSpeak = null;
  }
  if (synth.speaking || synth.pending) {
    synth.cancel();
    pendingSpeak = setTimeout(() => {
      pendingSpeak = null;
      speakNow(text);
    }, CANCEL_SETTLE_MS);
  } else {
    speakNow(text);
  }
}

function speakNow(text: string): void {
  const synth = window.speechSynthesis;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "de-DE";
  utterance.rate = 0.9;
  // Prefer Anna (iOS/macOS's good German voice), then any German voice.
  // With no match, the lang hint above lets the browser pick one.
  const voices = synth.getVoices();
  const isGerman = (voice: SpeechSynthesisVoice) =>
    voice.lang.replace("_", "-").toLowerCase().startsWith("de");
  const germanVoice =
    voices.find((voice) => isGerman(voice) && voice.name.includes("Anna")) ?? voices.find(isGerman);
  if (germanVoice) utterance.voice = germanVoice;

  currentUtterance = utterance;
  const release = () => {
    if (currentUtterance === utterance) currentUtterance = null;
  };
  utterance.addEventListener("end", release);
  utterance.addEventListener("error", release);

  // iOS can also wedge in a stuck "paused" state; resume() is a no-op otherwise.
  synth.resume();
  synth.speak(utterance);
}
