export function playPCMBase64(base64String: string, sampleRate = 24000) {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  const buffer = new Int16Array(bytes.buffer);
  
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
  const audioBuffer = audioCtx.createBuffer(1, buffer.length, sampleRate);
  
  const channelData = audioBuffer.getChannelData(0);
  for (let i = 0; i < buffer.length; i++) {
    channelData[i] = buffer[i] / 32768.0;
  }
  
  const source = audioCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(audioCtx.destination);
  const startTime = audioCtx.currentTime;
  source.start(startTime);
  
  return {
    stop: () => source.stop(),
    onEnded: (callback: () => void) => source.onended = callback,
    getCurrentTime: () => audioCtx.currentTime - startTime,
    getDuration: () => audioBuffer.duration
  };
}

export function classNames(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(' ');
}

export function extractKeyTerms(text: string, maxTerms: number = 25): { term: string; count: number }[] {
  const stopWords = new Set(['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most', 'us', 'are', 'is', 'was', 'were', 'been', 'has', 'had', 'does', 'did', 'am']);
  
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const counts: Record<string, number> = {};
  
  for (const word of words) {
    if (!stopWords.has(word)) {
      counts[word] = (counts[word] || 0) + 1;
    }
  }
  
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxTerms)
    .map(([term, count]) => ({ term, count }));
}
