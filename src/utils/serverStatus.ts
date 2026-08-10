// GitHub Pages 靜態建置時注入 VITE_STATIC_ONLY，完全跳過 API 呼叫
export const IS_STATIC_MODE = import.meta.env.VITE_STATIC_ONLY === 'true';
