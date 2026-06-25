import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width="32"
      height="32"
    >
      <rect width="512" height="512" rx="80" fill="#18181b" />
      <path
        d="m93 156 100 100L93 356"
        stroke="#47191f"
        strokeWidth="80"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="m206 156 100 100-100 100"
        stroke="#881924"
        strokeWidth="80"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="m319 156 100 100-100 100"
        stroke="#d41b2c"
        strokeWidth="80"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>,
    { ...size },
  );
}
