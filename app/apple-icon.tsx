import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: 180,
        height: 180,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'white',
      }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 50 50"
        width="140"
        height="140"
      >
        <path
          d="M 10 10 L 10 4 L 40 4 L 40 10"
          fill="none"
          stroke="#D41B2C"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 10 40 L 10 46 L 40 46 L 40 40"
          fill="none"
          stroke="#D41B2C"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 12 17 L 18 25 L 12 33"
          fill="none"
          stroke="#D41B2C"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 22 17 L 28 25 L 22 33"
          fill="none"
          stroke="#D41B2C"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 32 17 L 38 25 L 32 33"
          fill="none"
          stroke="#D41B2C"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>,
    { ...size },
  );
}
