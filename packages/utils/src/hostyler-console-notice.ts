/**
 * Inline IIFE for `<script>` tags — runs synchronously on parse so it appears
 * at the top of DevTools console history when opened.
 */
export const HOSTYLER_CONSOLE_NOTICE_INLINE = [
  "(function(){",
  'if(typeof window==="undefined"||typeof console==="undefined"||window.__onlinecompetitionsHostylerNotice)return;',
  "window.__onlinecompetitionsHostylerNotice=1;",
  'var msg="HOSTYLER GROUP\\nThis site is developed and maintained by Hostyler.com. Unauthorized access, scraping, or abuse may be logged and reported. Please use the platform responsibly.";',
  'var style="background:#121214;color:#fbfaf5;padding:12px 14px;font-size:12px;line-height:1.6;font-family:system-ui,-apple-system,sans-serif;border-left:4px solid #6c3ef4;border-radius:6px;white-space:pre-wrap;";',
  'console.log("%c"+msg,style);',
  "})();",
].join("");
