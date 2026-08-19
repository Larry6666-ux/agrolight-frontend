import "./globals.css";

export const metadata = {
  title: "AgroLight OS",
  description: "Africa's Agricultural Operating System — MVP prototype",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
