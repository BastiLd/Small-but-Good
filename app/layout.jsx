import "./globals.css";
import Layout from "../components/Layout";

export const metadata = {
  title: "CuratedHub",
  description: "Ausgewählte Apps, Bots und Creator entdecken"
};

export default function RootLayout({ children }) {
  return (
    <html lang="de">
      <body>
        <Layout>{children}</Layout>
      </body>
    </html>
  );
}
