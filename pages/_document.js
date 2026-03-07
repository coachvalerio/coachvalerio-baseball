// pages/_document.js
// Loads fonts once globally — Anton (display) + Inter (body)
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Barlow+Condensed:wght@400;600;700;900&display=swap"
          rel="stylesheet"
        />
        <style>{`
          /* ── Global resets & font assignments ── */
          *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
          html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

          /* Body copy — Inter for maximum readability */
          body {
            background: #03080f;
            color: #c8cde0;
            font-family: 'Inter', 'Barlow', system-ui, sans-serif;
            font-size: 15px;
            line-height: 1.5;
          }

          /* Display / athletic headers — Anton */
          .font-display, h1, h2 {
            font-family: 'Anton', 'Bebas Neue', sans-serif;
            letter-spacing: .04em;
          }

          /* Stat condensed labels — Barlow Condensed */
          .font-condensed {
            font-family: 'Barlow Condensed', sans-serif;
          }

          /* ── Shimmer skeleton animation ── */
          @keyframes shimmer {
            0%   { background-position: -600px 0; }
            100% { background-position: 600px 0; }
          }
          .skeleton {
            background: linear-gradient(90deg, #0d1117 25%, #1a1f2e 50%, #0d1117 75%);
            background-size: 600px 100%;
            animation: shimmer 1.4s infinite linear;
            border-radius: 6px;
          }
          .skeleton-dark {
            background: linear-gradient(90deg, #080c12 25%, #121620 50%, #080c12 75%);
            background-size: 600px 100%;
            animation: shimmer 1.4s infinite linear;
            border-radius: 6px;
          }

          /* ── Utility ── */
          @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:.4} }
          @keyframes spin   { to{transform:rotate(360deg)} }
          @keyframes loadbar{ to{width:100%} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }

          a { text-decoration: none; }
          table { border-collapse: collapse; width: 100%; }
          input, button, select { font-family: inherit; }

          /* scrollbar */
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: #080c12; }
          ::-webkit-scrollbar-thumb { background: #1e2028; border-radius: 3px; }
          ::-webkit-scrollbar-thumb:hover { background: #2a2f3f; }
        `}</style>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}