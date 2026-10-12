import './globals.css';

export const metadata = {
  title: 'Flare — Formula 1 Head-to-Head Career Analytics',
  description: 'Compare any two Formula 1 drivers in history head-to-head. Interactive career stats, 6-axis performance radar chart, win percentages, and dominance ratings powered by Jolpica F1.',
  keywords: ['F1', 'Formula 1', 'Driver Comparison', 'Hamilton', 'Verstappen', 'Senna', 'Schumacher', 'Flare', 'Analytics']
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700;800&family=Titillium+Web:ital,wght@0,300;0,400;0,600;0,700;0,900;1,400;1,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="ambient-glow glow-red"></div>
        <div className="ambient-glow glow-blue"></div>
        <div className="ambient-grid"></div>
        {children}
      </body>
    </html>
  );
}
