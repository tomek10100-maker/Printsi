export const getSiteUrl = () => {
  let url =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    'http://localhost:3000';
  
  url = url.startsWith('http') ? url : `https://${url}`;
  url = url.endsWith('/') ? url.slice(0, -1) : url;
  return url;
};
